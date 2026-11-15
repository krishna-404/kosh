import { db } from "@backend/db/db";
import {
	loadHeld,
	onHoldingsChanged,
	type Pair,
	quantityAtStartOf,
} from "@backend/modules/corporate-actions/services/corporate_actions.service";
import { todayInIndia } from "@backend/modules/metrics/services/dates.metrics";
import { bumpLedger, setDividendSource } from "@backend/modules/metrics/services/series.metrics.service";
import {
	atLeast,
	inList,
	requireAccess,
	requireAccountLevel,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import type { Dividend, DividendList } from "@connected-repo/zod-schemas/kosh/income.zod";
import { ORPCError } from "@orpc/server";

// Dividends.
//
// In India a dividend is paid to the holder's bank, not into the broker's
// ledger — so no statement Kosh reads ever shows it, and a return worked
// out from the ledger alone is too low for anyone who holds dividend-paying
// shares. Kosh works out what was due (the exchange's announcement × the
// shares held going into the ex-date), counts it from the ex-date as money
// the account earned and paid out, and asks the person to confirm. What
// they confirm, change or strike out replaces the working.

const bad = (message: string) => new ORPCError("BAD_REQUEST", { status: 400, message });
const round2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);
const trim = (n: number): string => String(Math.round(n * 1e6) / 1e6);

/**
 * Bring the expected dividends in line with what is held: add what is newly
 * due, correct what changed (more trades came in), and retire what no longer
 * applies. Rows a person has answered are never touched.
 * Returns the number of rows added, corrected or retired.
 */
export async function settleDividends(accountId?: string): Promise<number> {
	const today = todayInIndia();
	const pairsResult = accountId
		? await db.$query<{ account_id: string; instrument_id: string }>`
			SELECT DISTINCT t.account_id, t.instrument_id FROM trades t
			WHERE t.is_live AND t.account_id = ${accountId}
				AND EXISTS (SELECT 1 FROM corporate_actions c WHERE c.instrument_id = t.instrument_id AND c.action_type = 'dividend')`
		: await db.$query<{ account_id: string; instrument_id: string }>`
			SELECT DISTINCT t.account_id, t.instrument_id FROM trades t
			WHERE t.is_live
				AND EXISTS (SELECT 1 FROM corporate_actions c WHERE c.instrument_id = t.instrument_id AND c.action_type = 'dividend')`;
	const pairs: Pair[] = pairsResult.rows.map((r) => ({ accountId: r.account_id, instrumentId: r.instrument_id }));

	const standing = await db.dividends
		.unscope("default")
		.where({ isLive: true, source: "feed", ...(accountId ? { accountId } : {}) })
		.select("id", "accountId", "corporateActionId", "state", "quantity", "amount");
	const byKey = new Map(standing.map((d) => [`${d.corporateActionId}:${d.accountId}`, d]));
	const seen = new Set<string>();
	const touched = new Set<string>();
	let changes = 0;

	if (pairs.length > 0) {
		const actions = await db.corporateActions
			.where({
				actionType: "dividend",
				source: "nse",
				confidence: "high",
				instrumentId: { in: [...new Set(pairs.map((p) => p.instrumentId))] },
				exDate: { lte: today },
			})
			.whereSql`"amount_per_share" IS NOT NULL AND "amount_per_share" > 0`
			.select("id", "instrumentId", "exDate", "amountPerShare");
		const held = await loadHeld(pairs);

		for (const pair of pairs) {
			for (const action of actions) {
				if (action.instrumentId !== pair.instrumentId) continue;
				const quantity = quantityAtStartOf(held.get(`${pair.accountId}:${pair.instrumentId}`), action.exDate);
				if (quantity <= 1e-9) continue;
				const key = `${action.id}:${pair.accountId}`;
				seen.add(key);
				const amount = round2(quantity * Number(action.amountPerShare));
				const have = byKey.get(key);
				if (!have) {
					await db.dividends.create({
						accountId: pair.accountId,
						instrumentId: pair.instrumentId,
						corporateActionId: action.id,
						exDate: action.exDate,
						receivedOn: action.exDate,
						quantity: trim(quantity),
						amountPerShare: action.amountPerShare as string,
						amount,
						state: "expected",
						source: "feed",
					});
				} else if (have.state === "expected" && (Number(have.amount) !== Number(amount) || Number(have.quantity) !== quantity)) {
					await db.dividends.unscope("default").where({ id: have.id }).update({ quantity: trim(quantity), amount });
				} else continue;
				touched.add(pair.accountId);
				changes++;
			}
		}
	}

	// Still only Kosh's working, and the shares it rested on are no longer there.
	for (const d of standing) {
		if (d.state !== "expected" || seen.has(`${d.corporateActionId}:${d.accountId}`)) continue;
		await db.dividends.unscope("default").where({ id: d.id }).update({ isLive: false });
		touched.add(d.accountId);
		changes++;
	}

	for (const id of touched) await bumpLedger(id);
	return changes;
}

