import { db } from "@backend/db/db";
import { addMoney, toMoney } from "@backend/modules/imports/lib/decimal.imports";
import {
	requireAccess,
	requireAccountLevel,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import type { CashFlowRow } from "@connected-repo/zod-schemas/kosh/statements.zod";

// The ledger as a person reads it: money in and out of one account, and its
// trades — newest first, live rows only.

interface PageInput {
	accountId: string;
	before?: string;
	limit: number;
}

/** A cursor that is stable when several rows share a date: "2025-09-20|<id>". */
const cursorOf = (row: { date: string; id: string }) => `${row.date}|${row.id}`;
const parseCursor = (cursor: string | undefined) => {
	if (!cursor) return null;
	const [date = "", id = ""] = cursor.split("|");
	return { date, id };
};

const EXTERNAL = ["external_deposit", "external_withdrawal"] as const;

export async function listCashFlows(input: PageInput & { show: "external" | "all" }) {
	requireAccountLevel(input.accountId, "view");
	const ctx = requireAccess();
	const cursor = parseCursor(input.before);

	let query = db.cashFlows.where({ accountId: input.accountId, isLive: true });
	if (input.show === "external") query = query.where({ classification: { in: [...EXTERNAL] } });
	if (cursor)
		query = query.where({
			OR: [
				{ flowDate: { lt: cursor.date } },
				{ flowDate: cursor.date, id: { lt: cursor.id } },
			],
		});
	const flows = await query
		.order({ flowDate: "DESC", id: "DESC" })
		.limit(input.limit + 1)
		.select("id", "flowDate", "amount", "classification", "sourceLedgerLineId", "classifiedEventId", "origin");
	const page = flows.slice(0, input.limit);

	const lineIds = page.map((f) => f.sourceLedgerLineId).filter((id): id is string => id !== null);
	const lines =
		lineIds.length > 0
			? await db.rawLedgerLines.where({ id: { in: lineIds } }).select("id", "narration")
			: [];
	const narration = new Map(lines.map((l) => [l.id, l.narration]));
	const events =
		page.length > 0
			? await db.events
					.where({ id: { in: page.map((f) => f.classifiedEventId) } })
					.select("id", "kind")
			: [];
	const eventKind = new Map(events.map((e) => [e.id, e.kind]));

	// Pairings with money in another account. The other account is named only
	// to someone who can see it too.
	const ids = page.map((f) => f.id);
	const links =
		ids.length > 0
			? await db.transferLinks
					.where({
						isLive: true,
						same: true,
						OR: [{ outFlowId: { in: ids } }, { inFlowId: { in: ids } }],
					})
					.select("id", "outFlowId", "inFlowId", "outAccountId", "inAccountId")
			: [];
	const otherIds = links.map((l) =>
		ids.includes(l.outFlowId) ? l.inAccountId : l.outAccountId,
	);
	const others =
		otherIds.length > 0
			? await db.brokerAccounts.where({ id: { in: otherIds } }).select("id", "label")
			: [];
	const otherLabel = new Map(others.map((a) => [a.id, a.label]));

	const rows: CashFlowRow[] = page.map((f) => {
		const link = links.find((l) => l.outFlowId === f.id || l.inFlowId === f.id);
		const otherId = link && (link.outFlowId === f.id ? link.inAccountId : link.outAccountId);
		return {
			id: f.id,
			date: f.flowDate,
			amount: toMoney(f.amount),
			classification: f.classification,
			narration: f.sourceLedgerLineId ? (narration.get(f.sourceLedgerLineId) ?? null) : null,
			source:
				f.origin === "opening_balance"
					? "opening_balance"
					: eventKind.get(f.classifiedEventId) === "user_resolution"
						? "answer"
						: "rule",
			transfer: link
				? {
						linkId: link.id,
						otherAccount:
							otherId && ctx.accountLevels.has(otherId)
								? { id: otherId, label: otherLabel.get(otherId) ?? "Another account" }
								: null,
					}
				: null,
		};
	});

	// Money put in and taken out over the account's whole life.
	const external = await db.cashFlows
		.where({ accountId: input.accountId, isLive: true, classification: { in: [...EXTERNAL] } })
		.select("amount", "classification");
	let moneyIn = "0.00";
	let moneyOut = "0.00";
	for (const f of external) {
		if (f.classification === "external_deposit") moneyIn = addMoney(moneyIn, f.amount);
		else moneyOut = addMoney(moneyOut, f.amount);
	}

	const last = page[page.length - 1];
	return {
		rows,
		nextBefore:
			flows.length > input.limit && last ? cursorOf({ date: last.flowDate, id: last.id }) : null,
		totals: { in: moneyIn, out: moneyOut },
	};
}

export async function listTrades(input: PageInput) {
	requireAccountLevel(input.accountId, "view");
	const cursor = parseCursor(input.before);

	let query = db.trades.where({ accountId: input.accountId, isLive: true });
	if (cursor)
		query = query.where({
			OR: [
				{ tradeDate: { lt: cursor.date } },
				{ tradeDate: cursor.date, id: { lt: cursor.id } },
			],
		});
	const trades = await query
		.order({ tradeDate: "DESC", id: "DESC" })
		.limit(input.limit + 1)
		.select("id", "tradeDate", "instrumentId", "side", "quantity", "price", "grossValue");
	const page = trades.slice(0, input.limit);
	const instruments =
		page.length > 0
			? await db.instruments
					.where({ id: { in: [...new Set(page.map((t) => t.instrumentId))] } })
					.select("id", "symbolCanonical", "isin")
			: [];
	const byId = new Map(instruments.map((i) => [i.id, i]));

	const last = page[page.length - 1];
	return {
		rows: page.map((t) => ({
			id: t.id,
			date: t.tradeDate,
			symbol: byId.get(t.instrumentId)?.symbolCanonical ?? "?",
			isin: byId.get(t.instrumentId)?.isin ?? null,
			side: t.side,
			quantity: t.quantity,
			price: t.price,
			value: toMoney(t.grossValue),
		})),
		nextBefore:
			trades.length > input.limit && last ? cursorOf({ date: last.tradeDate, id: last.id }) : null,
		total: await db.trades.where({ accountId: input.accountId, isLive: true }).count(),
	};
}
