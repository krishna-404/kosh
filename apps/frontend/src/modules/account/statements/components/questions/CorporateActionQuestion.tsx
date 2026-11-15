import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { IconTrend } from "@connected-repo/ui-mui/kosh/icons";
import type { Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS } from "@frontend/copy/statements.copy";
import { type ReactNode, useState } from "react";
import { formatQuantity, parseRatio, quantityAfter, ratioMark } from "../../statements.utils";
import type { StatementActions } from "../../useStatementActions";
import { QuestionCard, type QuestionFlow } from "../QuestionCard";

interface CorporateActionQuestionProps {
	question: Extract<Question, { kind: "corporate_action" }>;
	answerable: boolean;
	actions: StatementActions;
	flow: QuestionFlow;
	eyebrow?: ReactNode;
	note?: string;
}

/**
 * A split or bonus Kosh did not apply by itself: what the exchange announced,
 * in its own words, and what it does to this account. When the ratio could
 * not be read, the person gives it.
 */
export const CorporateActionQuestion = ({ question, answerable, actions, flow, eyebrow, note }: CorporateActionQuestionProps) => {
	const [ratio, setRatio] = useState("");
	const [invalid, setInvalid] = useState(false);
	const [busy, setBusy] = useState(false);

	const needsRatio = question.quantityAfter === null;
	const typed = parseRatio(ratio);
	const before = formatQuantity(question.quantityBefore);

	const apply = async () => {
		if (needsRatio && typed === null) return setInvalid(true);
		setBusy(true);
		await actions.applyAction(question, needsRatio && typed !== null ? typed : undefined);
		setBusy(false);
	};
	const decline = async () => {
		setBusy(true);
		await actions.declineAction(question);
		setBusy(false);
	};

	return (
		<QuestionCard
			mark={ratioMark(question.announcement) ?? <IconTrend />}
			title={QUESTIONS.action.title(question.actionType)}
			eyebrow={eyebrow}
			flow={flow}
			detail={
				<>
					{(question.why === "unclear" ? QUESTIONS.action.announced : QUESTIONS.action.stated)(
						question.symbol,
						question.announcement,
						formatDate(question.exDate),
					)}{" "}
					{question.quantityAfter !== null
						? QUESTIONS.action.heldNow(before, formatQuantity(question.quantityAfter))
						: typed !== null
							? QUESTIONS.action.heldWould(before, quantityAfter(question.quantityBefore, typed))
							: QUESTIONS.action.held(before)}
				</>
			}
			note={note}
			actions={
				answerable ? (
					<>
						<Button variant="outlined" onClick={() => void decline()} disabled={busy}>
							{QUESTIONS.action.decline}
						</Button>
						<Button variant="contained" onClick={() => void apply()} disabled={busy}>
							{QUESTIONS.action.apply(question.actionType)}
						</Button>
					</>
				) : undefined
			}
		>
			<Typography variant="caption" component="p" sx={{ m: 0 }}>
				{QUESTIONS.action.why[question.why]}
			</Typography>
			{answerable && needsRatio && (
				<>
					<Typography variant="body2">{QUESTIONS.action.ratioMissing}</Typography>
					<TextField
						label={QUESTIONS.action.ratioLabel}
						value={ratio}
						onChange={(event) => {
							setRatio(event.target.value);
							setInvalid(false);
						}}
						error={invalid}
						helperText={invalid ? QUESTIONS.action.ratioInvalid : QUESTIONS.action.ratioHelper}
						autoComplete="off"
						slotProps={{ htmlInput: { inputMode: "decimal" } }}
						sx={{ width: "100%", maxWidth: 280 }}
					/>
				</>
			)}
		</QuestionCard>
	);
};
