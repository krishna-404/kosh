import { formatDate } from "@connected-repo/ui-mui/format/date";
import { type Snack, useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import type { AppliedAction, LineAnswer, Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS, SPLITS, UPLOADS } from "@frontend/copy/statements.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useRefreshMoney } from "@frontend/modules/money/money.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { formatQuantity, ledgerMoney } from "./statements.utils";

type Of<K extends Question["kind"]> = Extract<Question, { kind: K }>;

/** An upload, as far as undoing it needs to know. */
export interface UploadRef {
	batchId: string;
	fileName: string | null;
	added: number;
}

/**
 * Everything the tab can change, each as one call that resolves to whether
 * it worked. Every call refreshes the figures, says what happened in a
 * snackbar and — where the server can take it back — offers Undo there.
 */
export interface StatementActions {
	answerLine: (question: Of<"ledger_line">, answer: LineAnswer) => Promise<boolean>;
	explainOpening: (question: Of<"opening_balance">) => Promise<boolean>;
	giveIsin: (question: Of<"missing_isin">, isin: string) => Promise<boolean>;
	answerTransfer: (question: Of<"transfer">, same: boolean) => Promise<boolean>;
	applyAction: (question: Of<"corporate_action">, oneBecomes?: number) => Promise<boolean>;
	declineAction: (question: Of<"corporate_action">) => Promise<boolean>;
	recordSplit: (
		question: Of<"holding_mismatch">,
		input: { instrumentId: string; exDate: string; oneBecomes: number },
	) => Promise<boolean>;
	dismissMismatch: (question: Of<"holding_mismatch">) => Promise<boolean>;
	undoApplied: (action: AppliedAction) => Promise<boolean>;
	undoUpload: (upload: UploadRef) => Promise<boolean>;
}

/**
 * The mutations live here, in the tab, rather than in each card: answering
 * a question removes its card, and the snackbar's Undo must still work
 * after the card is gone.
 */
export const useStatementActions = (): StatementActions => {
	const snack = useSnack();
	const refresh = useRefreshMoney();

	const answerLedgerLine = useMutation(orpc.questions.answerLedgerLine.mutationOptions());
	const changeLedgerLine = useMutation(orpc.questions.changeLedgerLine.mutationOptions());
	const explainOpening = useMutation(orpc.questions.explainOpening.mutationOptions());
	const giveIsin = useMutation(orpc.questions.giveIsin.mutationOptions());
	const transfer = useMutation(orpc.questions.transfer.mutationOptions());
	const undoTransfer = useMutation(orpc.questions.undoTransfer.mutationOptions());
	const applyCorporateAction = useMutation(orpc.questions.applyCorporateAction.mutationOptions());
	const declineCorporateAction = useMutation(orpc.questions.declineCorporateAction.mutationOptions());
	const recordCorporateAction = useMutation(orpc.questions.recordCorporateAction.mutationOptions());
	const undoCorporateAction = useMutation(orpc.questions.undoCorporateAction.mutationOptions());
	const dismissHoldingMismatch = useMutation(orpc.questions.dismissHoldingMismatch.mutationOptions());
	const undoImport = useMutation(orpc.imports.undo.mutationOptions());

	/** Do it, refresh what is on screen, say what happened. */
	const run = async <T>(
		work: () => Promise<T>,
		done: (result: T) => Snack | string,
		failed: string,
	): Promise<boolean> => {
		try {
			const result = await work();
			await refresh();
			snack(done(result));
			return true;
		} catch (error) {
			// Often someone else got there first: show what is true now.
			void refresh();
			snack(errorWords(error, failed));
			return false;
		}
	};

	/** A snackbar whose Undo takes the answer back, so the question returns. */
	const undoable = (message: string, undo: () => Promise<unknown>): Snack => ({
		message,
		actionLabel: QUESTIONS.undo,
		onAction: () => void run(undo, () => QUESTIONS.undone, QUESTIONS.undoFailed),
	});

	return {
		answerLine: (question, answer) =>
			run(
				() => answerLedgerLine.mutateAsync({ lineId: question.lineId, answer }),
				({ cashFlowId }) =>
					undoable(
						QUESTIONS.ledgerLine.done(ledgerMoney(question.amount), formatDate(question.date), answer),
						() => changeLedgerLine.mutateAsync({ cashFlowId }),
					),
				QUESTIONS.answerFailed,
			),

		explainOpening: (question) =>
			run(
				() => explainOpening.mutateAsync({ accountId: question.account.id }),
				({ cashFlowId }) =>
					undoable(QUESTIONS.opening.done(ledgerMoney(question.amount), formatDate(question.date)), () =>
						changeLedgerLine.mutateAsync({ cashFlowId }),
					),
				QUESTIONS.answerFailed,
			),

		// The server has no way to take an ISIN back, so this one has no Undo.
		giveIsin: (question, isin) =>
			run(
				() => giveIsin.mutateAsync({ rawTradeId: question.rawTradeId, isin }),
				() => QUESTIONS.isin.done(question.symbol),
				QUESTIONS.answerFailed,
			),

		answerTransfer: (question, same) =>
			run(
				() => transfer.mutateAsync({ outFlowId: question.out.flowId, inFlowId: question.in.flowId, same }),
				({ linkId }) =>
					undoable(
						same ? QUESTIONS.transfer.paired(ledgerMoney(question.in.amount)) : QUESTIONS.transfer.apart,
						() => undoTransfer.mutateAsync({ linkId }),
					),
				QUESTIONS.answerFailed,
			),

		applyAction: (question, oneBecomes) =>
			run(
				() =>
					applyCorporateAction.mutateAsync({
						accountId: question.account.id,
						actionId: question.actionId,
						...(oneBecomes === undefined ? {} : { oneBecomes }),
					}),
				({ applicationId }) => {
					const after =
						question.quantityAfter ??
						(oneBecomes === undefined ? null : String(Number(question.quantityBefore) * oneBecomes));
					return undoable(
						after === null
							? QUESTIONS.action.appliedPlain(question.symbol)
							: QUESTIONS.action.applied(
									question.actionType,
									question.symbol,
									formatQuantity(question.quantityBefore),
									formatQuantity(after),
								),
						() => undoCorporateAction.mutateAsync({ applicationId }),
					);
				},
				QUESTIONS.answerFailed,
			),

		declineAction: (question) =>
			run(
				() =>
					declineCorporateAction.mutateAsync({
						accountId: question.account.id,
						actionId: question.actionId,
					}),
				({ applicationId }) =>
					undoable(QUESTIONS.action.declined(question.symbol), () =>
						undoCorporateAction.mutateAsync({ applicationId }),
					),
				QUESTIONS.answerFailed,
			),

		recordSplit: (question, input) =>
			run(
				() => recordCorporateAction.mutateAsync({ accountId: question.account.id, ...input }),
				({ applicationId }) =>
					undoable(QUESTIONS.mismatch.recorded(question.symbol), () =>
						undoCorporateAction.mutateAsync({ applicationId }),
					),
				QUESTIONS.answerFailed,
			),

		// Nor can a dismissal be taken back — the card asks before doing it.
		dismissMismatch: (question) =>
			run(
				() =>
					dismissHoldingMismatch.mutateAsync({
						accountId: question.account.id,
						symbol: question.symbol,
						asOf: question.asOf,
					}),
				() => QUESTIONS.mismatch.dismissed(question.symbol),
				QUESTIONS.answerFailed,
			),

		undoApplied: (action) =>
			run(
				() => undoCorporateAction.mutateAsync({ applicationId: action.applicationId }),
				() => SPLITS.undone(action.symbol, QUESTIONS.action.noun(action.actionType)),
				SPLITS.undoFailed,
			),

		undoUpload: (upload) =>
			run(
				() => undoImport.mutateAsync({ batchId: upload.batchId }),
				() => UPLOADS.undoneSnack(upload.fileName ?? UPLOADS.unnamed, upload.added),
				UPLOADS.undoFailed,
			),
	};
};
