import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconMore } from "@connected-repo/ui-mui/kosh/icons";
import { KoshWordmark } from "@connected-repo/ui-mui/kosh/KoshMark";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { NovuInbox } from "@frontend/components/notifications/NovuInbox";
import { navSections } from "@frontend/configs/nav.config";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import { HOME } from "@frontend/copy/nav.copy";
import { useState } from "react";
import { Link } from "react-router";
import { NavLinkItem } from "./NavLinkItem";
import { UserMenu } from "./UserMenu";

export const SIDEBAR_WIDTH = 252;

/** Desktop navigation: brand, the two groups of destinations, and you. */
export const Sidebar = () => {
	const { user } = useSessionInfo();
	const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

	return (
		<Box
			component="nav"
			aria-label="Main"
			sx={(theme) => ({
				width: SIDEBAR_WIDTH,
				flex: "none",
				position: "sticky",
				top: 0,
				height: "100dvh",
				display: "flex",
				flexDirection: "column",
				gap: "3px",
				px: 1.75,
				py: 2.75,
				bgcolor: theme.vars.palette.kosh.surface,
				borderRight: `1px solid ${theme.vars.palette.kosh.line}`,
				overflowY: "auto",
			})}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					px: 1.25,
					pb: 2.25,
				}}
			>
				<Box
					component={Link}
					to={HOME}
					aria-label="Kosh home"
					sx={{ color: "inherit", textDecoration: "none" }}
				>
					<KoshWordmark />
				</Box>
				<NovuInbox />
			</Box>

			{navSections.map((section, index) => (
				<Box key={section.title} sx={{ display: "flex", flexDirection: "column", gap: "3px" }}>
					<Typography
						variant="eyebrow"
						component="div"
						sx={{ px: 1.5, pt: index === 0 ? 0.5 : 2.25, pb: 0.75 }}
					>
						{section.title}
					</Typography>
					{section.items.map((item) => (
						<NavLinkItem key={item.path} item={item} />
					))}
				</Box>
			))}

			{user && (
				<Box
					component="button"
					type="button"
					aria-label="Your menu: theme, profile, sign out"
					aria-haspopup="menu"
					onClick={(event) => setMenuAnchor(event.currentTarget)}
					sx={(theme) => ({
						mt: "auto",
						display: "flex",
						alignItems: "center",
						gap: 1.25,
						p: 1.25,
						width: "100%",
						border: `1px solid ${theme.vars.palette.kosh.line}`,
						borderRadius: "18px",
						bgcolor: "transparent",
						color: "inherit",
						font: "inherit",
						textAlign: "left",
						cursor: "pointer",
						transition: theme.transitions.create("background-color", { duration: 200 }),
						"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
						"&:focus-visible": {
							outline: `2px solid ${theme.vars.palette.kosh.accent}`,
							outlineOffset: 2,
						},
					})}
				>
					<HolderAvatar name={user.name || user.email || "You"} colorKey={user.id} size="sm" />
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Typography variant="subtitle2" component="div" noWrap>
							{user.name}
						</Typography>
						<Typography variant="caption" component="div" noWrap>
							{user.email}
						</Typography>
					</Box>
					<IconMore fontSize="small" />
				</Box>
			)}
			<UserMenu anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} placement="above" />
		</Box>
	);
};
