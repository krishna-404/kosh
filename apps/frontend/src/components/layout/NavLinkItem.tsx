import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { NavItem } from "@frontend/configs/nav.config";
import { NavLink } from "react-router";

interface NavLinkItemProps {
	item: NavItem;
	/** A small count at the right, e.g. questions waiting. */
	count?: number;
	onNavigate?: () => void;
}

/** One sidebar destination: a 44px pill, soft green when it is the current page. */
export const NavLinkItem = ({ item, count, onNavigate }: NavLinkItemProps) => (
	<Box
		component={NavLink}
		to={item.path}
		onClick={onNavigate}
		sx={(theme) => {
			const k = theme.vars.palette.kosh;
			return {
				display: "flex",
				alignItems: "center",
				gap: 1.5,
				minHeight: 44,
				px: 1.5,
				borderRadius: 999,
				color: k.ink2,
				fontSize: "0.875rem",
				fontWeight: 650,
				textDecoration: "none",
				transition: theme.transitions.create(["background-color", "color"], { duration: 200 }),
				"& svg": { fontSize: 20, flex: "none" },
				"&:hover": { bgcolor: k.surface2 },
				"&.active": { bgcolor: k.accentSoft, color: k.accentText },
				"&:focus-visible": { outline: `2px solid ${k.accent}`, outlineOffset: 2 },
			};
		}}
	>
		{item.icon}
		<Box component="span" sx={{ flex: 1, minWidth: 0 }}>
			{item.label}
		</Box>
		{count !== undefined && count > 0 && (
			<Box
				component="span"
				aria-label={`${count} waiting`}
				sx={(theme) => ({
					px: 1,
					py: 0.25,
					borderRadius: 999,
					bgcolor: theme.vars.palette.kosh.sunSoft,
					color: theme.vars.palette.kosh.sunText,
					fontSize: "0.71875rem",
					fontWeight: 800,
				})}
			>
				{count}
			</Box>
		)}
	</Box>
);
