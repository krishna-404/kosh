import { db } from "@backend/db/db";
import {
	compareMoney,
	isZeroMoney,
	mulToMoney,
	negateMoney,
	signedFlowAmount,
	toMoney,
} from "@backend/modules/imports/lib/decimal.imports";
import {
	balanceBefore,
	openingIsExplained,
} from "@backend/modules/imports/services/history.service";
import {
	atLeast,
	inList,
	requireAccess,
	requireAccountLevel,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import type { LineAnswer, Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { ORPCError } from "@orpc/server";

// What Kosh could not work out by itself, put as questions. A question is
// never stored: it is simply a raw row with no interpretation yet, so
// answering one (an event, like everything else) makes it disappear and
// undoing the answer brings it back.

/** Suggest a transfer only for sums that are unlikely to match by chance. */
const TRANSFER_MIN = "1000.00";
/** Money that left one account and arrived in another within this many days. */
const TRANSFER_WINDOW_DAYS = 3;
const DAY_MS = 86_400_000;

const bad = (message: string) => new ORPCError("BAD_REQUEST", { status: 400, message });
const epoch = (date: string) => Date.parse(`${date}T00:00:00Z`);

export async function listQuestions(input: { accountId?: string }): Promise<Question[]> {
	const ctx = requireAccess();
	if (input.accountId) requireAccountLevel(input.accountId, "view");

	const accounts = await db.brokerAccounts.select("id", "label");
	const ref = new Map(accounts.map((a) => [a.id, { id: a.id, label: a.label }]));
	const canAnswer = (accountId: string) => atLeast(ctx.accountLevels.get(accountId), "edit");
	const wanted = input.accountId ? [input.accountId] : accounts.map((a) => a.id);
	const questions: Question[] = [];

	// Ledger lines Kosh did not recognise.
	const lines = await db.rawLedgerLines
		.where({ accountId: { in: inList(wanted) }, isLive: true })
		.whereSql`NOT EXISTS (
			SELECT 1 FROM cash_flows c
			WHERE c.source_ledger_line_id = "raw_ledger_lines"."id" AND c.is_live)`
		.order({ postedDate: "DESC" })
		.select("id", "accountId", "postedDate", "narration", "debit", "credit");
	for (const l of lines) {
		const account = ref.get(l.accountId);
		if (!account) continue;
		questions.push({
			kind: "ledger_line",
			id: `line:${l.id}`,
			account,
			canAnswer: canAnswer(l.accountId),
			lineId: l.id,
			date: l.postedDate,
			narration: l.narration,
			amount: signedFlowAmount(l.debit, l.credit),
		});
	}

	// An account whose first line starts from a balance nobody has explained.
	for (const accountId of wanted) {
		const account = ref.get(accountId);
		if (!account) continue;
		const first = await db.rawLedgerLines
			.where({ accountId, isLive: true })
			.order({ postedDate: "ASC", batchId: "ASC", lineNo: "ASC" })
			.select("postedDate", "debit", "credit", "runningBalance")
			.takeOptional();
		if (!first) continue;
		const opening = balanceBefore(first);
		if (isZeroMoney(opening) || (await openingIsExplained(accountId))) continue;
		questions.push({
			kind: "opening_balance",
			id: `opening:${accountId}`,
			account,
			canAnswer: canAnswer(accountId),
			date: first.postedDate,
			amount: opening,
		});
	}

	// Trades the broker listed without an ISIN.
	const orphans = await db.rawTrades
		.where({ accountId: { in: inList(wanted) }, isLive: true, isin: null })
		.whereSql`NOT EXISTS (
			SELECT 1 FROM trades t WHERE t.raw_trade_id = "raw_trades"."id" AND t.is_live)`
		.order({ tradeDate: "DESC" })
		.select("id", "accountId", "tradeDate", "brokerSymbol", "side", "quantity", "price");
	for (const t of orphans) {
		const account = ref.get(t.accountId);
		if (!account) continue;
		questions.push({
			kind: "missing_isin",
			id: `isin:${t.id}`,
			account,
			canAnswer: canAnswer(t.accountId),
			rawTradeId: t.id,
			date: t.tradeDate,
			symbol: t.brokerSymbol,
			side: t.side,
			quantity: t.quantity,
			price: t.price,
		});
	}

	// Money that left one account the caller can see and, within a few days,
	// the same amount arrived in another: probably the same money.
	const flows = await db.cashFlows
		.where({
			isLive: true,
			classification: { in: ["external_deposit", "external_withdrawal"] },
			origin: "ledger_line",
		})
		.order({ flowDate: "ASC" })
		.select("id", "accountId", "flowDate", "amount", "classification");
	const links = await db.transferLinks
		.where({ isLive: true })
		.select("outFlowId", "inFlowId", "same");
	const settled = new Set(links.filter((l) => l.same).flatMap((l) => [l.outFlowId, l.inFlowId]));
	const refused = new Set(links.filter((l) => !l.same).map((l) => `${l.outFlowId}:${l.inFlowId}`));
	const big = (amount: string) => compareMoney(amount.replace("-", ""), TRANSFER_MIN) >= 0;
	const outs = flows.filter(
		(f) => f.classification === "external_withdrawal" && !settled.has(f.id) && big(f.amount),
	);
	const ins = flows.filter(
		(f) => f.classification === "external_deposit" && !settled.has(f.id) && big(f.amount),
	);
	const taken = new Set<string>();
	for (const out of outs) {
		const match = ins.find(
			(inn) =>
				!taken.has(inn.id) &&
				inn.accountId !== out.accountId &&
				compareMoney(inn.amount, negateMoney(out.amount)) === 0 &&
				epoch(inn.flowDate) >= epoch(out.flowDate) &&
				epoch(inn.flowDate) - epoch(out.flowDate) <= TRANSFER_WINDOW_DAYS * DAY_MS &&
				!refused.has(`${out.id}:${inn.id}`),
		);
		if (!match) continue;
		taken.add(match.id);
		const from = ref.get(out.accountId);
		const to = ref.get(match.accountId);
		if (!from || !to) continue;
		if (input.accountId && input.accountId !== from.id && input.accountId !== to.id) continue;
		questions.push({
			kind: "transfer",
			id: `transfer:${out.id}:${match.id}`,
			account: to,
			canAnswer: canAnswer(from.id) && canAnswer(to.id),
			out: { flowId: out.id, account: from, date: out.flowDate, amount: toMoney(out.amount) },
			in: { flowId: match.id, account: to, date: match.flowDate, amount: toMoney(match.amount) },
		});
	}

	return questions;
}

/** How many questions wait on each account, for people who could answer them. */
export async function countQuestions(): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	for (const q of await listQuestions({}))
		if (q.canAnswer) counts.set(q.account.id, (counts.get(q.account.id) ?? 0) + 1);
	return counts;
}

// ─── Answers ────────────────────────────────────────────────────────────

async function classify(
	line: {
		id: string;
		accountId: string;
		batchId: string;
		postedDate: string;
		debit: string | null;
		credit: string | null;
	},
	answer: LineAnswer,
	userId: string,
): Promise<string> {
	const amount = signedFlowAmount(line.debit, line.credit);
	const cameIn = compareMoney(amount, "0") > 0;
	if (answer === "external_deposit" && !cameIn)
		throw bad("This line took money out of the account, so it can’t be money put in.");
	if (answer === "external_withdrawal" && cameIn)
		throw bad("This line brought money into the account, so it can’t be money taken out.");

	const event = await db.events.create({
		accountId: line.accountId,
		kind: "user_resolution",
		// `batchId` ties the answer to its line's upload: undoing that upload undoes the answer.
		payload: { question: "ledger_line", batchId: line.batchId, rawLedgerLineId: line.id, answer },
		actor: "user",
		userId,
		occurredAt: Date.now(),
	});
	const flow = await db.cashFlows.create({
		accountId: line.accountId,
		flowDate: line.postedDate,
		amount,
		currency: "INR",
		classification: answer,
		sourceLedgerLineId: line.id,
		classifiedEventId: event.id,
		inrAmount: amount,
	});
	return flow.id;
}

const LINE_COLUMNS = ["id", "accountId", "batchId", "postedDate", "debit", "credit"] as const;

/** Say what an unrecognised ledger line was. */
export async function answerLine(input: { lineId: string; answer: LineAnswer }) {
	const { userId } = requireAccess();
	const line = await db.rawLedgerLines
		.where({ id: input.lineId, isLive: true })
		.select(...LINE_COLUMNS)
		.takeOptional();
	if (!line) throw new ORPCError("NOT_FOUND", { status: 404, message: "Line not found" });
	requireAccountLevel(line.accountId, "edit");
	if (await db.cashFlows.where({ sourceLedgerLineId: line.id, isLive: true }).exists())
		throw bad("Someone has already answered this.");
	return db.$transaction(async () => ({ cashFlowId: await classify(line, input.answer, userId) }));
}

/** Take back what a line was said (or worked out) to be; with `answer`, say what it was instead. */
export async function changeLine(input: { cashFlowId: string; answer?: LineAnswer }) {
	const { userId } = requireAccess();
	const flow = await db.cashFlows
		.where({ id: input.cashFlowId, isLive: true })
		.select("id", "accountId", "sourceLedgerLineId", "classifiedEventId", "origin")
		.takeOptional();
	if (!flow) throw new ORPCError("NOT_FOUND", { status: 404, message: "Not found" });
	requireAccountLevel(flow.accountId, "edit");
	if (input.answer !== undefined && flow.origin !== "ledger_line")
		throw bad("This entry stands for the balance the account started with. Remove it instead.");

	return db.$transaction(async () => {
		const retraction = await db.events.create({
			accountId: flow.accountId,
			kind: "retraction",
			payload: { cashFlowId: flow.id },
			actor: "user",
			userId,
			occurredAt: Date.now(),
			reason: input.answer ? "Changed what this was" : "Answer taken back",
		});
		await db.events
			.where({ id: flow.classifiedEventId })
			.update({ supersededByEventId: retraction.id });
		await db.cashFlows.where({ id: flow.id }).update({ isLive: false });
		// A pairing that relied on this entry no longer holds.
		await db.transferLinks
			.where({ isLive: true, OR: [{ outFlowId: flow.id }, { inFlowId: flow.id }] })
			.update({ isLive: false });

		if (input.answer === undefined || flow.sourceLedgerLineId === null) return { cashFlowId: null };
		const line = await db.rawLedgerLines.find(flow.sourceLedgerLineId).select(...LINE_COLUMNS);
		return { cashFlowId: await classify(line, input.answer, userId) };
	});
}

/**
 * "It was money already in the account": count the balance the account
 * started with as put in on the day of its first line, so returns are
 * measured from there. History before that day stays unknown, and says so.
 */
export async function explainOpeningBalance(accountId: string) {
	const { userId } = requireAccess();
	requireAccountLevel(accountId, "edit");
	const first = await db.rawLedgerLines
		.where({ accountId, isLive: true })
		.order({ postedDate: "ASC", batchId: "ASC", lineNo: "ASC" })
		.select("batchId", "postedDate", "debit", "credit", "runningBalance")
		.takeOptional();
	if (!first) throw bad("This account has no ledger yet.");
	const opening = balanceBefore(first);
	if (compareMoney(opening, "0") <= 0)
		throw bad("This account’s ledger doesn’t start with money already in it.");
	if (await openingIsExplained(accountId)) throw bad("Someone has already answered this.");

	return db.$transaction(async () => {
		const event = await db.events.create({
			accountId,
			kind: "user_resolution",
			payload: { question: "opening_balance", batchId: first.batchId, amount: opening },
			actor: "user",
			userId,
			occurredAt: Date.now(),
		});
		const flow = await db.cashFlows.create({
			accountId,
			flowDate: first.postedDate,
			amount: opening,
			currency: "INR",
			classification: "external_deposit",
			sourceLedgerLineId: null,
			classifiedEventId: event.id,
			inrAmount: opening,
			origin: "opening_balance",
		});
		return { cashFlowId: flow.id };
	});
}

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

/** Give the ISIN for a trade the broker listed without one. */
export async function answerIsin(input: { rawTradeId: string; isin: string }) {
	const { userId } = requireAccess();
	const isin = input.isin.trim().toUpperCase();
	if (!ISIN.test(isin)) throw bad("That doesn’t look like an ISIN (12 letters and digits, like INE009A01021).");
	const raw = await db.rawTrades
		.where({ id: input.rawTradeId, isLive: true })
		.select("id", "accountId", "batchId", "tradeDate", "brokerSymbol", "exchange", "side", "quantity", "price")
		.takeOptional();
	if (!raw) throw new ORPCError("NOT_FOUND", { status: 404, message: "Trade not found" });
	requireAccountLevel(raw.accountId, "edit");
	if (await db.trades.where({ rawTradeId: raw.id, isLive: true }).exists())
		throw bad("Someone has already answered this.");

	return db.$transaction(async () => {
		const instrument =
			(await db.instruments.where({ isin }).select("id").takeOptional()) ??
			(await db.instruments.create({
				kind: "equity",
				isin,
				symbolCanonical: raw.brokerSymbol,
				name: raw.brokerSymbol,
				currency: "INR",
				exchangeCalendar: raw.exchange === "NSE" || raw.exchange === "BSE" ? raw.exchange : null,
			}));
		const event = await db.events.create({
			accountId: raw.accountId,
			kind: "trade_recognized",
			payload: { question: "missing_isin", batchId: raw.batchId, rawTradeId: raw.id, isin },
			actor: "user",
			userId,
			occurredAt: epoch(raw.tradeDate),
		});
		const value = mulToMoney(raw.quantity, raw.price);
		const trade = await db.trades.create({
			rawTradeId: raw.id,
			accountId: raw.accountId,
			instrumentId: instrument.id,
			tradeDate: raw.tradeDate,
			side: raw.side,
			quantity: raw.quantity,
			price: raw.price,
			grossValue: value,
			totalCharges: "0.00",
			netValue: value,
			recognizedEventId: event.id,
		});
		return { tradeId: trade.id };
	});
}

/** "Yes, the same money" or "No, they are separate" for two look-alike flows. */
export async function answerTransfer(input: { outFlowId: string; inFlowId: string; same: boolean }) {
	const { userId } = requireAccess();
	const flows = await db.cashFlows
		.where({ id: { in: [input.outFlowId, input.inFlowId] }, isLive: true })
		.select("id", "accountId", "amount", "classification");
	const out = flows.find((f) => f.id === input.outFlowId);
	const inn = flows.find((f) => f.id === input.inFlowId);
	if (!out || !inn) throw new ORPCError("NOT_FOUND", { status: 404, message: "Not found" });
	// Pairing changes both accounts' group returns, so it needs edit on both.
	requireAccountLevel(out.accountId, "edit");
	requireAccountLevel(inn.accountId, "edit");
	if (
		out.accountId === inn.accountId ||
		out.classification !== "external_withdrawal" ||
		inn.classification !== "external_deposit" ||
		compareMoney(inn.amount, negateMoney(out.amount)) !== 0
	)
		throw bad("These two entries are not money leaving one account and the same amount arriving in another.");
	const busy = await db.transferLinks
		.where({
			isLive: true,
			same: true,
			OR: [{ outFlowId: out.id }, { inFlowId: inn.id }],
		})
		.exists();
	if (busy) throw bad("One of these is already paired with something else.");

	const link = await db.transferLinks.create({
		outFlowId: out.id,
		inFlowId: inn.id,
		outAccountId: out.accountId,
		inAccountId: inn.accountId,
		same: input.same,
		decidedByUserId: userId,
	});
	return { linkId: link.id };
}

/** Take a pairing (or a "not the same") back, so the question can be asked again. */
export async function undoTransferAnswer(linkId: string) {
	const link = await db.transferLinks
		.where({ id: linkId, isLive: true })
		.select("id", "outAccountId", "inAccountId")
		.takeOptional();
	if (!link) throw new ORPCError("NOT_FOUND", { status: 404, message: "Not found" });
	requireAccountLevel(link.outAccountId, "edit");
	requireAccountLevel(link.inAccountId, "edit");
	await db.transferLinks.where({ id: link.id }).update({ isLive: false });
}
