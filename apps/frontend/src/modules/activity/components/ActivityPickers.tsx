import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { IconCheck, IconChevronDown } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import { MenuList } from "@connected-repo/ui-mui/navigation/MenuList";
import { type ReactNode, useId, useState } from "react";

/** One choice in a picker. `value` null is the "no filter" choice ("All accounts", "Anyone"). */
export interface PickerOption {
	value: string | null;
	label: string;
}

interface OptionItemsProps {
	options: readonly PickerOption[];
	value: string | null;
	onPick: (value: string | null) => void;
}

/** The choices themselves, one ticked — shared by the desktop menu and the phone sheet. */
const optionItems = ({ options, value, onPick }: OptionItemsProps) =>
	options.map((option) => {
		const on = option.value === value;
		return (
			<MenuItem
				key={option.value ?? "(all)"}
				role="menuitemradio"
				aria-checked={on}
				selected={on}
				onClick={() => onPick(option.value)}
			>
				<Box
					component="span"
					sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
				>
					{option.label}
				</Box>
				{/* The tick, not only the tint, says which one is chosen. */}
				<IconCheck fontSize="small" aria-hidden sx={{ visibility: on ? "visible" : "hidden" }} />
			</MenuItem>
		);
	});

interface PickerButtonProps extends OptionItemsProps {
	/** What is being chosen ("Account", "Person"), for screen readers. */
	label: string;
	icon: ReactNode;
}

/** Desktop: a button showing the current choice, opening a menu of the others. */
export const PickerButton = ({ label, icon, options, value, onPick }: PickerButtonProps) => {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const menuId = useId();
	const current = options.find((option) => option.value === value) ?? options[0];
	return (
		<>
			<Button
				variant="outlined"
				startIcon={icon}
				endIcon={<IconChevronDown />}
				aria-label={`${label}: ${current?.label ?? ""}`}
				aria-haspopup="menu"
				aria-controls={anchor ? menuId : undefined}
				aria-expanded={anchor ? true : undefined}
				onClick={(event) => setAnchor(event.currentTarget)}
				sx={{ maxWidth: 260 }}
			>
				<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
					{current?.label}
				</Box>
			</Button>
			<Menu
				id={menuId}
				anchorEl={anchor}
				open={anchor !== null}
				onClose={() => setAnchor(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				transformOrigin={{ vertical: "top", horizontal: "right" }}
				slotProps={{
					paper: { sx: { mt: 0.75, minWidth: 220, maxWidth: 340, maxHeight: 420 } },
					list: { "aria-label": label },
				}}
			>
				{optionItems({
					options,
					value,
					onPick: (next) => {
						onPick(next);
						setAnchor(null);
					},
				})}
			</Menu>
		</>
	);
};

/** Phone: the same choices laid out in the filter sheet, under a heading. */
export const PickerList = ({ label, options, value, onPick }: Omit<PickerButtonProps, "icon">) => {
	const headingId = useId();
	return (
		<Box>
			<Typography id={headingId} variant="eyebrow" component="h3" sx={{ m: 0, px: 1.5, pb: 0.5 }}>
				{label}
			</Typography>
			<MenuList aria-labelledby={headingId} sx={{ p: 0 }}>
				{optionItems({ options, value, onPick })}
			</MenuList>
		</Box>
	);
};
