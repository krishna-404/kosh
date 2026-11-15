import { setActiveTeamIdForRequests } from "@frontend/utils/active_team_header.client";
import type { UserAppBackendOutputs } from "@frontend/utils/orpc.client";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { syncPushIfGranted } from "@frontend/utils/push.utils";
import { switchGate } from "@frontend/utils/switch_gate";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useRevalidator } from "react-router";
import { toast } from "react-toastify";
import type { SessionInfo } from "./UserContext";

export type Team = UserAppBackendOutputs["teams"]["getMyTeams"][number];

// Kept for backwards compatibility with existing consumers. Every user
// always has an active team (personal on signup), so `activeWorkspace` is
// never undefined once the session is loaded.
export interface Workspace {
	id: string;
	name: string;
	// A workspace is "personal" iff it is the user's personal team on the
	// server (row where personalTeamForUserId === user.id).
	type: "personal" | "team";
	role: Team["userRole"];
}

interface WorkspaceContextType {
	activeWorkspace: Workspace;
	teams: Team[];
	isLoading: boolean;
	user: SessionInfo["user"];
	setActiveTeam: (teamAppId: string) => Promise<void>;
	isSwitching: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
	undefined,
);

interface WorkspaceProviderProps {
	children: ReactNode;
	sessionInfo?: SessionInfo | null;
}

// Fallback for the brief window between mount and getMyTeams resolving.
// Renders as a neutral chip; nothing team-scoped is fetched until teams
// arrive because the `x-team-id` header cache is empty.
const PLACEHOLDER_WORKSPACE: Workspace = {
	id: "",
	name: "Loading…",
	type: "personal",
	role: "Owner",
};

export function WorkspaceProvider({
	children,
	sessionInfo,
}: WorkspaceProviderProps) {
	const queryClient = useQueryClient();
	const revalidator = useRevalidator();
	const userId = sessionInfo?.user?.id;
	const activeTeamAppId = sessionInfo?.user?.activeTeamAppId ?? null;

	const { data: teams = [], isLoading } = useQuery({
		...orpc.teams.getMyTeams.queryOptions({}),
		enabled: !!userId,
	});

	// Silent FCM registration on login. NEVER prompts for permission —
	// browsers permanently disable Notification.requestPermission() for
	// the origin if the user dismisses a bad prompt once. The user-gesture
	// version (promptAndRegisterPush) lives behind explicit UI: the
	// post-first-entry modal, the profile toggle, or the dashboard banner.
	useEffect(() => {
		if (!userId) return;
		void syncPushIfGranted();
	}, [userId]);

	const setActiveTeamMutation = useMutation(
		orpc.teams.setActiveTeam.mutationOptions({
			onMutate: () => {
				// Close the switch-gate BEFORE the backend session update
				// fires. The gate blocks every OTHER outbound ORPC at the
				// link boundary — the `teams.setActiveTeam`
				// call is exempt in `orpc.client.ts` so this doesn't
				// deadlock. Requests already past the gate but not yet
				// dispatched will complete against the OLD `x-team-id`
				// header; that is safe because they were authorized under
				// the old team's scope.
				switchGate.close();
			},
			onSuccess: async ({ activeTeamAppId: newId }) => {
				try {
					// 1. Flip the header cache so subsequent requests carry the
					//    new team id. This is what the closed gate is
					//    protecting: no other RPC can dispatch until it flips.
					setActiveTeamIdForRequests(newId);
					// 2. Re-run the router's authLoader so `sessionInfo.user.activeTeamAppId`
					//    (fed via useLoaderData) reflects the new value. Without this,
					//    the loader-derived prop stays at the old team and downstream
					//    consumers (activeWorkspace, useActiveTeamId, page enabled-gates)
					//    remain out of sync with the header, causing team-B data to
					//    render under a team-A UI.
					revalidator.revalidate();
				} finally {
					// Reopen before invalidateQueries so the refetches it
					// triggers carry the new header instead of stalling on
					// the gate.
					switchGate.open();
				}
				// 3. Drop team-scoped React Query caches so refetches hit the
				//    backend under the new team id. Narrowed from a blanket
				//    invalidateQueries() to avoid nuking unrelated data.
				await queryClient.invalidateQueries({
					queryKey: orpc.teams.getMyTeams.queryOptions({}).queryKey,
				});
			},
			onError: (err) => {
				// The gate was closed in onMutate but the backend mutation
				// failed. Reopen so the rest of the app doesn't stall on the
				// timeout waiting for a switch that never happened.
				switchGate.open();
				toast.error(err.message || "Failed to switch team");
			},
		}),
	);

	const activeWorkspace: Workspace = (() => {
		if (!activeTeamAppId || teams.length === 0) return PLACEHOLDER_WORKSPACE;
		const active = teams.find((t) => t.id === activeTeamAppId);
		if (!active) return PLACEHOLDER_WORKSPACE;
		return {
			id: active.id,
			name: active.name,
			type: active.personalTeamForUserId === userId ? "personal" : "team",
			role: active.userRole,
		};
	})();

	return (
		<WorkspaceContext.Provider
			value={{
				activeWorkspace,
				teams,
				isLoading: isLoading && teams.length === 0,
				user: sessionInfo?.user || null,
				setActiveTeam: async (teamAppId) => {
					await setActiveTeamMutation.mutateAsync({ teamAppId });
				},
				isSwitching: setActiveTeamMutation.isPending,
			}}
		>
			{children}
		</WorkspaceContext.Provider>
	);
}

export const useWorkspace = () => {
	const context = useContext(WorkspaceContext);
	if (context === undefined) {
		throw new Error("useWorkspace must be used within a WorkspaceProvider");
	}
	return context;
};

// Returns the id of the active team, or `null` while it's loading. Callers
// that must have a team id (team-scoped queries) should gate on this.
export const useActiveTeamId = () => {
	const { activeWorkspace } = useWorkspace();
	return activeWorkspace.id || null;
};
