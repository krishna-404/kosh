import type { Snack } from "@connected-repo/ui-mui/kosh/SnackProvider";

/**
 * Says what just happened in the snackbar, from anywhere — including code
 * that is not a React component (route loaders, the RPC client).
 * Components may equally call `useSnack()`.
 */
type Listener = (snack: Snack) => void;

let listener: Listener | null = null;
const waiting: Snack[] = [];

export const notify = (snack: Snack | string): void => {
	const next = typeof snack === "string" ? { message: snack } : snack;
	if (listener) listener(next);
	else waiting.push(next);
};

/** Called once by the app root to connect `notify` to the snackbar. */
export const bindNotifier = (fn: Listener): (() => void) => {
	listener = fn;
	for (const snack of waiting.splice(0)) fn(snack);
	return () => {
		if (listener === fn) listener = null;
	};
};
