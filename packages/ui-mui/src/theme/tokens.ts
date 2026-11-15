/**
 * Kosh design tokens — the ONLY file in the repo that may contain colour
 * literals, shadows or font names (`yarn lint:design` enforces it).
 *
 * Source: the Claude Design canvas "Kosh — accounts, people and sharing",
 * identity board, final ("v3") look. Token names mirror the canvas's CSS
 * variables so a value can be traced back to the design in one step.
 *
 * Everything above this file reads tokens through the MUI theme
 * (`theme.vars.palette.kosh.*`), never from here directly.
 */

/** Colours that change between light and dark. */
export interface KoshColors {
	// Surfaces and lines
	bg: string;
	surface: string;
	surface2: string;
	line: string;
	line2: string;
	edge: string;
	scrim: string;
	// Text
	ink: string;
	ink2: string;
	ink3: string;
	// Brand green
	accent: string;
	accentInk: string;
	accentSoft: string;
	accentText: string;
	// Sunshine (the "Can edit" colour, warnings, pending)
	sun: string;
	sunInk: string;
	sunSoft: string;
	sunText: string;
	sunEdge: string;
	// Supporting pastels
	mint: string;
	mintSoft: string;
	coral: string;
	coralSoft: string;
	sky: string;
	skySoft: string;
	lilac: string;
	lilacSoft: string;
	// Danger
	danger: string;
	dangerInk: string;
	dangerSoft: string;
	dangerText: string;
	// Gains and losses
	pos: string;
	neg: string;
	// Chart series
	seriesYou: string;
	seriesNifty: string;
	seriesGold: string;
	seriesAlt: string;
	onSeries: string;
	// The money hero card (deep green, lime for growth)
	heroBg: string;
	heroInk: string;
	heroInk2: string;
	heroInk3: string;
	heroPos: string;
	heroTile: string;
	// Text on a pastel avatar (same in both schemes — the pastels do not flip)
	avatarInk: string;
	// Elevation
	shadowCard: string;
	shadowPop: string;
	shadowPrimary: string;
	shadowHero: string;
	shadowRaised: string;
}

export const lightColors: KoshColors = {
	bg: "#F1FAF5",
	surface: "#FFFFFF",
	surface2: "#EAF6EF",
	line: "#D3E6DC",
	line2: "#B5CFC2",
	edge: "#CBD9D2",
	scrim: "rgba(19,36,30,.45)",
	ink: "#13241E",
	ink2: "#3F5650",
	ink3: "#596F68",
	accent: "#0B7A63",
	accentInk: "#FFFFFF",
	accentSoft: "#DDF7EA",
	accentText: "#076350",
	sun: "#F7C548",
	sunInk: "#3D2A00",
	sunSoft: "#FFF1C9",
	sunText: "#5C3D00",
	sunEdge: "#D99A0B",
	mint: "#9BE7C4",
	mintSoft: "#DDF7EA",
	coral: "#F4A285",
	coralSoft: "#FFE1D6",
	sky: "#A9CFF5",
	skySoft: "#E1EEFF",
	lilac: "#CDBDF6",
	lilacSoft: "#EEE7FF",
	danger: "#C8341F",
	dangerInk: "#FFFFFF",
	dangerSoft: "#FFE1D6",
	dangerText: "#A1260F",
	pos: "#076350",
	neg: "#A1260F",
	seriesYou: "#0B7A63",
	seriesNifty: "#3D6FE0",
	seriesGold: "#E0A100",
	seriesAlt: "#8A5CF0",
	onSeries: "#FFFFFF",
	heroBg: "#0D3F35",
	heroInk: "#F2FFF9",
	heroInk2: "#C4E6D9",
	heroInk3: "#A6D2C2",
	heroPos: "#C6F57E",
	heroTile: "rgba(255,255,255,.09)",
	avatarInk: "#13241E",
	shadowCard: "0 1px 2px rgba(19,36,30,.05),0 8px 24px rgba(19,36,30,.06)",
	shadowPop: "0 24px 60px rgba(19,36,30,.18),0 2px 8px rgba(19,36,30,.08)",
	shadowPrimary: "0 1px 2px rgba(11,122,99,.35),0 4px 12px rgba(11,122,99,.18)",
	shadowHero: "0 18px 40px rgba(13,63,53,.25)",
	shadowRaised: "0 1px 3px rgba(0,0,0,.12)",
};

