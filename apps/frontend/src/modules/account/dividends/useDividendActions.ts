import { formatDate } from "@connected-repo/ui-mui/format/date";
import { type Snack, useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useRefreshMoney } from "@frontend/modules/money/money.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { countedTotal, rupees, scriptName } from "./dividends.utils";

/** What a person says arrived: the amount as the server takes it, and the day. */
export interface DividendAnswer {
	amount: string;
	receivedOn: string;
}

/** How a call from a dialog ended — the dialog shows the refusal itself, in the server's words. */
export type Outcome = { ok: true } | { ok: false; error: unknown };

/**
 * Everything the panel can change. Each call refreshes the figures and says
 * what happened in a snackbar; where the server can put things back exactly
 * as they were, the snackbar offers Undo.
 */
export interface DividendActions {
	/** Something is being saved: every button waits for it. */
	busy: boolean;
	/** "Confirm all as expected": every dividend still on Kosh's working. */
	confirmAll: (waiting: readonly Dividend[]) => Promise<boolean>;
	confirm: (dividend: Dividend) => Promise<boolean>;
	notReceived: (dividend: Dividend) => Promise<boolean>;
	/** Back to Kosh's working — or, for one a person added, out of the list. */
	undo: (dividend: Dividend) => Promise<boolean>;
	change: (dividend: Dividend, answer: DividendAnswer) => Promise<Outcome>;
	record: (script: { instrumentId: string; name: string }, answer: DividendAnswer) => Promise<Outcome>;
}

/**
 * The mutations live here, with the panel, rather than in each row or
 * dialog: an answer redraws its row and closes its dialog, and the
 * snackbar's Undo must still work after that.
 */
export const useDividendActions = (accountId: string): DividendActions => {
	const snack = useSnack();
	const refresh = useRefreshMoney();
	const [inFlight, setInFlight] = useState(0);

	const confirm = useMutation(orpc.dividends.confirm.mutationOptions());
	const change = useMutation(orpc.dividends.change.mutationOptions());
	const notReceived = useMutation(orpc.dividends.notReceived.mutationOptions());
	const reopen = useMutation(orpc.dividends.reopen.mutationOptions());
	const record = useMutation(orpc.dividends.record.mutationOptions());

	/** Do it, then refresh every figure that depends on dividends. */
	const attempt = async <T>(work: () => Promise<T>): Promise<{ ok: true; result: T } | { ok: false; error: unknown }> => {
		setInFlight((n) => n + 1);
		try {
			const result = await work();
			await refresh();
			return { ok: true, result };
		} catch (error) {
			// Often someone else got there first: show what is true now.
			void refresh();
			return { ok: false, error };
		} finally {
			setInFlight((n) => n - 1);
		}
	};

	/** The same, and say what happened. */
	const run = async <T>(
		work: () => Promise<T>,
		done: (result: T) => Snack | string,
		failed: string,
	): Promise<boolean> => {
		const outcome = await attempt(work);
		snack(outcome.ok ? done(outcome.result) : errorWords(outcome.error, failed));
		return outcome.ok;
	};

	/** A snackbar whose Undo puts one dividend back to Kosh's working (or takes an added one out). */
	const undoable = (message: string, dividendId: string, undone: string = D.snack.undone): Snack => ({
		message,
		actionLabel: D.act.undo,
		onAction: () => void run(() => reopen.mutateAsync({ dividendId }), () => undone, D.undoFailed),
	});

	/** One after another, so a failure part-way leaves the rest as they were; returns how many could not be undone. */
	const reopenEach = async (dividendIds: readonly string[]): Promise<number> => {
		let failed = 0;
		for (const dividendId of dividendIds) {
			try {
				await reopen.mutateAsync({ dividendId });
			} catch {
				failed++;
			}
		}
		return failed;
	};

	return {
		busy: inFlight > 0,

		confirmAll: (waiting) =>
			run(
				() => confirm.mutateAsync({ accountId }),
				({ confirmed }) => {
					// Someone else may have answered some in the meantime; then the list on
					// screen is not what was confirmed, and its total and ids are not offered.
					const asShown = confirmed === waiting.length && confirmed > 0;
					const message = D.snack.confirmedAll(confirmed, asShown ? rupees(countedTotal(waiting)) : null);
					if (!asShown) return message;
					const ids = waiting.map((d) => d.id);
					return {
						message,
						actionLabel: D.act.undo,
						onAction: () =>
							void run(
								() => reopenEach(ids),
								(failed) => (failed === 0 ? D.snack.undoneAll(ids.length) : D.snack.undoneSome(failed)),
								D.undoFailed,
							),
					};
				},
				D.confirmFailed,
			),

		confirm: (dividend) =>
			run(
				() => confirm.mutateAsync({ accountId, dividendIds: [dividend.id] }),
				({ confirmed }) =>
					confirmed === 0
						? D.snack.alreadyAnswered(scriptName(dividend))
						: undoable(D.snack.confirmed(scriptName(dividend), rupees(dividend.amount)), dividend.id),
				D.confirmFailed,
			),

		notReceived: (dividend) =>
			run(
				() => notReceived.mutateAsync({ dividendId: dividend.id }),
				() => {
					const message = D.snack.never(scriptName(dividend), rupees(dividend.amount));
					// Undo is exact only from Kosh's own working; an earlier answer is undone from its row.
					return dividend.state === "expected" ? undoable(message, dividend.id) : message;
				},
				D.neverFailed,
			),

		undo: (dividend) =>
			run(
				() => reopen.mutateAsync({ dividendId: dividend.id }),
				() =>
					dividend.source === "person"
						? D.snack.removed(scriptName(dividend), rupees(dividend.amount))
						: D.snack.reopened(scriptName(dividend)),
				D.undoFailed,
			),

		change: async (dividend, answer) => {
			const outcome = await attempt(() => change.mutateAsync({ dividendId: dividend.id, ...answer }));
			if (!outcome.ok) return outcome;
			const message = D.snack.changed(scriptName(dividend), rupees(answer.amount), formatDate(answer.receivedOn));
			snack(dividend.state === "expected" && dividend.source === "feed" ? undoable(message, dividend.id) : message);
			return { ok: true };
		},

		record: async (script, answer) => {
			const outcome = await attempt(() =>
				record.mutateAsync({ accountId, instrumentId: script.instrumentId, ...answer }),
			);
			if (!outcome.ok) return outcome;
			snack(undoable(D.snack.added(script.name, rupees(answer.amount)), outcome.result.id, D.snack.undoneAdded));
			return { ok: true };
		},
	};
};
