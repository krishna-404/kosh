import { createContext, useContext } from "react";

/**
 * Places in the phone's app bar that a page can fill: the back button, the
 * title and one action. On desktop there is no app bar and these are null —
 * the page header shows the same things in the page itself.
 */
export interface ShellSlots {
	leading: HTMLElement | null;
	title: HTMLElement | null;
	action: HTMLElement | null;
}

export const ShellSlotsContext = createContext<ShellSlots>({
	leading: null,
	title: null,
	action: null,
});

export const useShellSlots = (): ShellSlots => useContext(ShellSlotsContext);