// A split or bonus applied or undone changes the shares a dividend was due on.
onHoldingsChanged(settleDividends);

// What the day-by-day series counts: everything live except what a person struck out.
setDividendSource(async (accountId) =>
	(
		await db.dividends
			.where({ accountId, isLive: true, state: { in: ["expected", "confirmed"] } })
			.order({ receivedOn: "ASC" })
			.select("id", "instrumentId", "receivedOn", "amount", "state")
	).map((d) => ({
		id: d.id,
		instrumentId: d.instrumentId,
		date: d.receivedOn,
		amount: Number(d.amount),
		confirmed: d.state === "confirmed",
	})),
);

/** Dividends waiting for someone to confirm, per account the caller can see. */
export async function countDividendsToConfirm(accountIds: readonly string[]): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	if (accountIds.length === 0) return counts;
	const rows = await db.dividends
		.where({ isLive: true, state: "expected", accountId: { in: inList(accountIds) } })
		.select("accountId");
	for (const r of rows) counts.set(r.accountId, (counts.get(r.accountId) ?? 0) + 1);
	return counts;
}

export async function listDividends(accountId: string): Promise<DividendList> {
	const ctx = requireAccess();
	requireAccountLevel(accountId, "view");
	const account = await db.brokerAccounts.where({ id: accountId }).select("id", "label").take();
	const rows = await db.dividends
		.where({ accountId, isLive: true })
		.order({ exDate: "DESC", createdAt: "DESC" })
		.select("id", "instrumentId", "corporateActionId", "exDate", "receivedOn", "quantity", "amountPerShare", "amount", "state", "source");
	const instruments = new Map(
		(rows.length > 0
			? await db.instruments.where({ id: { in: [...new Set(rows.map((r) => r.instrumentId))] } }).select("id", "symbolCanonical", "name")
			: []
		).map((i) => [i.id, i]),
	);
	const actionIds = rows.flatMap((r) => (r.corporateActionId ? [r.corporateActionId] : []));
	const words = new Map(
		(actionIds.length > 0 ? await db.corporateActions.where({ id: { in: actionIds } }).select("id", "rawText") : []).map((a) => [a.id, a.rawText]),
	);

	const dividends: Dividend[] = rows.map((r) => ({
		id: r.id,
		instrumentId: r.instrumentId,
		symbol: instruments.get(r.instrumentId)?.symbolCanonical ?? "",
		name: instruments.get(r.instrumentId)?.name ?? "",
		exDate: r.exDate,
		receivedOn: r.receivedOn,
		quantity: trim(Number(r.quantity)),
		amountPerShare: trim(Number(r.amountPerShare)),
		amount: r.amount,
		state: r.state as Dividend["state"],
		source: r.source === "feed" ? "feed" : "person",
		announcement: r.corporateActionId ? (words.get(r.corporateActionId) ?? null) : null,
	}));
	const sum = (list: Dividend[]) => round2(list.reduce((total, d) => total + Number(d.amount), 0));
	const waiting = dividends.filter((d) => d.state === "expected");
	const counted = dividends.filter((d) => d.state !== "not_received");
	return {
		account,
		canAnswer: atLeast(ctx.accountLevels.get(accountId), "edit"),
		toConfirm: { count: waiting.length, total: sum(waiting) },
		counted: { count: counted.length, total: sum(counted) },
		dividends,
	};
}

/** Record that someone answered, for the activity feed. Nothing about the dividend itself lives here. */
async function note(accountId: string, userId: string, payload: Record<string, unknown>): Promise<void> {
	await db.events.create({
		accountId,
		kind: "dividend_receipt_confirmed",
		payload: { question: "dividends", ...payload },
		actor: "user",
		userId,
		occurredAt: Date.now(),
	});
}

