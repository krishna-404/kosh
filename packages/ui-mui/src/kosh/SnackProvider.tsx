import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

export interface Snack {
	message: ReactNode;
	/** A single follow-up, most often "Undo". */
	actionLabel?: string;
	onAction?: () => void;
	/** How long it stays, in ms. Errors and undoable notes stay longer. */
	duration?: number;
}

type Notify = (snack: Snack | string) => void;

const SnackContext = createContext<Notify | null>(null);

/** Says what just happened, at the bottom of the screen, with at most one action. */
export const useSnack = (): Notify => {
	const notify = useContext(SnackContext);
	if (!notify) throw new Error("useSnack must be used inside <SnackProvider>");
	return notify;
};

interface SnackProviderProps {
	children: ReactNode;
	/** On a phone, lift the snackbar above a fixed bottom bar of this height (px). */
	phoneBottomOffset?: number;
}

export const SnackProvider = ({ children, phoneBottomOffset = 0 }: SnackProviderProps) => {
	// One at a time: a new note replaces the one showing.
	const [current, setCurrent] = useState<(Snack & { key: number }) | null>(null);
	const [open, setOpen] = useState(false);

	const notify = useCallback<Notify>((snack) => {
		const next = typeof snack === "string" ? { message: snack } : snack;
		setCurrent({ ...next, key: Date.now() });
		setOpen(true);
	}, []);

	const value = useMemo(() => notify, [notify]);

	return (
		<SnackContext.Provider value={value}>
			{children}
			<Snackbar
				key={current?.key}
				open={open}
				autoHideDuration={current?.duration ?? (current?.actionLabel ? 8000 : 5000)}
				onClose={(_event, reason) => {
					if (reason !== "clickaway") setOpen(false);
				}}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
				message={current?.message}
				action={
					current?.actionLabel ? (
						<Button
							variant="text"
							color="inherit"
							onClick={() => {
								setOpen(false);
								current.onAction?.();
							}}
						>
							{current.actionLabel}
						</Button>
					) : undefined
				}
				sx={{ mb: { xs: `${phoneBottomOffset}px`, md: 0 } }}
			/>
		</SnackContext.Provider>
	);
};
