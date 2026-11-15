import type { PaletteOptions } from "@mui/material/styles";
import type { KoshColors } from "./tokens";

/**
 * Tokens → a MUI palette for one colour scheme.
 *
 * The standard MUI slots are filled so stock components look right without
 * per-component colour props; `kosh` carries the full token set for the kit.
 */
export const paletteFor = (
	mode: "light" | "dark",
	c: KoshColors,
): PaletteOptions => ({
	mode,
	primary: { main: c.accent, contrastText: c.accentInk },
	secondary: { main: c.ink, contrastText: c.surface },
	error: { main: c.danger, contrastText: c.dangerInk },
	warning: { main: c.sun, contrastText: c.sunInk },
	info: { main: c.seriesNifty, contrastText: c.onSeries },
	success: { main: c.accent, contrastText: c.accentInk },
	background: { default: c.bg, paper: c.surface },
	text: { primary: c.ink, secondary: c.ink2, disabled: c.ink3 },
	divider: c.line,
	action: {
		hover: c.surface2,
		selected: c.accentSoft,
		focus: c.accentSoft,
		active: c.ink2,
	},
	kosh: c,
});
