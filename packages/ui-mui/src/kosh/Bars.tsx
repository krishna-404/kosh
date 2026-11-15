import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { radii } from "../theme/tokens";

/** Which token colours a bar. */
export type BarColor = "accent" | "nifty" | "gold" | "alt" | "sun" | "neutral";

const barColor = (theme: Theme, color: BarColor): string => {
	const k = theme.vars.palette.kosh;
	return {
		accent: k.accent,
		nifty: k.seriesNifty,
		gold: k.seriesGold,
		alt: k.seriesAlt,
		sun: k.sun,
		neutral: k.line2,
	}[color];
};

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

interface ProgressTrackProps {
	/** 0 to 1. */
	value: number;
	color?: BarColor;
	/** What the bar measures, for screen readers. */
	ariaLabel: string;
	sx?: SxProps<Theme>;
}

/** A 12px pill track: progress, or one quantity as a share of another. */
export const ProgressTrack = ({ value, color = "accent", ariaLabel, sx }: ProgressTrackProps) => (
	<Box
		role="progressbar"
		aria-label={ariaLabel}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(clamp01(value) * 100)}
		sx={[
			(theme) => ({
				height: 12,
				borderRadius: `${radii.pill}px`,
				bgcolor: theme.vars.palette.kosh.surface2,
				overflow: "hidden",
			}),
			...(Array.isArray(sx) ? sx : [sx]),
		]}
	>
		<Box
			sx={(theme) => ({
				width: `${clamp01(value) * 100}%`,
				height: "100%",
				borderRadius: `${radii.pill}px`,
				bgcolor: barColor(theme, color),
				transition: theme.transitions.create("width", { duration: 300 }),
			})}
		/>
	</Box>
);

interface CompareBarProps {
	label: ReactNode;
	/** 0 to 1 — this row's length against the longest row. */
	value: number;
	/** The figure at the right. */
	figure: ReactNode;
	color?: BarColor;
	/** The row the comparison is about is set in bold. */
	emphasis?: boolean;
}

/** One row of "same money, different places": label · bar · figure. */
export const CompareBar = ({
	label,
	value,
	figure,
	color = "accent",
	emphasis = false,
}: CompareBarProps) => (
	<Box
		sx={{
			display: "grid",
			gridTemplateColumns: "minmax(88px, 0.9fr) minmax(60px, 2fr) auto",
			alignItems: "center",
			gap: 1.5,
		}}
	>
		<Typography variant="body2" noWrap sx={emphasis ? { fontWeight: 700, color: "text.primary" } : undefined}>
			{label}
		</Typography>
		<ProgressTrack value={value} color={color} ariaLabel={typeof label === "string" ? label : "value"} />
		<Typography
			variant="body2"
			component="span"
			sx={{ color: "text.primary", fontWeight: emphasis ? 700 : 500, textAlign: "right" }}
		>
			{figure}
		</Typography>
	</Box>
);

interface DivergingBarProps {
	/** Signed value; its size against `max` sets the length. */
	value: number;
	/** The largest magnitude on this scale (the longest bar). */
	max: number;
	width?: number;
	sx?: SxProps<Theme>;
}

/**
 * Ahead or behind at a glance: a bar growing right (ahead, green) or left
 * (behind, red) from a centre line. Decorative — the figure next to it
 * carries the value.
 */
export const DivergingBar = ({ value, max, width = 72, sx }: DivergingBarProps) => {
	const share = max > 0 ? clamp01(Math.abs(value) / max) : 0;
	const ahead = value >= 0;
	return (
		<Box
			aria-hidden
			sx={[
				(theme) => ({
					position: "relative",
					width,
					height: 12,
					flex: "none",
					borderRadius: `${radii.pill}px`,
					bgcolor: theme.vars.palette.kosh.surface2,
					"&::after": {
						content: '""',
						position: "absolute",
						left: "50%",
						top: -2,
						bottom: -2,
						width: "1.5px",
						bgcolor: theme.vars.palette.kosh.line2,
					},
				}),
				...(Array.isArray(sx) ? sx : [sx]),
			]}
		>
			<Box
				sx={(theme) => ({
					position: "absolute",
					top: 0,
					bottom: 0,
					width: `${share * 50}%`,
					...(ahead ? { left: "50%" } : { right: "50%" }),
					borderRadius: ahead
						? `0 ${radii.pill}px ${radii.pill}px 0`
						: `${radii.pill}px 0 0 ${radii.pill}px`,
					bgcolor: ahead ? theme.vars.palette.kosh.pos : theme.vars.palette.kosh.neg,
				})}
			/>
		</Box>
	);
};
