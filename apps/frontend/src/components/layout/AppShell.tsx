import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { SessionInfo } from "@frontend/contexts/UserContext";
import { userContext } from "@frontend/contexts/UserContext";
import { syncPushIfGranted } from "@frontend/utils/push.utils";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLoaderData } from "react-router";
import { OfflineBanner } from "./OfflineBanner";
import { BOTTOM_NAV_HEIGHT, BottomTabs, TopBar } from "./PhoneBars";
import { Sidebar } from "./Sidebar";
import { type ShellSlots, ShellSlotsContext } from "./shell.context";

/**
 * The frame around every signed-in page.
 *
 * Desktop (md and up): a fixed sidebar and the page beside it.
 * Phone: an app bar the page fills in (title, back, one action), the page,
 * and four tabs at the bottom.
 *
 * Session data comes from `authLoader`; pages read it with `useSessionInfo()`.
 */
export const AppShell = () => {
	const theme = useTheme();
	const desktop = useMediaQuery(theme.breakpoints.up("md"));
	const sessionInfo = useLoaderData() as SessionInfo;

	const [leading, setLeading] = useState<HTMLElement | null>(null);
	const [title, setTitle] = useState<HTMLElement | null>(null);
	const [action, setAction] = useState<HTMLElement | null>(null);
	const slots = useMemo<ShellSlots>(
		() => (desktop ? { leading: null, title: null, action: null } : { leading, title, action }),
		[desktop, leading, title, action],
	);

	// Silent push registration on sign-in. NEVER prompts for permission —
	// browsers permanently disable the prompt for the origin if a person
	// dismisses a badly timed one. The asking version lives behind explicit
	// UI on the profile page.
	const userId = sessionInfo.user?.id;
	useEffect(() => {
		if (!userId) return;
		void syncPushIfGranted();
	}, [userId]);

	return (
		<userContext.Provider value={sessionInfo}>
			<ShellSlotsContext.Provider value={slots}>
				<Box sx={{ display: "flex", minHeight: "100dvh" }}>
					{desktop && <Sidebar />}
					<Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
						<OfflineBanner />
						{!desktop && (
							<TopBar leadingRef={setLeading} titleRef={setTitle} actionRef={setAction} />
						)}
						<Box
							component="main"
							sx={{
								flex: 1,
								minWidth: 0,
								width: "100%",
								maxWidth: 1240,
								px: { xs: 2, md: 5 },
								pt: { xs: 2, md: 3.75 },
								pb: {
									xs: `calc(${BOTTOM_NAV_HEIGHT + 24}px + env(safe-area-inset-bottom))`,
									md: 5,
								},
							}}
						>
							<Outlet context={sessionInfo} />
						</Box>
					</Box>
					{!desktop && <BottomTabs />}
				</Box>
			</ShellSlotsContext.Provider>
		</userContext.Provider>
	);
};
