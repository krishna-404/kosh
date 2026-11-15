import {
	COLOR_SCHEME_ATTRIBUTE,
	THEME_MODE_STORAGE_KEY,
} from "@connected-repo/ui-mui/theme/ThemeProvider";

/**
 * Sets the colour-scheme attribute before React renders, from the choice
 * remembered on this device (or the device's own setting), so a dark-mode
 * user never sees a flash of the light theme. The theme provider takes over
 * from here once mounted.
 */
export const applyStoredColorScheme = (): void => {
	let mode: string | null = null;
	try {
		mode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
	} catch {
		// Storage can be blocked (private mode); fall through to the device setting.
	}
	const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
	const scheme = mode === "light" || mode === "dark" ? mode : systemDark ? "dark" : "light";
	document.documentElement.setAttribute(COLOR_SCHEME_ATTRIBUTE, scheme);
};
