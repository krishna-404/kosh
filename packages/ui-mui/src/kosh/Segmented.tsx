import type { SxProps, Theme } from "@mui/material/styles";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ReactNode } from "react";

export interface SegmentOption<V extends string> {
	value: V;
	label: ReactNode;
	icon?: ReactNode;
}

interface SegmentedProps<V extends string> {
	options: readonly SegmentOption<V>[];
	value: V;
	onChange: (value: V) => void;
	ariaLabel: string;
	/** Stretch to the container, each choice the same width. */
	fullWidth?: boolean;
	/** `sm` where space is tight (inside a menu); never below a 36px target. */
	size?: "md" | "sm";
	sx?: SxProps<Theme>;
}

/** A pill switch between a few views or values; exactly one is always chosen. */
export const Segmented = <V extends string>({
	options,
	value,
	onChange,
	ariaLabel,
	fullWidth = false,
	size = "md",
	sx,
}: SegmentedProps<V>) => (
	<ToggleButtonGroup
		exclusive
		value={value}
		aria-label={ariaLabel}
		fullWidth={fullWidth}
		size={size === "sm" ? "small" : "medium"}
		onChange={(_event, next: V | null) => {
			if (next !== null) onChange(next);
		}}
		sx={sx}
	>
		{options.map((option) => (
			<ToggleButton key={option.value} value={option.value}>
				{option.icon}
				{option.label}
			</ToggleButton>
		))}
	</ToggleButtonGroup>
);
