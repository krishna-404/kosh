import { userContext } from "@frontend/contexts/UserContext";
import { setSentryUser } from "@frontend/instrumentation";
import { setActiveTeamIdForRequests } from "@frontend/utils/active_team_header.client";
import { authClient } from "@frontend/utils/auth.client";
import { saveLastLogin } from "@frontend/utils/auth.persistence";
import { orpcFetch } from "@frontend/utils/orpc.client";
import { detectUserTimezone } from "@frontend/utils/timezone.utils";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { toast } from "react-toastify";

/**
 * Auth loader for protected routes
 * Fetches session, sets React Router context, and redirects based on auth state
 */
export async function authLoader({ context }: LoaderFunctionArgs) {
	try {
		// Fetch session from better-auth client
		const { data: session, error } = await authClient.getSession();

		if (error || !session) {
			throw redirect("/auth");
		}

		// Save basic info for login page remembered state
		saveLastLogin({
			name: session.user.name,
			email: session.user.email,
			image: session.user.image,
		});

		// Timezone Detection and Auto-Update
		try {
			const detectedTimezone = await detectUserTimezone();
			if (detectedTimezone && detectedTimezone !== session.user.timezone) {
				toast.info(`Timezone change detected. Updating timezone to match your current location.`, {
					position: "top-center",
					autoClose: 1000,
				});

				await authClient.updateUser({ timezone: detectedTimezone });

				// Update the session user object with the new timezone
				session.user.timezone = detectedTimezone;

				// Show toast notification
				toast.success(`Your timezone has been updated to match your current location`, {
					position: "top-center",
					autoClose: 3000,
				});
			}
		} catch (timezoneError) {
			console.error(timezoneError);
			toast.error("Timezone detection/update failed.");
		}

		// Seed the `x-team-id` header cache BEFORE any component mounts.
		// The RPC link's headers callback is synchronous — if this isn't
		// set by the time the first team-scoped query fires, the backend
		// rejects with 403 "Active team id mismatch".
		setActiveTeamIdForRequests(session.user.activeTeamAppId ?? null);

		// Self-heal for stale better-auth cookieCache (`auth.config.ts`
		// `session.cookieCache.maxAge = 5min`). When the cookie was signed
		// before `users.activeTeamAppId` was set on the row, `getSession()`
		// keeps returning `null` for up to 5 minutes. `getDefaultTeam` is
		// the server's canonical fallback: returns the existing personal
		// team, or creates one, and stamps it back onto the user row.
		// Uses `rpcProtectedProcedure` (no `x-team-id` required), so calling
		// it with the header cache seeded to `null` is safe.
		if (!session.user.activeTeamAppId) {
			try {
				const defaultTeam = await orpcFetch.teams.getDefaultTeam();
				session.user.activeTeamAppId = defaultTeam.id;
				setActiveTeamIdForRequests(defaultTeam.id);
			} catch (err) {
				console.warn("[authLoader] getDefaultTeam fallback failed", err);
			}
		}

		const sessionInfo = {
			hasSession: true,
			user: session.user,
			isRegistered: true, // better-auth handles registration
		};

		setSentryUser({
			email: session.user.email,
			username: session.user.name,
			id: session.user.id
		})

		// Set user context in React Router context
		context.set(userContext, sessionInfo);

		// Return session data for loader
		return sessionInfo;

	} catch (error) {
		if (error instanceof Response) throw error; // Re-throw redirects

		console.error("Auth loader error:", error);
		throw redirect("/auth");
	}
}
