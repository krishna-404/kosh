import CssBaseline from "@mui/material/CssBaseline";
import {
	ThemeProvider as MuiThemeProvider,
	useColorScheme,
	useTheme,
} from "@mui/material/styles";
import type { ReactNode } from "react";
import { theme } from "./theme";

export { COLOR_SCHEME_ATTRIBUTE } from "./theme";

export type { KoshTheme } from "./theme.types";

export type ThemeMode = "light" | "dark" | "system";

/** localStorage key the chosen mode is remembered under, per device. */
export const THEME_MODE_STORAGE_KEY = "kosh-theme-mode";

/**
 * Mounts the Kosh theme. The colour scheme follows the device until the
 * person picks light or dark; the choice is remembered on that device.
 */
export const KoshThemeProvider = ({ children }: { children: ReactNode }) => (
	<MuiThemeProvider
		theme={theme}
		defaultMode="system"
		modeStorageKey={THEME_MODE_STORAGE_KEY}
		disableTransitionOnChange
	>
		<CssBaseline enableColorScheme />
		{children}
	</MuiThemeProvider>
);

/** Read and change the colour scheme. */
export const useThemeMode = () => {
	const { mode, setMode, systemMode } = useColorScheme();
	const current: ThemeMode = mode ?? "system";
	const actualMode: "light" | "dark" =
		current === "system" ? (systemMode ?? "light") : current;
	return {
		/** What the person chose: light, dark, or follow the device. */
		mode: current,
		/** What is on screen right now. */
		actualMode,
		setThemeMode: (next: ThemeMode) => setMode(next),
		toggleTheme: () => setMode(actualMode === "dark" ? "light" : "dark"),
	};
};

/**
 * The palette of the scheme on screen, as literal colour values. Only for
 * third-party widgets that cannot read CSS variables; Kosh components use
 * `theme.vars`.
 */
export const useLiteralPalette = () => {
	const theme = useTheme();
	const { actualMode } = useThemeMode();
	return theme.colorSchemes[actualMode]?.palette ?? theme.palette;
};
