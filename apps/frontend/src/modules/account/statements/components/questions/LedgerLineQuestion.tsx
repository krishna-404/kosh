import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { IconFile } from "@connected-repo/ui-mui/kosh/icons";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import type { LineAnswer, Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { LINE_ANSWER_EFFECT, LINE_ANSWER_LABEL, QUESTIONS } from "@frontend/copy/statements.copy";
import { type ReactNode, useState } from "react";
import { answersFor, ledgerMoney, lineSide } from "../../statements.utils";
import type { StatementActions } from "../../useStatementActions";
import { Num, QuestionCard, type QuestionFlow } from "../QuestionCard";

interface LedgerLineQuestionProps {
	question: Extract<Question, { kind: "ledger_line" }>;
	answerable: boolean;
	actions: StatementActions;
	flow: QuestionFlow;
	eyebrow?: ReactNode;
	/** "Save answer", or "Save and go to next" when stepping through on a phone. */
	saveLabel: string;
	note?: string;
}

/** "What was this ledger line?" — the line as the statement has it, and the plain-words answers. */
export const LedgerLineQuestion = ({ question, answerable, actions, flow, eyebrow, saveLabel, note }: LedgerLineQuestionProps) => {
	const [answer, setAnswer] = useState<LineAnswer | null>(null);
	const [unchosen, setUnchosen] = useState(false);
	const [busy, setBusy] = useState(false);

	const save = async () => {
		if (answer === null) return setUnchosen(true);
		setBusy(true);
		await actions.answerLine(question, answer);
		setBusy(false);
	};

	return (
		<QuestionCard
			mark={<IconFile />}
			title={QUESTIONS.ledgerLine.title}
			eyebrow={eyebrow}
			flow={flow}
			detail={
				<>
					<Num>{formatDate(question.date)}</Num>
					{" · "}
					<Num strong>{ledgerMoney(question.amount)}</Num> {QUESTIONS.ledgerLine[lineSide(question.amount)]}
					{` · “${question.narration}”`}
				</>
			}
			tag={<Tag>{QUESTIONS.ledgerLine.countedNow}</Tag>}
			note={note}
			actions={
				answerable ? (
					<Button variant="contained" onClick={() => void save()} disabled={busy}>
						{saveLabel}
					</Button>
				) : undefined
			}
		>
			{answerable && (
				<>
					<FilterChips<LineAnswer>
						ariaLabel={QUESTIONS.ledgerLine.chips}
						showCheck
						value={answer}
						onChange={(next) => {
							setAnswer(next);
							setUnchosen(false);
						}}
						options={answersFor(question.amount).map((value) => ({ value, label: LINE_ANSWER_LABEL[value] }))}
						// Every answer stays in sight: these wrap on a phone rather than scroll away.
						sx={{ flexWrap: { xs: "wrap" }, overflowX: { xs: "visible" } }}
					/>
					<Typography
						variant="body2"
						role="status"
						sx={[
							{ "&:empty": { display: "none" } },
							unchosen && ((theme) => ({ color: theme.vars.palette.kosh.dangerText, fontWeight: 600 })),
						]}
					>
						{answer !== null ? LINE_ANSWER_EFFECT[answer] : unchosen ? QUESTIONS.ledgerLine.chooseFirst : null}
					</Typography>
				</>
			)}
		</QuestionCard>
	);
};
