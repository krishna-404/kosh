import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import type { StatementPreview } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { UPLOAD } from "@frontend/copy/statements.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useRefreshMoney } from "@frontend/modules/money/money.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { fileProblem, fileToBase64, isUsableDay } from "./statements.utils";
import type { StatementActions } from "./useStatementActions";

/** Where an upload stands. Nothing is saved before `apply`. */
export type UploadStep =
	| { step: "idle" }
	/** The file is being read and sent for checking. */
	| { step: "reading"; fileName: string }
	/** Kosh has said what the file holds and what adding it would do. */
	| {
			step: "checked";
			fileName: string;
			contentBase64: string;
			preview: StatementPreview;
			/** A holdings statement that does not say its day: the person gives it. */
			needsDate: boolean;
			asOf: string;
	  }
	/** The file never reached a verdict: too big, empty, or the request failed. */
	| { step: "failed"; fileName: string; message: string };

export interface UploadFlow {
	state: UploadStep;
	/** Checking again (after a date was given) or adding the lines. */
	busy: "checking" | "adding" | null;
	/** Why adding failed, when it did. */
	applyError: string | null;
	choose: (file: File) => void;
	setAsOf: (date: string) => void;
	apply: () => void;
	close: () => void;
}

/**
 * One upload from file to ledger: read the file, ask the server what it
 * holds (`imports/preview`, which changes nothing), and only on the
 * person's say-so put it in (`imports/apply`). Afterwards a snackbar says
 * what was added and offers Undo.
 */
export const useUploadFlow = (
	accountId: string,
	actions: StatementActions,
	/** Called once a file is in, with how many questions it raised. */
	onAdded?: (questions: number) => void,
): UploadFlow => {
	const snack = useSnack();
	const refresh = useRefreshMoney();
	const preview = useMutation(orpc.imports.preview.mutationOptions());
	const applyStatement = useMutation(orpc.imports.apply.mutationOptions());

	const [state, setState] = useState<UploadStep>({ step: "idle" });
	const [busy, setBusy] = useState<UploadFlow["busy"]>(null);
	const [applyError, setApplyError] = useState<string | null>(null);
	// Each file chosen gets a number; an answer for an older one is dropped.
	const turn = useRef(0);

	const close = useCallback(() => {
		turn.current += 1;
		setState({ step: "idle" });
		setBusy(null);
		setApplyError(null);
	}, []);

	const choose = (file: File) => {
		const mine = ++turn.current;
		const fileName = file.name.trim().slice(0, 255) || UPLOAD.fallbackName;
		setApplyError(null);
		setBusy(null);
		const problem = fileProblem(file);
		if (problem)
			return setState({
				step: "failed",
				fileName,
				message: problem === "empty" ? UPLOAD.emptyFile : UPLOAD.tooBig,
			});
		setState({ step: "reading", fileName });
		void (async () => {
			let contentBase64: string;
			try {
				contentBase64 = await fileToBase64(file);
			} catch {
				if (mine === turn.current) setState({ step: "failed", fileName, message: UPLOAD.readFailed });
				return;
			}
			try {
				const result = await preview.mutateAsync({ accountId, fileName, contentBase64 });
				if (mine === turn.current)
					setState({
						step: "checked",
						fileName,
						contentBase64,
						preview: result,
						needsDate: result.problem?.code === "needs_date",
						asOf: "",
					});
			} catch (error) {
				if (mine === turn.current)
					setState({ step: "failed", fileName, message: errorWords(error, UPLOAD.previewFailed) });
			}
		})();
	};

	const setAsOf = (date: string) => {
		if (state.step !== "checked") return;
		const checked = state;
		setState({ ...checked, asOf: date });
		if (!isUsableDay(date)) return;
		const mine = turn.current;
		setBusy("checking");
		void (async () => {
			try {
				const result = await preview.mutateAsync({
					accountId,
					fileName: checked.fileName,
					contentBase64: checked.contentBase64,
					asOf: date,
				});
				if (mine === turn.current) setState({ ...checked, asOf: date, preview: result });
			} catch (error) {
				if (mine === turn.current) setApplyError(errorWords(error, UPLOAD.previewFailed));
			} finally {
				if (mine === turn.current) setBusy(null);
			}
		})();
	};

	const apply = () => {
		if (state.step !== "checked" || !state.preview.canApply || busy) return;
		if (state.needsDate && !isUsableDay(state.asOf)) return;
		const checked = state;
		const mine = turn.current;
		setBusy("adding");
		setApplyError(null);
		void (async () => {
			try {
				const applied = await applyStatement.mutateAsync({
					accountId,
					fileName: checked.fileName,
					contentBase64: checked.contentBase64,
					...(checked.needsDate ? { asOf: checked.asOf } : {}),
				});
				await refresh();
				snack({
					message: UPLOAD.added(checked.fileName, applied.added, applied.questions),
					actionLabel: UPLOAD.undo,
					onAction: () =>
						void actions.undoUpload({ batchId: applied.batchId, fileName: checked.fileName, added: applied.added }),
				});
				if (mine === turn.current) close();
				onAdded?.(applied.questions);
			} catch (error) {
				if (mine !== turn.current) return;
				setApplyError(errorWords(error, UPLOAD.applyFailed));
				setBusy(null);
			}
		})();
	};

	return { state, busy, applyError, choose, setAsOf, apply, close };
};
