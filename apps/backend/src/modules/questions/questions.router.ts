import {
	applyAction,
	declineAction,
	dismissMismatch,
	listAppliedActions,
	recordAction,
	undoApplication,
} from "@backend/modules/corporate-actions/services/corporate_actions.service";
import {
	answerIsin,
	answerLine,
	answerTransfer,
	changeLine,
	explainOpeningBalance,
	listQuestions,
	undoTransferAnswer,
} from "@backend/modules/questions/questions.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import {
	appliedActionZod,
	applyActionInputZod,
	lineAnswerZod,
	questionListInputZod,
	questionZod,
	recordActionInputZod,
} from "@connected-repo/zod-schemas/kosh/statements.zod";
import { z } from "zod";

// What Kosh could not work out by itself. Anyone who can see an account sees
// its questions; answering needs edit (on both accounts, for a transfer).

const ok = z.object({ ok: z.literal(true) });

const list = rpcPortfolioProcedure
	.input(questionListInputZod)
	.output(z.array(questionZod))
	.handler(({ input }) => listQuestions(input));

// "What was this ledger line?"
const answerLedgerLine = rpcPortfolioProcedure
	.input(z.object({ lineId: z.string(), answer: lineAnswerZod }))
	.output(z.object({ cashFlowId: z.string() }))
	.handler(({ input }) => answerLine(input));

// Change what a line was said (or worked out) to be; without an answer, take it back.
const changeLedgerLine = rpcPortfolioProcedure
	.input(z.object({ cashFlowId: z.string(), answer: lineAnswerZod.optional() }))
	.output(z.object({ cashFlowId: z.string().nullable() }))
	.handler(({ input }) => changeLine(input));

// "The account already held this when its ledger starts."
const explainOpening = rpcPortfolioProcedure
	.input(z.object({ accountId: z.string() }))
	.output(z.object({ cashFlowId: z.string() }))
	.handler(({ input }) => explainOpeningBalance(input.accountId));

const giveIsin = rpcPortfolioProcedure
	.input(z.object({ rawTradeId: z.string(), isin: z.string().max(20) }))
	.output(z.object({ tradeId: z.string() }))
	.handler(({ input }) => answerIsin(input));

// "Is this the same money moving between two accounts?"
const transfer = rpcPortfolioProcedure
	.input(z.object({ outFlowId: z.string(), inFlowId: z.string(), same: z.boolean() }))
	.output(z.object({ linkId: z.string() }))
	.handler(({ input }) => answerTransfer(input));

const undoTransfer = rpcPortfolioProcedure
	.input(z.object({ linkId: z.string() }))
	.output(ok)
	.handler(async ({ input }) => {
		await undoTransferAnswer(input.linkId);
		return { ok: true as const };
	});

// ─── Splits and bonuses ─────────────────────────────────────────────────

const application = z.object({ applicationId: z.string() });

// "Yes, this happened to this account" — with the ratio, if the announcement's could not be read.
const applyCorporateAction = rpcPortfolioProcedure
	.input(applyActionInputZod)
	.output(application)
	.handler(({ input }) => applyAction(input));

// "Not for this account."
const declineCorporateAction = rpcPortfolioProcedure
	.input(applyActionInputZod.pick({ accountId: true, actionId: true }))
	.output(application)
	.handler(({ input }) => declineAction(input));

// A split or bonus the exchange's feed does not have, for this account only.
const recordCorporateAction = rpcPortfolioProcedure
	.input(recordActionInputZod)
	.output(application)
	.handler(({ input }) => recordAction(input));

// Take a split, bonus or "not for this account" back. It becomes a question again.
const undoCorporateAction = rpcPortfolioProcedure
	.input(application)
	.output(ok)
	.handler(async ({ input }) => {
		await undoApplication(input.applicationId);
		return { ok: true as const };
	});

// The splits and bonuses standing on an account.
const corporateActions = rpcPortfolioProcedure
	.input(z.object({ accountId: z.string() }))
	.output(z.array(appliedActionZod))
	.handler(({ input }) => listAppliedActions(input.accountId));

// "I know the statement differs" — stop asking about this share for this statement.
const dismissHoldingMismatch = rpcPortfolioProcedure
	.input(z.object({ accountId: z.string(), symbol: z.string().max(60), asOf: z.iso.date() }))
	.output(ok)
	.handler(async ({ input }) => {
		await dismissMismatch(input);
		return { ok: true as const };
	});

export const questionsRouter = {
	applyCorporateAction,
	declineCorporateAction,
	recordCorporateAction,
	undoCorporateAction,
	corporateActions,
	dismissHoldingMismatch,
	list,
	answerLedgerLine,
	changeLedgerLine,
	explainOpening,
	giveIsin,
	transfer,
	undoTransfer,
};