async function findDividend(dividendId: string) {
	const dividend = await db.dividends
		.where({ id: dividendId, isLive: true })
		.select("id", "accountId", "exDate", "quantity", "amountPerShare", "amount", "state", "source")
		.takeOptional();
	// One the caller cannot see reads the same as one that is not there.
	if (!dividend) throw new ORPCError("NOT_FOUND", { status: 404, message: "Dividend not found" });
	requireAccountLevel(dividend.accountId, "edit");
	return dividend;
}

/** "Confirm all as expected" — or just the ones named. */
export async function confirmDividends(input: { accountId: string; dividendIds?: string[] }): Promise<{ confirmed: number }> {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "edit");
	const confirmed = await db.dividends
		.where({
			accountId: input.accountId,
			isLive: true,
			state: "expected",
			...(input.dividendIds ? { id: { in: inList(input.dividendIds) } } : {}),
		})
		.update({ state: "confirmed", decidedByUserId: userId });
	if (confirmed > 0) await note(input.accountId, userId, { answer: "confirmed", count: confirmed });
	return { confirmed };
}

/** What really arrived, and when. */
export async function changeDividend(input: { dividendId: string; amount: string; receivedOn: string }): Promise<void> {
	const { userId } = requireAccess();
	const dividend = await findDividend(input.dividendId);
	if (input.receivedOn > todayInIndia()) throw bad("That date hasn’t come yet.");
	if (input.receivedOn < dividend.exDate && dividend.source === "feed")
		throw bad("A dividend can’t arrive before the share goes ex-dividend.");
	await db.dividends
		.where({ id: dividend.id })
		.update({ amount: round2(Number(input.amount)), receivedOn: input.receivedOn, state: "confirmed", decidedByUserId: userId });
	await note(dividend.accountId, userId, { answer: "changed", dividendId: dividend.id, amount: input.amount });
	await bumpLedger(dividend.accountId);
}

/** It never came: stop counting it. */
export async function declineDividend(dividendId: string): Promise<void> {
	const { userId } = requireAccess();
	const dividend = await findDividend(dividendId);
	await db.dividends.where({ id: dividend.id }).update({ state: "not_received", decidedByUserId: userId });
	await note(dividend.accountId, userId, { answer: "not_received", dividendId: dividend.id });
	await bumpLedger(dividend.accountId);
}

/** Undo an answer: back to Kosh's own working (or, for one a person entered, gone). */
export async function reopenDividend(dividendId: string): Promise<void> {
	const { userId } = requireAccess();
	const dividend = await findDividend(dividendId);
	if (dividend.source === "feed")
		await db.dividends.where({ id: dividend.id }).update({
			state: "expected",
			amount: round2(Number(dividend.quantity) * Number(dividend.amountPerShare)),
			receivedOn: dividend.exDate,
			decidedByUserId: null,
		});
	else await db.dividends.where({ id: dividend.id }).update({ isLive: false });
	await note(dividend.accountId, userId, { answer: "reopened", dividendId: dividend.id });
	await bumpLedger(dividend.accountId);
}

/** A dividend the exchange's feed did not carry. */
export async function recordDividend(input: {
	accountId: string;
	instrumentId: string;
	amount: string;
	receivedOn: string;
}): Promise<{ id: string }> {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "edit");
	if (input.receivedOn > todayInIndia()) throw bad("That date hasn’t come yet.");
	if (!(await db.trades.where({ accountId: input.accountId, instrumentId: input.instrumentId, isLive: true }).exists()))
		throw bad("This account has never held that share.");
	const amount = round2(Number(input.amount));
	const created = await db.dividends.create({
		accountId: input.accountId,
		instrumentId: input.instrumentId,
		corporateActionId: null,
		exDate: input.receivedOn,
		receivedOn: input.receivedOn,
		quantity: "0",
		amountPerShare: "0",
		amount,
		state: "confirmed",
		source: "user",
		decidedByUserId: userId,
	});
	await note(input.accountId, userId, { answer: "recorded", dividendId: created.id, amount });
	await bumpLedger(input.accountId);
	return { id: created.id };
}
