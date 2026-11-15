import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { KoshMark } from "@connected-repo/ui-mui/kosh/KoshMark";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { NovuInbox } from "@frontend/components/notifications/NovuInbox";
import { tabItems } from "@frontend/configs/nav.config";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import { useState } from "react";
import { NavLink } from "react-router";
import { UserMenu } from "./UserMenu";

export const TOP_BAR_HEIGHT = 60;
export const BOTTOM_NAV_HEIGHT = 70;

interface TopBarProps {
	/** Callback refs for the places a page can fill (see shell.context.ts). */
	leadingRef: (el: HTMLElement | null) => void;
	titleRef: (el: HTMLElement | null) => void;
	actionRef: (el: HTMLElement | null) => void;
}

/** The phone's app bar: back (if the page asks), the page title, one action, you. */
export const TopBar = ({ leadingRef, titleRef, actionRef }: TopBarProps) => {
	const { user } = useSessionInfo();
	const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

	return (
		<Box
			component="header"
			sx={(theme) => ({
				position: "sticky",
				top: 0,
				zIndex: theme.zIndex.appBar,
				height: TOP_BAR_HEIGHT,
				flex: "none",
				display: "flex",
				alignItems: "center",
				gap: 0.5,
				pl: 1,
				pr: 0.75,
				bgcolor: theme.vars.palette.kosh.surface,
				borderBottom: `1px solid ${theme.vars.palette.kosh.line}`,
			})}
		>
			<Box
				ref={leadingRef}
				sx={{
					display: "flex",
					alignItems: "center",
					// The mark shows only when the page put no back button here.
					"&:not(:empty) + [data-mark]": { display: "none" },
				}}
			/>
			<Box data-mark sx={{ pl: 0.5, pr: 0.5 }}>
				<KoshMark size={32} />
			</Box>
			<Box
				ref={titleRef}
				sx={(theme) => ({
					...theme.typography.h4,
					flex: 1,
					minWidth: 0,
					pl: 0.5,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
				})}
			/>
			<Box ref={actionRef} sx={{ display: "flex", alignItems: "center" }} />
			<NovuInbox />
			{user && (
				<IconButton
					aria-label="Your menu: more pages, theme, profile, sign out"
					aria-haspopup="menu"
					onClick={(event) => setMenuAnchor(event.currentTarget)}
				>
					<HolderAvatar name={user.name || user.email || "You"} colorKey={user.id} size="sm" />
				</IconButton>
			)}
			<UserMenu anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} withDestinations />
		</Box>
	);
};

/** The phone's four tabs. The current one sits on a soft green pill. */
export const BottomTabs = () => (
	<Box
		component="nav"
		aria-label="Main"
		sx={(theme) => ({
			position: "fixed",
			left: 0,
			right: 0,
			bottom: 0,
			zIndex: theme.zIndex.appBar,
			height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
			pb: "env(safe-area-inset-bottom)",
			display: "flex",
			bgcolor: theme.vars.palette.kosh.surface,
			borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
		})}
	>
		{tabItems.map((item) => (
			<Box
				key={item.path}
				component={NavLink}
				to={item.path}
				sx={(theme) => {
					const k = theme.vars.palette.kosh;
					return {
						flex: 1,
						minWidth: 0,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: "3px",
						color: k.ink2,
						fontSize: "0.71875rem",
						fontWeight: 750,
						textDecoration: "none",
						"& [data-pill]": {
							width: 56,
							height: 30,
							display: "grid",
							placeItems: "center",
							borderRadius: "15px",
							transition: theme.transitions.create("background-color", { duration: 200 }),
						},
						"& svg": { fontSize: 22 },
						"&.active": { color: k.accentText },
						"&.active [data-pill]": { bgcolor: k.accentSoft },
						"&:focus-visible [data-pill]": { outline: `2px solid ${k.accent}` },
					};
				}}
			>
				<span data-pill>{item.icon}</span>
				{item.shortLabel ?? item.label}
			</Box>
		))}
	</Box>
);
