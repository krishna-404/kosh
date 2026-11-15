import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconCheck, IconClock } from "@connected-repo/ui-mui/kosh/icons";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS, STATEMENTS } from "@frontend/copy/statements.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { type ReactNode, useState } from "react";
import { useQuestions } from "../statements.queries";
import { orderQuestions } from "../statements.utils";
import type { StatementActions } from "../useStatementActions";
import type { QuestionFlow } from "./QuestionCard";
import { CorporateActionQuestion } from "./questions/CorporateActionQuestion";
import { HoldingMismatchQuestion } from "./questions/HoldingMismatchQuestion";
import { LedgerLineQuestion } from "./questions/LedgerLineQuestion";
import { MissingIsinQuestion } from "./questions/MissingIsinQuestion";
import { OpeningBalanceQuestion } from "./questions/OpeningBalanceQuestion";
import { TransferQuestion } from "./questions/TransferQuestion";

interface QuestionsSectionProps {
	accountId: string;
	canEdit: boolean;
	/** One at a time, as on the phone board, rather than the whole list. */
	phone: boolean;
	/** Whether the account has any statement at all: without one there is nothing to have checked. */
	hasUploads: boolean;
	actions: StatementActions;
	/** Take the person to the upload area. */
	onUpload: () => void;
}

/**
 * What Kosh is not sure of, one card per question. Nothing here is guessed
 * silently: until a question is answered the figures use Kosh's best guess,
 * and the heading says so.
 */
export const QuestionsSection = ({ accountId, canEdit, phone, hasUploads, actions, onUpload }: QuestionsSectionProps) => {
	const questions = useQuestions(accountId);
	// Put off for this visit — they stay questions, just further down.
	const [skipped, setSkipped] = useState<string[]>([]);

	if (questions.isPending) return <Skeleton variant="rounded" height={148} sx={{ borderRadius: 2 }} />;
	if (questions.isError)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void questions.refetch()}>
						{STATEMENTS.retry}
					</Button>
				}
			>
				{errorWords(questions.error, QUESTIONS.loadFailed)}
			</Banner>
		);

	const ordered = orderQuestions(questions.data, skipped);
	const total = ordered.length;

	if (total === 0)
		// Quietly — and only once there is something that has been checked.
		return hasUploads ? (
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 0.5 }}>
				<Box
					aria-hidden
					sx={(theme) => ({ display: "grid", color: theme.vars.palette.kosh.accentText, "& svg": { fontSize: 20 } })}
				>
					<IconCheck />
				</Box>
				<Typography variant="body2">
					<Typography component="b" variant="subtitle2" sx={{ color: "text.primary" }}>
						{QUESTIONS.none.title}
					</Typography>
					{` — ${QUESTIONS.none.body}`}
				</Typography>
			</Box>
		) : null;

	// On a phone someone who can answer goes through them one by one; a list for everyone else.
	const stepping = phone && canEdit;
	const shown = stepping ? ordered.slice(0, 1) : ordered;
	const skip = (id: string) => setSkipped((was) => [...was.filter((other) => other !== id), id]);

	const card = (question: Question, position: number): ReactNode => {
		const answerable = canEdit && question.canAnswer;
		const flow: QuestionFlow = { stepping, onSkip: total > 1 ? () => skip(question.id) : undefined };
		const eyebrow = stepping ? (
			<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
				<Typography variant="subtitle2" component="span">
					{QUESTIONS.position(position, total)}
				</Typography>
				{answerable && <Tag tone="pending">{QUESTIONS.needsYou}</Tag>}
			</Box>
		) : !phone && skipped.includes(question.id) ? (
			<Tag sx={{ alignSelf: "flex-start" }}>{QUESTIONS.skipped}</Tag>
		) : undefined;
		// Said once in the banner for someone who can only look; said on the card when it is this question alone.
		const note = answerable || !canEdit ? undefined : question.kind === "transfer" ? QUESTIONS.cannotAnswerBoth : QUESTIONS.cannotAnswer;
		const common = { answerable, actions, flow, eyebrow, note };

		switch (question.kind) {
			case "ledger_line":
				return (
					<LedgerLineQuestion
						question={question}
						saveLabel={stepping && total > 1 ? QUESTIONS.saveAndNext : QUESTIONS.save}
						{...common}
					/>
				);
			case "opening_balance":
				return <OpeningBalanceQuestion question={question} onUpload={onUpload} {...common} />;
			case "missing_isin":
				return <MissingIsinQuestion question={question} {...common} />;
			case "transfer":
				return <TransferQuestion question={question} {...common} />;
			case "corporate_action":
				return <CorporateActionQuestion question={question} {...common} />;
			case "holding_mismatch":
				return <HoldingMismatchQuestion question={question} {...common} />;
		}
	};

	return (
		<Box component="section" sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
			{canEdit ? (
				<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 2, rowGap: 0.25 }}>
					<Typography variant="h2">{QUESTIONS.title(total)}</Typography>
					<Typography variant="body2">{QUESTIONS.hint}</Typography>
				</Box>
			) : (
				<Banner tone="warn" icon={<IconClock fontSize="inherit" />} title={QUESTIONS.waitingTitle(total)}>
					{QUESTIONS.waitingHint}
				</Banner>
			)}
			<Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 1.75 }}>
				{shown.map((question) => (
					// Keyed by the question, so a half-typed answer never carries over to the next one.
					// It keeps the number it was asked under, even when others were skipped to reach it.
					<Box component="li" key={question.id}>
						{card(question, questions.data.findIndex((other) => other.id === question.id) + 1)}
					</Box>
				))}
			</Box>
		</Box>
	);
};
