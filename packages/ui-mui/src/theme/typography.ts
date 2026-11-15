import type { TypographyVariantsOptions } from "@mui/material/styles";
import { fontStacks } from "./tokens";

const px = (n: number) => `${n / 16}rem`;

/**
 * Type scale from the canvas. Sora for titles and headline figures, Figtree
 * for everything else, Inter (tabular) for amounts. Colours for the quieter
 * variants are set in `components.ts` so they follow the colour scheme.
 */
export const typography: TypographyVariantsOptions = {
	fontFamily: fontStacks.body,
	fontSize: 14,
	h1: {
		fontFamily: fontStacks.heading,
		fontSize: px(30),
		lineHeight: 1.1,
		fontWeight: 700,
		letterSpacing: "-0.035em",
	},
	h2: {
		fontFamily: fontStacks.heading,
		fontSize: px(20),
		lineHeight: 1.2,
		fontWeight: 700,
		letterSpacing: "-0.02em",
	},
	h3: { fontSize: px(16), lineHeight: 1.3, fontWeight: 700 },
	h4: {
		fontFamily: fontStacks.heading,
		fontSize: px(17),
		lineHeight: 1.25,
		fontWeight: 700,
		letterSpacing: "-0.02em",
	},
	h5: { fontSize: px(15), lineHeight: 1.3, fontWeight: 700 },
	h6: { fontSize: px(14), lineHeight: 1.3, fontWeight: 700 },
	subtitle1: { fontSize: px(15), lineHeight: 1.4, fontWeight: 600 },
	subtitle2: { fontSize: px(14), lineHeight: 1.4, fontWeight: 700 },
	body1: { fontSize: px(14), lineHeight: 1.45 },
	body2: { fontSize: px(13), lineHeight: 1.45 },
	caption: { fontSize: px(12), lineHeight: 1.4 },
	overline: {
		fontSize: px(12),
		lineHeight: 1.4,
		fontWeight: 800,
		letterSpacing: "0.08em",
		textTransform: "uppercase",
	},
	button: {
		fontSize: px(14.5),
		lineHeight: 1,
		fontWeight: 700,
		textTransform: "none",
	},
	figure: {
		fontFamily: fontStacks.heading,
		fontSize: px(34),
		lineHeight: 1.1,
		fontWeight: 700,
		letterSpacing: "-0.03em",
		fontVariantNumeric: "tabular-nums",
	},
	numeric: {
		fontFamily: fontStacks.numeric,
		fontVariantNumeric: "tabular-nums",
		letterSpacing: "-0.01em",
	},
	eyebrow: {
		fontSize: px(12),
		lineHeight: 1.4,
		fontWeight: 800,
		letterSpacing: "0.08em",
		textTransform: "uppercase",
	},
};
