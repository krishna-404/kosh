import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactElement, ReactNode } from "react";
import { IconCheck } from "./icons";

export interface ChipOption<V extends string> {
	value: V;
	label: ReactNode;
	icon?: ReactElement;
}

interface FilterChipsProps<V extends string> {
	options: readonly ChipOption<V>[];
	/** The chosen value (or values, with `multiple`). */
	value: V | readonly V[] | null;
	onChange: (value: V) => void;
	/** Says what the chips choose, for screen readers. */
	ariaLabel: string;
	/** Show a tick on chosen chips (for multi-select and "kind" pickers). */
	showCheck?: boolean;
	sx?: SxProps<Theme>;
}

/**
 * A row of pill choices. Chosen chips are solid ink. On a phone the row
 * scrolls sideways instead of wrapping.
 */
export const FilterChips = <V extends string>({
	options,
	value,
	onChange,
	ariaLabel,
	showCheck = false,
	sx,
}: FilterChipsProps<V>) => {
	const isOn = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
	return (
		<Box
			role="group"
			aria-label={ariaLabel}
			sx={[
				{
					display: "flex",
					gap: 1,
					flexWrap: { xs: "nowrap", md: "wrap" },
					overflowX: { xs: "auto", md: "visible" },
					scrollbarWidth: "none",
					"&::-webkit-scrollbar": { display: "none" },
				},
				...(Array.isArray(sx) ? sx : [sx]),
			]}
		>
			{options.map((option) => {
				const on = isOn(option.value);
				return (
					<Chip
						key={option.value}
						clickable
						label={option.label}
						icon={on && showCheck ? <IconCheck /> : option.icon}
						variant={on ? "filled" : "outlined"}
						aria-pressed={on}
						onClick={() => onChange(option.value)}
						sx={{ flex: "none" }}
					/>
				);
			})}
		</Box>
	);
};
