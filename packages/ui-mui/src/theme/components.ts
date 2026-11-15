import type { Components, Theme } from "@mui/material/styles";
import { fontStacks, radii, sizes } from "./tokens";

/** `var(--mui-palette-kosh-ink)` → `--mui-palette-kosh-ink`. */
export const cssVarName = (ref: string): string => {
	const match = /var\((--[^,)]+)/.exec(ref);
	return match?.[1] ?? ref;
};

/**
 * Component defaults and overrides: the canvas's component inventory applied
 * to MUI, once, so pages never restyle a button, input, card or dialog.
 */
export const components: Components<Theme> = {
	MuiCssBaseline: {
		styleOverrides: (theme) => ({
			body: {
				backgroundColor: theme.vars.palette.kosh.bg,
				WebkitFontSmoothing: "antialiased",
				MozOsxFontSmoothing: "grayscale",
			},
			"@media (prefers-reduced-motion: reduce)": {
				"*, *::before, *::after": {
					animationDuration: "0.01ms !important",
					animationIterationCount: "1 !important",
					transitionDuration: "0.01ms !important",
					scrollBehavior: "auto !important",
				},
			},
		}),
	},

	MuiButtonBase: {
		styleOverrides: {
			root: ({ theme }) => ({
				"&.Mui-focusVisible": {
					outline: `2px solid ${theme.vars.palette.kosh.accent}`,
					outlineOffset: 2,
				},
			}),
		},
	},

	MuiButton: {
		defaultProps: { disableElevation: true },
		styleOverrides: {
			root: ({ theme }) => ({
				minHeight: sizes.touch,
				padding: "0 20px",
				borderRadius: radii.pill,
				border: "1.5px solid transparent",
				whiteSpace: "nowrap",
				gap: 8,
				transition: theme.transitions.create(
					["background-color", "border-color", "box-shadow", "transform"],
					{ duration: 200 },
				),
				"&:active": { transform: "translateY(1px)" },
				"&.Mui-disabled": { opacity: 0.45, boxShadow: "none" },
				"& .MuiButton-startIcon": { margin: 0 },
				"& .MuiButton-endIcon": { margin: 0 },
				"& .MuiButton-startIcon > *:nth-of-type(1), & .MuiButton-endIcon > *:nth-of-type(1)":
					{ fontSize: 20 },
			}),
			sizeLarge: { minHeight: sizes.touchLarge, fontSize: "0.96875rem" },
			sizeSmall: { minHeight: 36, padding: "0 14px", fontSize: "0.8125rem" },
			containedPrimary: ({ theme }) => ({
				boxShadow: theme.vars.palette.kosh.shadowPrimary,
				"&:hover": { boxShadow: theme.vars.palette.kosh.shadowPrimary },
				"&.Mui-disabled": {
					backgroundColor: theme.vars.palette.kosh.accent,
					color: theme.vars.palette.kosh.accentInk,
				},
			}),
			containedError: ({ theme }) => ({
				"&.Mui-disabled": {
					backgroundColor: theme.vars.palette.kosh.danger,
					color: theme.vars.palette.kosh.dangerInk,
				},
			}),
			outlined: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.surface,
				color: theme.vars.palette.kosh.ink,
				borderColor: theme.vars.palette.kosh.line2,
				"&:hover": {
					backgroundColor: theme.vars.palette.kosh.surface2,
					borderColor: theme.vars.palette.kosh.ink3,
				},
				"&.Mui-disabled": {
					color: theme.vars.palette.kosh.ink,
					borderColor: theme.vars.palette.kosh.line2,
				},
			}),
			outlinedError: ({ theme }) => ({
				color: theme.vars.palette.kosh.dangerText,
				borderColor: theme.vars.palette.kosh.danger,
				"&:hover": {
					backgroundColor: theme.vars.palette.kosh.dangerSoft,
					borderColor: theme.vars.palette.kosh.danger,
				},
			}),
			text: ({ theme }) => ({
				padding: "0 12px",
				color: theme.vars.palette.kosh.accentText,
				"&:hover": { backgroundColor: theme.vars.palette.kosh.accentSoft },
				"&.Mui-disabled": { color: theme.vars.palette.kosh.accentText },
			}),
			textError: ({ theme }) => ({
				color: theme.vars.palette.kosh.dangerText,
				"&:hover": { backgroundColor: theme.vars.palette.kosh.dangerSoft },
				"&.Mui-disabled": { color: theme.vars.palette.kosh.dangerText },
			}),
			textInherit: { color: "inherit" },
		},
	},

	MuiIconButton: {
		styleOverrides: {
			root: ({ theme }) => ({
				width: sizes.touch,
				height: sizes.touch,
				color: theme.vars.palette.kosh.ink2,
				"&:hover": { backgroundColor: theme.vars.palette.kosh.surface2 },
			}),
			sizeSmall: { width: 36, height: 36 },
		},
	},

	MuiPaper: {
		styleOverrides: {
			root: { backgroundImage: "none" },
		},
		variants: [
			{
				props: { variant: "hero" },
				style: ({ theme }) => {
					const k = theme.vars.palette.kosh;
					return {
						backgroundColor: k.heroBg,
						color: k.heroInk,
						borderRadius: radii.card,
						boxShadow: k.shadowHero,
						// Re-point the tokens children read, so <Money tone="pos">
						// turns lime and quiet text turns pale green inside the hero
						// without any component knowing it is on a dark card.
						[cssVarName(k.ink)]: k.heroInk,
						[cssVarName(k.ink2)]: k.heroInk2,
						[cssVarName(k.ink3)]: k.heroInk3,
						[cssVarName(k.pos)]: k.heroPos,
						[cssVarName(k.accentText)]: k.heroInk,
						[cssVarName(k.mintSoft)]: k.heroTile,
						[cssVarName(k.surface2)]: k.heroTile,
						[cssVarName(k.line)]: k.heroTile,
						[cssVarName(theme.vars.palette.text.primary)]: k.heroInk,
						[cssVarName(theme.vars.palette.text.secondary)]: k.heroInk2,
						[cssVarName(theme.vars.palette.divider)]: k.heroTile,
					};
				},
			},
		],
	},

	MuiCard: {
		defaultProps: { elevation: 0 },
		styleOverrides: {
			root: ({ theme }) => ({
				border: `1px solid ${theme.vars.palette.kosh.line}`,
				borderRadius: radii.card,
				boxShadow: theme.vars.palette.kosh.shadowCard,
			}),
		},
	},
	MuiCardContent: {
		styleOverrides: {
			root: { padding: 20, "&:last-child": { paddingBottom: 20 } },
		},
	},

	MuiBackdrop: {
		styleOverrides: {
			root: ({ theme }) => ({
				"&:not(.MuiBackdrop-invisible)": {
					backgroundColor: theme.vars.palette.kosh.scrim,
				},
			}),
		},
	},

	MuiDialog: {
		styleOverrides: {
			paper: ({ theme }) => ({
				borderRadius: radii.dialog,
				boxShadow: theme.vars.palette.kosh.shadowPop,
				backgroundColor: theme.vars.palette.kosh.surface,
			}),
		},
	},
	MuiDialogTitle: {
		styleOverrides: {
			root: ({ theme }) => ({
				...theme.typography.h2,
				padding: "24px 24px 8px",
			}),
		},
	},
	MuiDialogContent: {
		styleOverrides: { root: { padding: "8px 24px 16px" } },
	},
	MuiDialogActions: {
		styleOverrides: { root: { padding: "12px 24px 24px", gap: 8 } },
	},

	MuiDrawer: {
		styleOverrides: {
			paper: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.surface,
				boxShadow: theme.vars.palette.kosh.shadowPop,
			}),
		},
	},

	MuiPopover: {
		styleOverrides: {
			paper: ({ theme }) => ({
				borderRadius: radii.menu,
				border: `1px solid ${theme.vars.palette.kosh.line}`,
				boxShadow: theme.vars.palette.kosh.shadowPop,
			}),
		},
	},
	MuiMenu: {
		styleOverrides: { list: { padding: 6 } },
	},
	MuiMenuItem: {
		styleOverrides: {
			root: ({ theme }) => ({
				minHeight: sizes.touch,
				borderRadius: radii.menuItem,
				padding: "8px 12px",
				gap: 12,
				fontWeight: 600,
				"&.Mui-selected": {
					backgroundColor: theme.vars.palette.kosh.surface2,
				},
				"&.Mui-selected:hover": {
					backgroundColor: theme.vars.palette.kosh.surface2,
				},
				[theme.breakpoints.up("sm")]: { minHeight: sizes.touch },
			}),
		},
	},

	// Labels sit above their field, as on the canvas — no floating labels.
	MuiInputLabel: {
		defaultProps: { shrink: true },
		styleOverrides: {
			root: ({ theme }) => ({
				position: "static",
				transform: "none",
				maxWidth: "none",
				marginBottom: 6,
				fontSize: "0.8125rem",
				fontWeight: 700,
				color: theme.vars.palette.kosh.ink,
				"&.Mui-focused, &.Mui-error": {
					color: theme.vars.palette.kosh.ink,
				},
			}),
		},
	},
	MuiOutlinedInput: {
		styleOverrides: {
			root: ({ theme }) => ({
				minHeight: sizes.input,
				borderRadius: radii.input,
				backgroundColor: theme.vars.palette.kosh.surface,
				fontSize: "0.9375rem",
				transition: theme.transitions.create("box-shadow", { duration: 200 }),
				"&:hover .MuiOutlinedInput-notchedOutline": {
					borderColor: theme.vars.palette.kosh.ink3,
				},
				"&.Mui-focused": {
					boxShadow: `0 0 0 3px ${theme.vars.palette.kosh.accentSoft}`,
				},
				"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
					borderColor: theme.vars.palette.kosh.accent,
					borderWidth: 1.5,
				},
				"&.Mui-error": {
					boxShadow: `0 0 0 3px ${theme.vars.palette.kosh.dangerSoft}`,
				},
				"&.Mui-error .MuiOutlinedInput-notchedOutline": {
					borderColor: theme.vars.palette.kosh.danger,
				},
			}),
			input: { padding: "12px 14px", height: "auto" },
			notchedOutline: ({ theme }) => ({
				top: 0,
				borderWidth: 1.5,
				borderColor: theme.vars.palette.kosh.line2,
				"& legend": { display: "none" },
			}),
		},
	},
	MuiFormHelperText: {
		styleOverrides: {
			root: ({ theme }) => ({
				margin: "6px 0 0",
				fontSize: "0.78125rem",
				color: theme.vars.palette.kosh.ink2,
				"&.Mui-error": {
					color: theme.vars.palette.kosh.dangerText,
					fontWeight: 600,
				},
			}),
		},
	},
	MuiFormLabel: {
		styleOverrides: {
			root: ({ theme }) => ({
				fontSize: "0.8125rem",
				fontWeight: 700,
				color: theme.vars.palette.kosh.ink,
				"&.Mui-focused": { color: theme.vars.palette.kosh.ink },
			}),
		},
	},

	MuiToggleButtonGroup: {
		styleOverrides: {
			root: ({ theme }) => ({
				padding: 3,
				gap: 3,
				borderRadius: radii.pill,
				border: `1px solid ${theme.vars.palette.kosh.line}`,
				backgroundColor: theme.vars.palette.kosh.surface2,
			}),
			grouped: {
				margin: 0,
				border: 0,
				borderRadius: `${radii.pill}px !important`,
			},
		},
	},
	MuiToggleButton: {
		styleOverrides: {
			root: ({ theme }) => ({
				minHeight: 42,
				padding: "0 15px",
				gap: 7,
				fontSize: "0.84375rem",
				fontWeight: 650,
				textTransform: "none",
				color: theme.vars.palette.kosh.ink2,
				"&.Mui-selected, &.Mui-selected:hover": {
					backgroundColor: theme.vars.palette.kosh.surface,
					color: theme.vars.palette.kosh.ink,
					boxShadow: theme.vars.palette.kosh.shadowRaised,
				},
				...theme.applyStyles("dark", {
					"&.Mui-selected, &.Mui-selected:hover": {
						backgroundColor: theme.vars.palette.kosh.line2,
						color: theme.vars.palette.kosh.ink,
					},
				}),
			}),
			sizeSmall: {
				minHeight: 36,
				padding: "0 10px",
				gap: 5,
				fontSize: "0.8125rem",
				"& svg": { fontSize: 18 },
			},
		},
	},

	// Medium chips are the 44px filter chips; small chips are compact labels.
	MuiChip: {
		styleOverrides: {
			root: ({ theme }) => ({
				height: sizes.touch,
				borderRadius: radii.pill,
				fontSize: "0.84375rem",
				fontWeight: 650,
				border: `1.5px solid ${theme.vars.palette.kosh.line2}`,
				backgroundColor: theme.vars.palette.kosh.surface,
				color: theme.vars.palette.kosh.ink,
				"&.MuiChip-clickable:hover": {
					backgroundColor: theme.vars.palette.kosh.surface2,
				},
			}),
			filled: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.ink,
				borderColor: theme.vars.palette.kosh.ink,
				color: theme.vars.palette.kosh.surface,
				"&.MuiChip-clickable:hover": {
					backgroundColor: theme.vars.palette.kosh.ink,
				},
			}),
			sizeSmall: { height: 32, fontSize: "0.78125rem" },
			label: { paddingLeft: 15, paddingRight: 15 },
			labelSmall: { paddingLeft: 11, paddingRight: 11 },
			icon: { marginLeft: 12, marginRight: -9, color: "inherit" },
		},
	},

	// Alerts are the canvas's banners.
	MuiAlert: {
		defaultProps: { variant: "standard" },
		styleOverrides: {
			root: {
				padding: "14px 16px",
				borderRadius: radii.banner,
				fontSize: "0.875rem",
				lineHeight: 1.45,
				gap: 12,
				alignItems: "flex-start",
			},
			icon: {
				margin: 0,
				padding: "1px 0 0",
				opacity: 1,
				color: "inherit !important",
				fontSize: 20,
			},
			message: { padding: 0, flex: 1, minWidth: 0 },
			action: { padding: 0, margin: 0, alignSelf: "center" },
			standardInfo: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.skySoft,
				color: theme.vars.palette.kosh.ink,
			}),
			standardWarning: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.sunSoft,
				color: theme.vars.palette.kosh.sunText,
			}),
			standardError: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.coralSoft,
				color: theme.vars.palette.kosh.dangerText,
			}),
			standardSuccess: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.mintSoft,
				color: theme.vars.palette.kosh.accentText,
			}),
		},
	},
	MuiAlertTitle: {
		styleOverrides: {
			root: { margin: "0 0 2px", fontWeight: 700, fontSize: "inherit" },
		},
	},

	MuiSnackbarContent: {
		styleOverrides: {
			root: ({ theme }) => ({
				minHeight: sizes.touchLarge,
				padding: "6px 6px 6px 16px",
				borderRadius: radii.snack,
				fontSize: "0.875rem",
				backgroundColor: theme.vars.palette.kosh.ink,
				color: theme.vars.palette.kosh.surface,
				boxShadow: theme.vars.palette.kosh.shadowPop,
				flexWrap: "nowrap",
			}),
			message: { padding: "8px 0" },
			action: ({ theme }) => ({
				marginRight: 0,
				paddingLeft: 12,
				"& .MuiButton-root": { color: theme.vars.palette.kosh.sun },
				"& .MuiIconButton-root": { color: "inherit" },
			}),
		},
	},

	MuiTooltip: {
		styleOverrides: {
			tooltip: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.ink,
				color: theme.vars.palette.kosh.surface,
				borderRadius: 10,
				padding: "7px 10px",
				fontSize: "0.78125rem",
				fontWeight: 600,
			}),
			arrow: ({ theme }) => ({ color: theme.vars.palette.kosh.ink }),
		},
	},

	MuiDivider: {
		styleOverrides: {
			root: ({ theme }) => ({ borderColor: theme.vars.palette.kosh.line }),
		},
	},

	MuiTabs: {
		styleOverrides: {
			root: ({ theme }) => ({
				minHeight: 48,
				borderBottom: `1px solid ${theme.vars.palette.kosh.line}`,
			}),
			indicator: ({ theme }) => ({
				height: 3,
				borderRadius: "3px 3px 0 0",
				backgroundColor: theme.vars.palette.kosh.accent,
			}),
		},
	},
	MuiTab: {
		styleOverrides: {
			root: ({ theme }) => ({
				minHeight: 48,
				padding: "0 16px",
				fontSize: "0.875rem",
				fontWeight: 700,
				textTransform: "none",
				color: theme.vars.palette.kosh.ink2,
				"&.Mui-selected": { color: theme.vars.palette.kosh.ink },
			}),
		},
	},

	MuiCheckbox: {
		styleOverrides: {
			root: ({ theme }) => ({
				color: theme.vars.palette.kosh.ink3,
				"&.Mui-checked": { color: theme.vars.palette.kosh.accent },
			}),
		},
	},
	MuiRadio: {
		styleOverrides: {
			root: ({ theme }) => ({
				color: theme.vars.palette.kosh.ink3,
				"&.Mui-checked": { color: theme.vars.palette.kosh.accent },
			}),
		},
	},

	MuiLinearProgress: {
		styleOverrides: {
			root: ({ theme }) => ({
				height: 12,
				borderRadius: radii.pill,
				backgroundColor: theme.vars.palette.kosh.surface2,
			}),
			bar: { borderRadius: radii.pill },
		},
	},

	MuiSkeleton: {
		styleOverrides: {
			root: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.surface2,
			}),
			rounded: { borderRadius: radii.menuItem },
		},
	},

	MuiTableCell: {
		styleOverrides: {
			root: ({ theme }) => ({
				padding: "14px 16px",
				fontSize: "0.875rem",
				borderBottomColor: theme.vars.palette.kosh.line,
			}),
			head: ({ theme }) => ({
				...theme.typography.eyebrow,
				color: theme.vars.palette.kosh.ink3,
				backgroundColor: "transparent",
			}),
		},
	},

	MuiAvatar: {
		styleOverrides: {
			root: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.surface2,
				color: theme.vars.palette.kosh.ink2,
				fontWeight: 700,
				fontFamily: fontStacks.body,
			}),
		},
	},

	MuiLink: {
		defaultProps: { underline: "hover" },
		styleOverrides: {
			root: ({ theme }) => ({
				color: theme.vars.palette.kosh.accentText,
				fontWeight: 650,
			}),
		},
	},

	MuiListItemButton: {
		styleOverrides: { root: { borderRadius: radii.menuItem } },
	},

	MuiAppBar: {
		defaultProps: { elevation: 0, color: "inherit" },
		styleOverrides: {
			root: ({ theme }) => ({
				backgroundColor: theme.vars.palette.kosh.surface,
				color: theme.vars.palette.kosh.ink,
				borderBottom: `1px solid ${theme.vars.palette.kosh.line}`,
			}),
		},
	},

	// The quieter text variants take their colour from the scheme.
	MuiTypography: {
		styleOverrides: {
			body2: ({ theme }) => ({ color: theme.vars.palette.kosh.ink2 }),
			caption: ({ theme }) => ({ color: theme.vars.palette.kosh.ink3 }),
			overline: ({ theme }) => ({ color: theme.vars.palette.kosh.ink3 }),
		},
		variants: [
			{
				props: { variant: "eyebrow" },
				style: ({ theme }) => ({ color: theme.vars.palette.kosh.ink3 }),
			},
		],
	},
};
