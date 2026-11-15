import { createTheme } from "@mui/material/styles";
import "./theme.types";
import { components } from "./components";
import { paletteFor } from "./palette";
import { darkColors, lightColors, radii } from "./tokens";

/**
 * The attribute on <html> that says which scheme is on screen:
 * `data-kosh-scheme="light"` or `"dark"`.
 */
export const COLOR_SCHEME_ATTRIBUTE = "data-kosh-scheme";

import { typography } from "./typography";

/**
 * The Kosh theme. One theme object carries both colour schemes as CSS
 * variables, so switching light/dark repaints without re-rendering React
 * and components style themselves with `theme.vars.palette.kosh.*`.
 */
export const theme = createTheme({
	cssVariables: { colorSchemeSelector: COLOR_SCHEME_ATTRIBUTE },
	colorSchemes: {
		light: { palette: paletteFor("light", lightColors) },
		dark: { palette: paletteFor("dark", darkColors) },
	},
	typography,
	shape: { borderRadius: radii.menuItem },
	spacing: 8,
	components,
});
