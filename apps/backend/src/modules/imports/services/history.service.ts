import { db } from "@backend/db/db";
import { requireAccountLevel } from "@backend/modules/portfolio/services/access.portfolio.service";
import type { History } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { addMoney, compareMoney, isZeroMoney, negateMoney, toMoney } from "../lib/decimal.imports";

// How complete an account's history is. True returns need every rupee that
// went in or out since the account's first day, so this is checked from the
// lines themselves: the broker's running balance must follow from one line
// to the next, and must start from nothing — or from an amount someone has
// accounted for.

interface LedgerLine {
	postedDate: string;
	debit: string | null;
	credit: string | null;
	runningBalance: string | null;
	batchId: string;
}

/** An account's live ledger lines in the order they happened. */
async function ledgerLinesInOrder(accountId: string): Promise<LedgerLine[]> {
	return db.rawLedgerLines
		.where({ accountId, isLive: true })
		.order({ postedDate: "ASC", batchId: "ASC", lineNo: "ASC" })
		.select("postedDate", "debit", "credit", "runningBalance", "batchId");
}

/** What the account held just before `line`: its balance with the line taken back out. */
export const balanceBefore = (line: Pick<LedgerLine, "debit" | "credit" | "runningBalance">): string =>
	addMoney(
		addMoney(toMoney(line.runningBalance), negateMoney(toMoney(line.credit))),
		toMoney(line.debit),
	);

/** Whether someone has accounted for the balance the account started with. */
export async function openingIsExplained(accountId: string): Promise<boolean> {
	return db.cashFlows.where({ accountId, isLive: true, origin: "opening_balance" }).exists();
}

const monthOf = (date: string, shiftDays = 0): string => {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + shiftDays);
	return d.toISOString().slice(0, 7);
};

export async function getHistory(accountId: string): Promise<History> {
	requireAccountLevel(accountId, "view");

	const lines = await ledgerLinesInOrder(accountId);
	let ledger: History["ledger"] = null;
	const first = lines[0];
	const last = lines[lines.length - 1];
	if (first && last) {
		const gaps: NonNullable<History["ledger"]>["gaps"] = [];
		let previous = first;
		for (const line of lines.slice(1)) {
			// A line whose balance does not follow from the one before it means
			// lines are missing in between — a statement was never uploaded.
			const expected = balanceBefore(line);
			const have = toMoney(previous.runningBalance);
			if (compareMoney(expected, have) !== 0)
				gaps.push({
					after: previous.postedDate,
					before: line.postedDate,
					missing: addMoney(expected, negateMoney(have)),
				});
			previous = line;
		}
		const openingBalance = balanceBefore(first);
		ledger = {
			from: first.postedDate,
			to: last.postedDate,
			lines: lines.length,
			openingBalance,
			openingExplained: isZeroMoney(openingBalance) || (await openingIsExplained(accountId)),
			gaps,
		};
	}

	const tradeDates = await db.rawTrades
		.where({ accountId, isLive: true })
		.order({ tradeDate: "ASC" })
		.pluck("tradeDate");
	// Months in which the ledger shows trades settling but no tradebook has a
	// single trade. Settlement posts a day or two after the trade, so a
	// settlement in the first days of a month may belong to the month before.
	const tradeMonths = new Set(tradeDates.map((d) => monthOf(d)));
	const settlements = await db.cashFlows
		.where({ accountId, isLive: true, classification: "trade_settlement" })
		.pluck("flowDate");
	const missingMonths = [
		...new Set(
			settlements
				.filter((d) => !tradeMonths.has(monthOf(d)) && !tradeMonths.has(monthOf(d, -3)))
				.map((d) => monthOf(d, -3)),
		),
	].sort();
	const firstTrade = tradeDates[0];
	const lastTrade = tradeDates[tradeDates.length - 1];
	const trades: History["trades"] =
		firstTrade && lastTrade
			? { from: firstTrade, to: lastTrade, count: tradeDates.length, missingMonths }
			: missingMonths.length > 0
				? { from: "", to: "", count: 0, missingMonths }
				: null;

	const snapshot = await db.rawHoldingsSnapshots
		.where({ accountId, isLive: true })
		.order({ asOf: "DESC" })
		.select("asOf")
		.takeOptional();
	const holdings = snapshot
		? {
				asOf: snapshot.asOf,
				lines: await db.rawHoldingsSnapshots
					.where({ accountId, isLive: true, asOf: snapshot.asOf })
					.count(),
			}
		: null;

	return {
		ledger,
		trades,
		holdings,
		complete:
			ledger !== null &&
			ledger.gaps.length === 0 &&
			ledger.openingExplained &&
			(trades === null ? settlements.length === 0 : trades.missingMonths.length === 0),
	};
}
