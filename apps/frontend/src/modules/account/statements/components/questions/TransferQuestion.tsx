import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { IconSwap } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS } from "@frontend/copy/statements.copy";
import { type ReactNode, useState } from "react";
import { ledgerMoney } from "../../statements.utils";
import type { StatementActions } from "../../useStatementActions";
import { Num, QuestionCard, type QuestionFlow } from "../QuestionCard";

type Transfer = Extract<Question, { kind: "transfer" }>;

interface TransferQuestionProps {
	question: Transfer;
	answerable: boolean;
	actions: StatementActions;
	flow: QuestionFlow;
	eyebrow?: ReactNode;
	note?: string;
}

/**
 * One side of the move: which way, which account, when, how much. Laid out
 * as columns for the eye, and said as one sentence to a screen reader.
 */
const Leg = ({ way, leg }: { way: "out" | "in"; leg: Transfer["out"] }) => (
	<Box
		component="li"
		sx={{
			position: "relative",
			display: "flex",
			flexWrap: "wrap",
			alignItems: "baseline",
			columnGap: 1.5,
			rowGap: 0.25,
			px: 1.75,
			py: 1.25,
		}}
	>
		<Box
			component="span"
			sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}
		>
			{(way === "out" ? QUESTIONS.transfer.left : QUESTIONS.transfer.arrived)(
				ledgerMoney(leg.amount),
				leg.account.label,
				formatDate(leg.date),
			)}
		</Box>
		<Typography variant="caption" aria-hidden sx={{ width: 56, flex: "none", fontWeight: 700 }}>
			{QUESTIONS.transfer[way]}
		</Typography>
		<Typography variant="subtitle2" component="span" aria-hidden sx={{ flex: "1 1 140px", minWidth: 0 }}>
			{leg.account.label}
		</Typography>
		<Typography variant="body2" component="span" aria-hidden>
			<Num>{formatDate(leg.date)}</Num>
		</Typography>
		<Typography variant="body2" component="span" aria-hidden sx={{ minWidth: 96, ml: "auto", textAlign: "right" }}>
			<Num strong>{ledgerMoney(leg.amount)}</Num>
		</Typography>
	</Box>
);

/**
 * Money left one account and the same amount arrived in another a day or
 * two later. "Yes" pairs the two lines; "No" keeps them as a withdrawal and
 * a deposit.
 */
export const TransferQuestion = ({ question, answerable, actions, flow, eyebrow, note }: TransferQuestionProps) => {
	const [busy, setBusy] = useState(false);

	const answer = async (same: boolean) => {
		setBusy(true);
		await actions.answerTransfer(question, same);
		setBusy(false);
	};

	return (
		<QuestionCard
			mark={<IconSwap />}
			title={QUESTIONS.transfer.title}
			eyebrow={eyebrow}
			flow={flow}
			note={note}
			actions={
				answerable ? (
					<>
						<Button variant="outlined" onClick={() => void answer(false)} disabled={busy}>
							{QUESTIONS.transfer.no}
						</Button>
						<Button variant="contained" onClick={() => void answer(true)} disabled={busy}>
							{QUESTIONS.transfer.yes}
						</Button>
					</>
				) : undefined
			}
		>
			<Box
				component="ul"
				sx={(theme) => ({
					m: 0,
					p: 0,
					listStyle: "none",
					border: `1px solid ${theme.vars.palette.kosh.line}`,
					borderRadius: "12px",
					"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
				})}
			>
				<Leg way="out" leg={question.out} />
				<Leg way="in" leg={question.in} />
			</Box>
			<Typography variant="body2">{QUESTIONS.transfer.effect}</Typography>
		</QuestionCard>
	);
};
