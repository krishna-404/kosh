// Types `theme.vars`. A preserved reference, so it survives into the built
// declarations for every consumer of this package — and, being types only,
// adds no import at runtime (the module ships no JavaScript).
/// <reference types="@mui/material/themeCssVarsAugmentation" preserve="true" />
/**
 * MUI theme augmentation: the Kosh palette slot, the hero Paper variant and
 * the extra typography variants. Importing this file (the theme does) makes
 * `theme.vars.palette.kosh.*` and `<Typography variant="figure">` type-check
 * everywhere.
 */
import "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { CSSProperties } from "react";
import type { KoshColors } from "./tokens";

declare module "@mui/material/styles" {
	interface Palette {
		kosh: KoshColors;
	}
	interface PaletteOptions {
		kosh?: KoshColors;
	}

	interface TypographyVariants {
		/** Large headline figure (Sora, tabular). */
		figure: CSSProperties;
		/** Inline amount or percentage (Inter, tabular). */
		numeric: CSSProperties;
		/** Small uppercase label above a group. */
		eyebrow: CSSProperties;
	}
	interface TypographyVariantsOptions {
		figure?: CSSProperties;
		numeric?: CSSProperties;
		eyebrow?: CSSProperties;
	}
}

declare module "@mui/material/Typography" {
	interface TypographyPropsVariantOverrides {
		figure: true;
		numeric: true;
		eyebrow: true;
	}
}

declare module "@mui/material/Paper" {
	interface PaperPropsVariantOverrides {
		/** The deep-green money card. Children read lime for gains. */
		hero: true;
	}
}

declare module "@mui/material/Button" {
	interface ButtonPropsSizeOverrides {
		/** 52px — the main action on a phone sheet. */
		large: true;
	}
}

/**
 * The MUI theme type with the Kosh additions. Re-exported from
 * `ThemeProvider` so that importing the provider is enough to bring this
 * file — and its augmentations — into a consumer's type-check.
 */
export type KoshTheme = Theme;
