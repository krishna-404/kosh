import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { IconAlert } from "@connected-repo/ui-mui/kosh/icons";
import { ConfirmDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS } from "@frontend/copy/statements.copy";
import { type ReactNode, useState } from "react";
import { formatQuantity, isUsableDay, parseRatio, timesWords } from "../../statements.utils";
import type { StatementActions } from "../../useStatementActions";
import { Num, QuestionCard, type QuestionFlow } from "../QuestionCard";

interface HoldingMismatchQuestionProps {
	question: Extract<Question, { kind: "holding_mismatch" }>;
	answerable: boolean;
	actions: StatementActions;
	flow: QuestionFlow;
	eyebrow?: ReactNode;
	note?: string;
}

/** One of the two quantities that disagree. */
const Side = ({ label, quantity }: { label: string; quantity: string }) => (
	<Box sx={{ flex: "1 1 140px", minWidth: 0, px: 1.75, py: 1.25 }}>
		<Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
			{label}
		</Typography>
		<Typography variant="h3" component="div">
			<Num>{formatQuantity(quantity)}</Num>
		</Typography>
	</Box>
);

/**
 * The broker's holdings statement says one quantity, Kosh's working another.
 * Both are shown. When one is a clean multiple of the other, the likely
 * cause is a split or bonus Kosh does not know of — it can be recorded here,
 * with its ratio and day. Otherwise the person can tell Kosh to stop asking.
 */
export const HoldingMismatchQuestion = ({ question, answerable, actions, flow, eyebrow, note }: HoldingMismatchQuestionProps) => {
	// A split or bonus can only be recorded for a share Kosh has trades for.
	const recordable = question.likelyFactor !== null && question.instrumentId !== null;
	const [ratio, setRatio] = useState(question.likelyFactor === null ? "" : String(question.likelyFactor));
	const [exDate, setExDate] = useState("");
	const [missing, setMissing] = useState<{ ratio: boolean; date: boolean }>({ ratio: false, date: false });
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);

	const record = async () => {
		const oneBecomes = parseRatio(ratio);
		const dated = isUsableDay(exDate, question.asOf);
		if (oneBecomes === null || !dated || question.instrumentId === null)
			return setMissing({ ratio: oneBecomes === null, date: !dated });
		setBusy(true);
		await actions.recordSplit(question, { instrumentId: question.instrumentId, exDate, oneBecomes });
		setBusy(false);
	};
	const dismiss = async () => {
		setBusy(true);
		await actions.dismissMismatch(question);
		setBusy(false);
		setConfirming(false);
	};

	return (
		<QuestionCard
			mark="≠"
			title={QUESTIONS.mismatch.title(question.symbol)}
			eyebrow={eyebrow}
			flow={flow}
			note={note}
			actions={
				answerable ? (
					<>
						<Button variant={recordable ? "text" : "outlined"} onClick={() => setConfirming(true)} disabled={busy}>
							{QUESTIONS.mismatch.dismiss}
						</Button>
						{recordable && (
							<Button variant="contained" onClick={() => void record()} disabled={busy}>
								{QUESTIONS.mismatch.record}
							</Button>
						)}
					</>
				) : undefined
			}
		>
			<Box
				sx={(theme) => ({
					display: "flex",
					flexWrap: "wrap",
					border: `1px solid ${theme.vars.palette.kosh.line}`,
					borderRadius: "12px",
				})}
			>
				<Side label={QUESTIONS.mismatch.statementSays(formatDate(question.asOf))} quantity={question.reported} />
				<Side label={QUESTIONS.mismatch.koshSays} quantity={question.expected} />
			</Box>
			<Typography variant="body2">
				{question.likelyFactor !== null
					? QUESTIONS.mismatch.likely(timesWords(question.likelyFactor))
					: question.instrumentId === null
						? `${QUESTIONS.mismatch.noTrades} ${QUESTIONS.mismatch.unknown}`
						: QUESTIONS.mismatch.unknown}
			</Typography>
			{answerable && recordable && (
				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
					<TextField
						label={QUESTIONS.mismatch.ratioLabel}
						value={ratio}
						onChange={(event) => {
							setRatio(event.target.value);
							setMissing((was) => ({ ...was, ratio: false }));
						}}
						error={missing.ratio}
						helperText={missing.ratio ? QUESTIONS.action.ratioInvalid : QUESTIONS.action.ratioHelper}
						autoComplete="off"
						slotProps={{ htmlInput: { inputMode: "decimal" } }}
						sx={{ flex: "1 1 200px", maxWidth: 320 }}
					/>
					<TextField
						label={QUESTIONS.mismatch.dateLabel}
						type="date"
						value={exDate}
						onChange={(event) => {
							setExDate(event.target.value);
							setMissing((was) => ({ ...was, date: false }));
						}}
						error={missing.date}
						helperText={missing.date ? QUESTIONS.mismatch.dateMissing(formatDate(question.asOf)) : QUESTIONS.mismatch.dateHelper}
						slotProps={{ htmlInput: { max: question.asOf } }}
						sx={{ flex: "1 1 200px", maxWidth: 320 }}
					/>
				</Box>
			)}
			<ConfirmDialog
				open={confirming}
				icon={<IconAlert />}
				title={QUESTIONS.mismatch.confirmTitle(question.symbol)}
				confirmLabel={QUESTIONS.mismatch.confirm}
				cancelLabel={QUESTIONS.mismatch.keep}
				busy={busy}
				onConfirm={() => void dismiss()}
				onCancel={() => setConfirming(false)}
			>
				{QUESTIONS.mismatch.confirmBody(
					question.symbol,
					formatQuantity(question.expected),
					formatDate(question.asOf),
				)}
			</ConfirmDialog>
		</QuestionCard>
	);
};
