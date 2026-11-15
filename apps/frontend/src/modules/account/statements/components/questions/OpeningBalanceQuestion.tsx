import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import type { Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS } from "@frontend/copy/statements.copy";
import { type ReactNode, useState } from "react";
import { ledgerMoney } from "../../statements.utils";
import type { StatementActions } from "../../useStatementActions";
import { QuestionCard, type QuestionFlow } from "../QuestionCard";

interface OpeningBalanceQuestionProps {
	question: Extract<Question, { kind: "opening_balance" }>;
	answerable: boolean;
	actions: StatementActions;
	flow: QuestionFlow;
	eyebrow?: ReactNode;
	/** Take the person to the upload area — the other way to settle this. */
	onUpload: () => void;
	note?: string;
}

/**
 * The ledger starts with money already in the account. Either the earlier
 * ledger is uploaded, or the balance is counted as put in on its first day —
 * and the card says what that second choice leaves unknown.
 */
export const OpeningBalanceQuestion = ({
	question,
	answerable,
	actions,
	flow,
	eyebrow,
	onUpload,
	note,
}: OpeningBalanceQuestionProps) => {
	const [busy, setBusy] = useState(false);
	const amount = ledgerMoney(question.amount);
	const date = formatDate(question.date);
	// Only money already *in* the account can be counted as put in.
	const countable = Number(question.amount) > 0;

	const count = async () => {
		setBusy(true);
		await actions.explainOpening(question);
		setBusy(false);
	};

	return (
		<QuestionCard
			mark="₹"
			title={QUESTIONS.opening.title}
			eyebrow={eyebrow}
			flow={flow}
			detail={countable ? QUESTIONS.opening.body(amount, date) : QUESTIONS.opening.short(amount, date)}
			note={note}
			actions={
				answerable ? (
					<>
						<Button variant="outlined" onClick={onUpload} disabled={busy}>
							{QUESTIONS.opening.uploadEarlier}
						</Button>
						{countable && (
							<Button variant="contained" onClick={() => void count()} disabled={busy}>
								{QUESTIONS.opening.count}
							</Button>
						)}
					</>
				) : undefined
			}
		>
			{/* The choices, and what each leaves unknown — for whoever can make them. */}
			{answerable && countable && (
				<>
					<Typography variant="body2">{QUESTIONS.opening.effect(amount, date)}</Typography>
					<Typography variant="body2">{QUESTIONS.opening.earlier}</Typography>
				</>
			)}
		</QuestionCard>
	);
};