export const darkColors: KoshColors = {
	bg: "#0E1714",
	surface: "#16211D",
	surface2: "#1E2C27",
	line: "#2B3B35",
	line2: "#3D5149",
	edge: "#34463F",
	scrim: "rgba(0,0,0,.6)",
	ink: "#EAF4EF",
	ink2: "#B2C4BD",
	ink3: "#93A79F",
	accent: "#4FD1B0",
	accentInk: "#04211B",
	accentSoft: "#123A30",
	accentText: "#8BE8D0",
	sun: "#F7C548",
	sunInk: "#3D2A00",
	sunSoft: "#3A2E0A",
	sunText: "#FFD777",
	sunEdge: "#B8860B",
	mint: "#9BE7C4",
	mintSoft: "#123A30",
	coral: "#F4A285",
	coralSoft: "#3D1E15",
	sky: "#A9CFF5",
	skySoft: "#14263D",
	lilac: "#CDBDF6",
	lilacSoft: "#261E40",
	danger: "#FF8A7E",
	dangerInk: "#2A0603",
	dangerSoft: "#3D1E15",
	dangerText: "#FFADA4",
	pos: "#8BE8D0",
	neg: "#FFADA4",
	seriesYou: "#4FD1B0",
	seriesNifty: "#8EA8F0",
	seriesGold: "#E2B15B",
	seriesAlt: "#C7A0EA",
	onSeries: "#0E1714",
	heroBg: "#11493D",
	heroInk: "#F2FFF9",
	heroInk2: "#C4E6D9",
	heroInk3: "#A6D2C2",
	heroPos: "#C6F57E",
	heroTile: "rgba(255,255,255,.09)",
	avatarInk: "#13241E",
	shadowCard: "none",
	shadowPop: "0 24px 60px rgba(0,0,0,.55)",
	shadowPrimary: "none",
	shadowHero: "none",
	shadowRaised: "0 1px 3px rgba(0,0,0,.4)",
};

/**
 * Pastel backgrounds for people's avatars. A person keeps one colour
 * everywhere (picked from a stable hash of their id), in both schemes.
 */
export const avatarColors = [
	"#7BE0B5",
	"#FFB38A",
	"#C3B1FF",
	"#FFE07A",
	"#8EC5FF",
	"#FFB3C7",
	"#FFD7A0",
	"#D6E4DE",
] as const;

export const fontStacks = {
	/** Page titles, card titles, big figures, the wordmark. */
	heading: '"Sora Variable","Sora","Figtree Variable","Figtree",system-ui,sans-serif',
	/** Everything else. */
	body: '"Figtree Variable","Figtree","Inter Variable","Inter",system-ui,-apple-system,"Segoe UI",sans-serif',
	/** Amounts and percentages — always tabular. */
	numeric: '"Inter Variable","Inter",system-ui,sans-serif',
} as const;

export const radii = {
	card: 20,
	dialog: 26,
	sheet: 26,
	menu: 18,
	banner: 18,
	snack: 16,
	input: 14,
	mark: 12,
	menuItem: 12,
	check: 8,
	spot: 18,
	pill: 999,
} as const;

/** Fixed measures from the canvas. Touch targets are never below 44px. */
export const sizes = {
	touch: 44,
	touchLarge: 52,
	input: 48,
	row: 60,
	sidebar: 252,
	topBar: 60,
	bottomNav: 70,
	badge: 30,
	badgeLarge: 36,
	tag: 24,
} as const;
