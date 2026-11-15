import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Divider } from "@connected-repo/ui-mui/layout/Divider";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import { MenuList } from "@connected-repo/ui-mui/navigation/MenuList";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { ReactNode } from "react";
import { RadioMark } from "./RadioMark";

export interface MenuAction {
	key: string;
	label: ReactNode;
	/** A quiet second line: what the choice means, or why it is blocked. */
	hint?: ReactNode;
	icon?: ReactNode;
	tone?: "danger";
	/** One choice among several (a level). Draws a radio mark. */
	checked?: boolean;
	/** Allowed by the level but blocked by the situation — `hint` says why. */
	disabled?: boolean;
	/** A hairline above this item. */
	divider?: boolean;
	/** Choosing swaps the items instead of closing the menu. */
	keepOpen?: boolean;
	onSelect: () => void;
}

interface ActionMenuProps {
	anchorEl: HTMLElement | null;
	onClose: () => void;
	/** Names the menu; on a phone it is the sheet's title. */
	title: string;
	/** Shown at the top of the phone sheet (an avatar and a name). */
	sheetTitle?: ReactNode;
	sheetSubtitle?: ReactNode;
	doneLabel?: string;
	actions: readonly MenuAction[];
}

/**
 * What can be done to one thing: a menu beside its button on desktop, a
 * bottom sheet on a phone. Choices (levels) carry a radio mark and a line
 * saying what they mean; actions carry an icon.
 */
export const ActionMenu = ({
	anchorEl,
	onClose,
	title,
	sheetTitle,
	sheetSubtitle,
	doneLabel = "Done",
	actions,
}: ActionMenuProps) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("sm"));
	const open = Boolean(anchorEl);

	const items = actions.flatMap((action) => {
		const choice = action.checked !== undefined;
		const item = (
			<MenuItem
				key={action.key}
				role={choice ? "menuitemradio" : "menuitem"}
				aria-checked={choice ? action.checked : undefined}
				selected={action.checked === true}
				disabled={action.disabled}
				onClick={() => {
					if (!action.keepOpen) onClose();
					action.onSelect();
				}}
				sx={(t) => ({
					alignItems: "flex-start",
					whiteSpace: "normal",
					py: 1.25,
					color: action.tone === "danger" ? t.vars.palette.kosh.dangerText : undefined,
					"& > svg": { fontSize: 20, mt: "1px", flex: "none" },
				})}
			>
				{choice ? <RadioMark on={action.checked === true} /> : action.icon}
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 0.75,
							fontWeight: 700,
							lineHeight: 1.4,
							"& svg": { fontSize: 17 },
						}}
					>
						{choice && action.icon}
						{action.label}
					</Box>
					{action.hint && (
						<Typography
							variant="caption"
							component="div"
							sx={action.tone === "danger" ? { color: "inherit" } : undefined}
						>
							{action.hint}
						</Typography>
					)}
				</Box>
			</MenuItem>
		);
		return action.divider
			? [<Divider key={`${action.key}-rule`} component="li" sx={{ my: 0.75 }} />, item]
			: [item];
	});

	if (phone)
		return (
			<ResponsiveDialog
				open={open}
				onClose={onClose}
				title={sheetTitle ?? title}
				subtitle={sheetSubtitle}
				hideClose
				actions={
					<Button variant="outlined" size="large" onClick={onClose}>
						{doneLabel}
					</Button>
				}
			>
				<MenuList aria-label={title} sx={{ p: 0, mx: -1.5 }}>
					{items}
				</MenuList>
			</ResponsiveDialog>
		);

	return (
		<Menu
			anchorEl={anchorEl}
			open={open}
			onClose={onClose}
			anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
			transformOrigin={{ horizontal: "right", vertical: "top" }}
			slotProps={{
				paper: { sx: { width: 340, maxWidth: "calc(100vw - 32px)", mt: 0.75 } },
				list: { "aria-label": title },
			}}
		>
			{items}
		</Menu>
	);
};
