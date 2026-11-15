import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { IconHelp } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS } from "@frontend/copy/statements.copy";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { cleanIsin, isIsin, tradeWords } from "../../statements.utils";
import type { StatementActions } from "../../useStatementActions";
import { QuestionCard, type QuestionFlow } from "../QuestionCard";

interface MissingIsinQuestionProps {
	question: Extract<Question, { kind: "missing_isin" }>;
	answerable: boolean;
	actions: StatementActions;
	flow: QuestionFlow;
	eyebrow?: ReactNode;
	note?: string;
}

/** A trade the broker listed without an ISIN: show the trade, take the ISIN, say what it is for. */
export const MissingIsinQuestion = ({ question, answerable, actions, flow, eyebrow, note }: MissingIsinQuestionProps) => {
	const formId = useId();
	const [isin, setIsin] = useState("");
	const [invalid, setInvalid] = useState(false);
	const [busy, setBusy] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!isIsin(isin)) return setInvalid(true);
		setBusy(true);
		await actions.giveIsin(question, cleanIsin(isin));
		setBusy(false);
	};

	return (
		<QuestionCard
			mark={<IconHelp />}
			title={QUESTIONS.isin.title}
			eyebrow={eyebrow}
			flow={flow}
			detail={QUESTIONS.isin.body(tradeWords(question), formatDate(question.date))}
			note={note}
			actions={
				answerable ? (
					<Button type="submit" form={formId} variant="contained" disabled={busy}>
						{QUESTIONS.isin.save}
					</Button>
				) : undefined
			}
		>
			{answerable && (
				<Box component="form" id={formId} noValidate onSubmit={(event) => void submit(event)}>
					<TextField
						label={QUESTIONS.isin.label}
						placeholder={QUESTIONS.isin.placeholder}
						value={isin}
						onChange={(event) => {
							setIsin(event.target.value.toUpperCase());
							setInvalid(false);
						}}
						error={invalid}
						helperText={invalid ? QUESTIONS.isin.invalid : QUESTIONS.isin.helper}
						autoComplete="off"
						slotProps={{ htmlInput: { maxLength: 14, autoCapitalize: "characters", spellCheck: false } }}
						sx={{ width: "100%", maxWidth: 420 }}
					/>
				</Box>
			)}
		</QuestionCard>
	);
};
