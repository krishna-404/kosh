import { db } from "@backend/db/db";
import { findInstrumentsByIsin } from "@backend/modules/instruments/services/isin.instruments.service";
import { fetchMarketFile } from "@backend/modules/market-data/services/fetcher.market";
import {
	bumpLedger,
	type QuantityFactors,
	setQuantityFactorSource,
} from "@backend/modules/metrics/services/series.metrics.service";
import {
	atLeast,
	inList,
	requireAccess,
	requireAccountLevel,
	usersById,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import { qtyRatio } from "@connected-repo/corporate-actions/apply";
import { parsePurpose } from "@connected-repo/corporate-actions/purpose-parser";
import type { AppliedAction, Question } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { ORPCError } from "@orpc/server";
import { ulid } from "ulid";

// Splits and bonuses. The exchange announces them; Kosh applies the ones it
// can read with certainty to every account that held the share on the
// ex-date, and asks about the rest. An application is a decision that can be
// undone — and once undone it is asked about, never silently re-applied.
//
// A split or bonus changes how many shares are held, not what was paid:
// nothing in the ledger is rewritten. The valuation simply multiplies the
// holding by the factor from the ex-date on.

const SOURCE = "nse_corp_actions";
const REFETCH_AFTER_MS = 20 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
/** The actions that change a share count and that Kosh applies. */
const QUANTITY_ACTIONS = ["bonus", "split"];

const bad = (message: string) => new ORPCError("BAD_REQUEST", { status: 400, message });
const trim = (n: number): string => String(Math.round(n * 1e6) / 1e6);

// ─── The feed ───────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
	jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
	jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "03-Dec-2024" → "2024-12-03"; anything else → null. */
const isoDate = (text: string | undefined): string | null => {
	const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec((text ?? "").trim());
	const month = m && MONTHS[(m[2] as string).toLowerCase()];
	return m && month ? `${m[3]}-${month}-${m[1]}` : null;
};

const ddmmyyyy = (date: string): string => date.split("-").reverse().join("-");

export const corporateActionsUrl = (symbol: string, from: string, to: string): string =>
	`https://www.nseindia.in/api/corporates-corporateActions?index=equities` +
	`&from_date=${ddmmyyyy(from)}&to_date=${ddmmyyyy(to)}&symbol=${encodeURIComponent(symbol)}`;

interface FeedRow {
	subject?: string;
	exDate?: string;
	recDate?: string;
}

export interface ReadAction {
	actionType: string;
	exDate: string;
	recordDate: string | null;
	quantityFactor: number | null;
	amountPerShare: string | null;
	rawText: string;
	confidence: "high" | "low";
}

/**
 * One announcement → what Kosh stores of it. An announcement can carry more
 * than one action ("Bonus 1:1 And Face Value Split From Rs 10/- To Rs 2/-",
 * "Annual General Meeting/Dividend - Rs 5 Per Share"): each part is read on
 * its own, so a bonus is never applied while the split announced with it is
 * dropped. Parts Kosh has no use for (an AGM) are left out.
 */
export function readAnnouncement(row: FeedRow): ReadAction[] {
	const whole = (row.subject ?? "").replace(/\s+/g, " ").trim();
	const exDate = isoDate(row.exDate);
	if (!whole || !exDate) return [];
	// " And " joins actions; so does "/", except in "Rs 10/-".
	const parts = whole
		.split(/\s+and\s+|\/(?!\s*-)/i)
		.map((part) => part.trim())
		.filter(Boolean);

	const actions: ReadAction[] = [];
	for (const rawText of parts) {
		const { parsed, confidence } = parsePurpose(rawText);
		if (!parsed) continue;
		let quantityFactor: number | null = null;
		if (QUANTITY_ACTIONS.includes(parsed.type)) {
			try {
				const ratio = qtyRatio({ ...parsed, id: "", isin: "", exDate });
				quantityFactor = Number(ratio.num) / Number(ratio.den);
			} catch {
				quantityFactor = null;
			}
		}
		actions.push({
			actionType: parsed.type,
			exDate,
			recordDate: isoDate(row.recDate),
			quantityFactor,
			amountPerShare: parsed.amountPerShare ?? null,
			rawText,
			// Sure only when the kind AND its numbers were read cleanly.
			confidence:
				confidence === "high" && (!QUANTITY_ACTIONS.includes(parsed.type) || quantityFactor !== null)
					? "high"
					: "low",
		});
	}
	return actions;
}

/**
 * Fetch announcements for everything held that NSE lists. A system job — it
 * is called from the market-data sync, outside any request.
 * Returns how many new announcements were stored.
 */
export async function syncCorporateActions(today: string, problems: string[]): Promise<number> {
	const instruments = await db.instruments
		.whereSql`"tracked_since" IS NOT NULL AND "price_source" = 'nse' AND "slug" IS NULL`
		.select("id", "symbolCanonical", "trackedSince");
	if (instruments.length === 0) return 0;

	const fetched = new Map(
		(
			await db.providerPayloads
				.where({ source: SOURCE, key: { in: instruments.map((i) => i.symbolCanonical) } })
				.select("key", "fetchedAt")
		).map((p) => [p.key, p.fetchedAt]),
	);
	const until = new Date(Date.parse(`${today}T00:00:00Z`) + 60 * DAY_MS).toISOString().slice(0, 10);

	let stored = 0;
	for (const instrument of instruments) {
		const symbol = instrument.symbolCanonical;
		if (Date.now() - (fetched.get(symbol) ?? 0) < REFETCH_AFTER_MS) continue;
		const url = corporateActionsUrl(symbol, instrument.trackedSince as string, until);
		let rows: FeedRow[];
		try {
			const file = await fetchMarketFile(url);
			if (file.status !== 200) {
				problems.push(`NSE answered ${file.status} for ${symbol}'s corporate actions`);
				// A refusal is unlikely to be about one symbol: stop asking for now.
				return stored;
			}
			const body: unknown = JSON.parse(file.bytes.toString("utf8"));
			if (!Array.isArray(body)) throw new Error("not a list");
			rows = body as FeedRow[];
			const kept = await db.providerPayloads
				.where({ source: SOURCE, key: symbol })
				.update({ url, status: "ok", sizeBytes: file.bytes.length, content: file.bytes, fetchedAt: Date.now() });
			if (kept === 0)
				await db.providerPayloads.create({
					source: SOURCE,
					key: symbol,
					url,
					status: "ok",
					sizeBytes: file.bytes.length,
					content: file.bytes,
					fetchedAt: Date.now(),
				});
		} catch (error) {
			problems.push(`Could not read ${symbol}'s corporate actions: ${error instanceof Error ? error.message : error}`);
			continue;
		}

		for (const a of rows.flatMap(readAnnouncement)) {
			const result = await db.$query`
				INSERT INTO corporate_actions
					(id, instrument_id, action_type, ex_date, record_date, quantity_factor, amount_per_share, raw_text, confidence, source)
				VALUES
					(${newId()}, ${instrument.id}, ${a.actionType}, ${a.exDate}::date, ${a.recordDate}::date,
					 ${a.quantityFactor}, ${a.amountPerShare}, ${a.rawText}, ${a.confidence}, 'nse')
				ON CONFLICT DO NOTHING`;
			stored += result.rowCount ?? 0;
		}
	}
	return stored;
}

// A ULID from the same generator the tables use, for the raw insert above.
const newId = (): string => ulid();

// ─── What an account held on a day ──────────────────────────────────────

interface Pair {
	accountId: string;
	instrumentId: string;
}

interface Held {
	trades: { date: string; signed: number }[];
	/** Live applied applications for the pair: ex-date → factor. */
	factors: { date: string; factor: number }[];
}

async function loadHeld(pairs: Pair[]): Promise<Map<string, Held>> {
	const held = new Map<string, Held>();
	if (pairs.length === 0) return held;
	const accountIds = [...new Set(pairs.map((p) => p.accountId))];
	const instrumentIds = [...new Set(pairs.map((p) => p.instrumentId))];
	const key = (p: Pair) => `${p.accountId}:${p.instrumentId}`;
	for (const p of pairs) held.set(key(p), { trades: [], factors: [] });

	const trades = await db.trades
		.where({ isLive: true, accountId: { in: accountIds }, instrumentId: { in: instrumentIds } })
		.order({ tradeDate: "ASC" })
		.select("accountId", "instrumentId", "tradeDate", "side", "quantity");
	for (const t of trades)
		held.get(key(t))?.trades.push({ date: t.tradeDate, signed: t.side === "buy" ? Number(t.quantity) : -Number(t.quantity) });

	const applied = await db.corporateActionApplications
		.where({ isLive: true, state: "applied", accountId: { in: accountIds }, instrumentId: { in: instrumentIds } })
		.order({ exDate: "ASC" })
		.select("accountId", "instrumentId", "exDate", "factor");
	for (const a of applied) held.get(key(a))?.factors.push({ date: a.exDate, factor: Number(a.factor) });
	return held;
}

/** Shares held at the start of `date`: trades before it, with earlier splits and bonuses applied. */
function quantityAtStartOf(h: Held | undefined, date: string): number {
	if (!h) return 0;
	const steps = [
		...h.trades.filter((t) => t.date < date).map((t) => ({ date: t.date, order: 1, apply: (q: number) => q + t.signed })),
		...h.factors.filter((f) => f.date < date).map((f) => ({ date: f.date, order: 0, apply: (q: number) => q * f.factor })),
	].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
	return steps.reduce((q, step) => step.apply(q), 0);
}

// ─── Applying ───────────────────────────────────────────────────────────

async function recordApplication(input: {
	actionId: string;
	accountId: string;
	instrumentId: string;
	exDate: string;
	state: "applied" | "declined";
	factor: number;
	quantityBefore: number;
	userId: string | null;
}): Promise<string> {
	const after = input.state === "applied" ? input.quantityBefore * input.factor : input.quantityBefore;
	const event = await db.events.create({
		accountId: input.accountId,
		kind: input.state === "applied" ? "corporate_action_applied" : "user_resolution",
		payload: {
			question: "corporate_action",
			corporateActionId: input.actionId,
			state: input.state,
			factor: input.factor,
		},
		actor: input.userId ? "user" : "system",
		userId: input.userId,
		occurredAt: Date.parse(`${input.exDate}T00:00:00Z`),
	});
	const application = await db.corporateActionApplications.create({
		corporateActionId: input.actionId,
		accountId: input.accountId,
		instrumentId: input.instrumentId,
		exDate: input.exDate,
		state: input.state,
		factor: String(input.factor),
		quantityBefore: String(input.quantityBefore),
		quantityAfter: String(after),
		eventId: event.id,
		decidedByUserId: input.userId,
	});
	await bumpLedger(input.accountId);
	return application.id;
}

/**
 * Apply, to every account that held the share, each announced split or bonus
 * Kosh is sure of and nobody has decided on yet. Idempotent. Pass an account
 * to settle only that one (after an upload); nothing to settle everything.
 */
export async function settleActions(accountId?: string): Promise<number> {
	const pairsResult = accountId
		? await db.$query<{ account_id: string; instrument_id: string }>`
			SELECT DISTINCT t.account_id, t.instrument_id FROM trades t
			WHERE t.is_live AND t.account_id = ${accountId}
				AND EXISTS (SELECT 1 FROM corporate_actions c WHERE c.instrument_id = t.instrument_id AND c.source = 'nse')`
		: await db.$query<{ account_id: string; instrument_id: string }>`
			SELECT DISTINCT t.account_id, t.instrument_id FROM trades t
			WHERE t.is_live
				AND EXISTS (SELECT 1 FROM corporate_actions c WHERE c.instrument_id = t.instrument_id AND c.source = 'nse')`;
	const pairs = pairsResult.rows.map((r) => ({ accountId: r.account_id, instrumentId: r.instrument_id }));
	if (pairs.length === 0) return 0;

	const instrumentIds = [...new Set(pairs.map((p) => p.instrumentId))];
	const actions = await db.corporateActions
		.where({ instrumentId: { in: instrumentIds }, source: "nse", actionType: { in: QUANTITY_ACTIONS } })
		.order({ exDate: "ASC" })
		.select("id", "instrumentId", "exDate", "quantityFactor", "confidence");
	if (actions.length === 0) return 0;

	// Any decision ever made — standing or undone — means Kosh no longer decides by itself.
	const decided = new Set(
		(
			await db.corporateActionApplications
				.where({ corporateActionId: { in: actions.map((a) => a.id) } })
				.select("corporateActionId", "accountId")
		).map((d) => `${d.corporateActionId}:${d.accountId}`),
	);
	const held = await loadHeld(pairs);

	let applied = 0;
	for (const pair of pairs) {
		const h = held.get(`${pair.accountId}:${pair.instrumentId}`);
		for (const action of actions) {
			if (action.instrumentId !== pair.instrumentId) continue;
			if (decided.has(`${action.id}:${pair.accountId}`)) continue;
			if (action.confidence !== "high" || action.quantityFactor === null) continue;
			const before = quantityAtStartOf(h, action.exDate);
			if (before <= 1e-9) continue;
			const factor = Number(action.quantityFactor);
			await recordApplication({
				actionId: action.id,
				accountId: pair.accountId,
				instrumentId: pair.instrumentId,
				exDate: action.exDate,
				state: "applied",
				factor,
				quantityBefore: before,
				userId: null,
			});
			// Later actions on the same share see this one.
			h?.factors.push({ date: action.exDate, factor });
			applied++;
		}
	}
	return applied;
}

// The valuation asks here how share counts changed without a trade.
async function loadQuantityFactors(accountId: string): Promise<QuantityFactors> {
	const applied = await db.corporateActionApplications
		.where({ accountId, isLive: true, state: "applied" })
		.order({ exDate: "ASC" })
		.select("instrumentId", "exDate", "factor");
	const factors: QuantityFactors = new Map();
	for (const a of applied) {
		const list = factors.get(a.instrumentId) ?? [];
		list.push({ date: a.exDate, factor: Number(a.factor) });
		factors.set(a.instrumentId, list);
	}
	return factors;
}
setQuantityFactorSource(loadQuantityFactors);

// ─── Questions ──────────────────────────────────────────────────────────

type ActionQuestion = Extract<Question, { kind: "corporate_action" }>;
type MismatchQuestion = Extract<Question, { kind: "holding_mismatch" }>;

/** Splits and bonuses waiting for someone to say whether they apply. */
export async function listActionQuestions(
	accounts: { id: string; label: string }[],
): Promise<ActionQuestion[]> {
	const ctx = requireAccess();
	if (accounts.length === 0) return [];
	const ids = accounts.map((a) => a.id);
	const label = new Map(accounts.map((a) => [a.id, a.label]));

	const traded = await db.trades
		.where({ isLive: true, accountId: { in: ids } })
		.select("accountId", "instrumentId");
	const pairs = [...new Map(traded.map((t) => [`${t.accountId}:${t.instrumentId}`, t])).values()];
	if (pairs.length === 0) return [];
	const instrumentIds = [...new Set(pairs.map((p) => p.instrumentId))];

	const actions = await db.corporateActions
		.where({ instrumentId: { in: instrumentIds }, actionType: { in: QUANTITY_ACTIONS } })
		.order({ exDate: "DESC" })
		.select("id", "instrumentId", "accountId", "actionType", "exDate", "quantityFactor", "confidence", "rawText");
	if (actions.length === 0) return [];
	const decisions = await db.corporateActionApplications
		.where({ corporateActionId: { in: actions.map((a) => a.id) }, accountId: { in: ids } })
		.select("corporateActionId", "accountId", "isLive");
	const symbols = new Map(
		(await db.instruments.where({ id: { in: instrumentIds } }).select("id", "symbolCanonical")).map((i) => [
			i.id,
			i.symbolCanonical,
		]),
	);
	const held = await loadHeld(pairs);

	const questions: ActionQuestion[] = [];
	for (const pair of pairs)
		for (const action of actions) {
			if (action.instrumentId !== pair.instrumentId) continue;
			// Something a person recorded is about their account only.
			if (action.accountId !== null && action.accountId !== pair.accountId) continue;
			const mine = decisions.filter((d) => d.corporateActionId === action.id && d.accountId === pair.accountId);
			if (mine.some((d) => d.isLive)) continue;
			const undone = mine.length > 0;
			const sure = action.confidence === "high" && action.quantityFactor !== null;
			// Sure and never decided: Kosh applies it by itself, there is nothing to ask.
			if (!undone && sure) continue;
			const before = quantityAtStartOf(held.get(`${pair.accountId}:${pair.instrumentId}`), action.exDate);
			if (before <= 1e-9) continue;
			questions.push({
				kind: "corporate_action",
				id: `action:${action.id}:${pair.accountId}`,
				account: { id: pair.accountId, label: label.get(pair.accountId) ?? "An account" },
				canAnswer: atLeast(ctx.accountLevels.get(pair.accountId), "edit"),
				actionId: action.id,
				symbol: symbols.get(action.instrumentId) ?? "?",
				actionType: action.actionType,
				announcement: action.rawText,
				exDate: action.exDate,
				quantityBefore: trim(before),
				quantityAfter: action.quantityFactor === null ? null : trim(before * Number(action.quantityFactor)),
				why: undone ? "undone" : "unclear",
			});
		}
	return questions;
}

/** Where the newest holdings statement and Kosh's own working disagree. */
export async function listHoldingMismatches(
	accounts: { id: string; label: string }[],
): Promise<MismatchQuestion[]> {
	const ctx = requireAccess();
	const questions: MismatchQuestion[] = [];
	for (const account of accounts) {
		const latest = await db.rawHoldingsSnapshots
			.where({ accountId: account.id, isLive: true })
			.order({ asOf: "DESC" })
			.select("asOf")
			.takeOptional();
		if (!latest) continue;
		const reported = await db.rawHoldingsSnapshots
			.where({ accountId: account.id, isLive: true, asOf: latest.asOf })
			.select("isin", "brokerSymbol", "quantity");

		const traded = await db.trades.where({ accountId: account.id, isLive: true }).pluck("instrumentId");
		const instrumentIds = [...new Set(traded)];
		const instruments =
			instrumentIds.length > 0
				? await db.instruments.where({ id: { in: instrumentIds } }).select("id", "isin", "symbolCanonical")
				: [];
		const held = await loadHeld(instrumentIds.map((instrumentId) => ({ accountId: account.id, instrumentId })));
		const dismissed = new Set(
			(
				await db.events
					.where({ accountId: account.id, kind: "user_resolution", supersededByEventId: null })
					.whereSql`payload->>'question' = 'holding_mismatch' AND payload->>'asOf' = ${latest.asOf}`
					.select("payload")
			).map((e) => (e.payload as { symbol?: string }).symbol),
		);

		// The day after the statement's date: everything up to and including that day counts.
		const next = new Date(Date.parse(`${latest.asOf}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
		const seen = new Set<string>();
		const push = (symbol: string, instrumentId: string | null, expected: number, said: number) => {
			if (Math.abs(expected - said) < 1e-6 || dismissed.has(symbol)) return;
			const ratio = expected > 1e-9 && said > 1e-9 ? said / expected : null;
			// A clean multiple (×2, ×5, ×1.5) or its inverse smells of a split or bonus.
			const clean = ratio !== null && Math.abs(ratio * 2 - Math.round(ratio * 2)) < 1e-6 && ratio !== 1;
			questions.push({
				kind: "holding_mismatch",
				id: `mismatch:${account.id}:${symbol}:${latest.asOf}`,
				account,
				canAnswer: atLeast(ctx.accountLevels.get(account.id), "edit"),
				instrumentId,
				symbol,
				asOf: latest.asOf,
				expected: trim(expected),
				reported: trim(said),
				likelyFactor: clean ? ratio : null,
			});
		};
		// A statement may name a share by an ISIN it has since left behind.
		const byIsin = await findInstrumentsByIsin(reported.flatMap((row) => (row.isin ? [row.isin] : [])));
		for (const row of reported) {
			const instrumentId = row.isin ? byIsin.get(row.isin) : undefined;
			const instrument = instruments.find((i) => i.id === instrumentId);
			if (instrument) seen.add(instrument.id);
			const expected = instrument
				? quantityAtStartOf(held.get(`${account.id}:${instrument.id}`), next)
				: 0;
			push(instrument?.symbolCanonical ?? row.brokerSymbol, instrument?.id ?? null, expected, Number(row.quantity));
		}
		// Held by Kosh's working, absent from the statement.
		for (const instrument of instruments) {
			if (seen.has(instrument.id)) continue;
			const expected = quantityAtStartOf(held.get(`${account.id}:${instrument.id}`), next);
			push(instrument.symbolCanonical, instrument.id, expected, 0);
		}
	}
	return questions;
}

// ─── Answers ────────────────────────────────────────────────────────────

async function visibleAction(actionId: string, accountId: string) {
	const action = await db.corporateActions
		.where({ id: actionId })
		.select("id", "instrumentId", "accountId", "actionType", "exDate", "quantityFactor")
		.takeOptional();
	if (!action || (action.accountId !== null && action.accountId !== accountId))
		throw new ORPCError("NOT_FOUND", { status: 404, message: "Not found" });
	if (!QUANTITY_ACTIONS.includes(action.actionType)) throw bad("Kosh can only apply splits and bonuses.");
	if (await db.corporateActionApplications.where({ corporateActionId: actionId, accountId, isLive: true }).exists())
		throw bad("Someone has already decided this.");
	return action;
}

async function heldBefore(accountId: string, instrumentId: string, exDate: string): Promise<number> {
	const held = await loadHeld([{ accountId, instrumentId }]);
	return quantityAtStartOf(held.get(`${accountId}:${instrumentId}`), exDate);
}

/** "Yes, this happened to this account." Gives the ratio when the announcement's could not be read. */
export async function applyAction(input: { accountId: string; actionId: string; oneBecomes?: number }) {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "edit");
	const action = await visibleAction(input.actionId, input.accountId);
	const factor = action.quantityFactor !== null ? Number(action.quantityFactor) : input.oneBecomes;
	if (factor === undefined) throw bad("Say how many shares one share became.");
	const before = await heldBefore(input.accountId, action.instrumentId, action.exDate);
	return db.$transaction(async () => ({
		applicationId: await recordApplication({
			actionId: action.id,
			accountId: input.accountId,
			instrumentId: action.instrumentId,
			exDate: action.exDate,
			state: "applied",
			factor,
			quantityBefore: before,
			userId,
		}),
	}));
}

/** "Not for this account." */
export async function declineAction(input: { accountId: string; actionId: string }) {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "edit");
	const action = await visibleAction(input.actionId, input.accountId);
	const before = await heldBefore(input.accountId, action.instrumentId, action.exDate);
	return db.$transaction(async () => ({
		applicationId: await recordApplication({
			actionId: action.id,
			accountId: input.accountId,
			instrumentId: action.instrumentId,
			exDate: action.exDate,
			state: "declined",
			factor: 1,
			quantityBefore: before,
			userId,
		}),
	}));
}

/** A split or bonus the exchange's feed does not have, recorded for one account. */
export async function recordAction(input: {
	accountId: string;
	instrumentId: string;
	exDate: string;
	oneBecomes: number;
	note?: string;
}) {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "edit");
	if (!(await db.trades.where({ accountId: input.accountId, instrumentId: input.instrumentId, isLive: true }).exists()))
		throw new ORPCError("NOT_FOUND", { status: 404, message: "This account has never held that." });
	const before = await heldBefore(input.accountId, input.instrumentId, input.exDate);
	if (before <= 1e-9) throw bad("This account held none of it on that day.");

	return db.$transaction(async () => {
		const action = await db.corporateActions.create({
			instrumentId: input.instrumentId,
			actionType: "split",
			exDate: input.exDate,
			quantityFactor: String(input.oneBecomes),
			rawText: input.note?.trim() || `One share became ${trim(input.oneBecomes)}`,
			confidence: "high",
			source: "user",
			accountId: input.accountId,
			createdByUserId: userId,
		});
		return {
			applicationId: await recordApplication({
				actionId: action.id,
				accountId: input.accountId,
				instrumentId: input.instrumentId,
				exDate: input.exDate,
				state: "applied",
				factor: input.oneBecomes,
				quantityBefore: before,
				userId,
			}),
		};
	});
}

/** Take a decision back. The action becomes a question again. */
export async function undoApplication(applicationId: string): Promise<void> {
	const { userId } = requireAccess();
	const application = await db.corporateActionApplications
		.where({ id: applicationId, isLive: true })
		.select("id", "accountId", "eventId")
		.takeOptional();
	if (!application) throw new ORPCError("NOT_FOUND", { status: 404, message: "Not found" });
	requireAccountLevel(application.accountId, "edit");
	await db.$transaction(async () => {
		const retraction = await db.events.create({
			accountId: application.accountId,
			kind: "retraction",
			payload: { corporateActionApplicationId: application.id },
			actor: "user",
			userId,
			occurredAt: Date.now(),
			reason: "Split or bonus undone",
		});
		await db.events.where({ id: application.eventId }).update({ supersededByEventId: retraction.id });
		await db.corporateActionApplications.where({ id: application.id }).update({ isLive: false });
		await bumpLedger(application.accountId);
	});
}

/** "Yes, I know" for a holdings mismatch: do not ask about this share for this statement again. */
export async function dismissMismatch(input: { accountId: string; symbol: string; asOf: string }) {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "edit");
	await db.events.create({
		accountId: input.accountId,
		kind: "user_resolution",
		payload: { question: "holding_mismatch", symbol: input.symbol, asOf: input.asOf },
		actor: "user",
		userId,
		occurredAt: Date.now(),
	});
}

/** The splits and bonuses standing on an account, newest first. */
export async function listAppliedActions(accountId: string): Promise<AppliedAction[]> {
	const level = requireAccountLevel(accountId, "view");
	const applications = await db.corporateActionApplications
		.where({ accountId, isLive: true })
		.order({ exDate: "DESC" })
		.select("id", "corporateActionId", "instrumentId", "state", "quantityBefore", "quantityAfter", "decidedByUserId");
	if (applications.length === 0) return [];
	const actions = new Map(
		(
			await db.corporateActions
				.where({ id: { in: inList(applications.map((a) => a.corporateActionId)) } })
				.select("id", "actionType", "exDate", "rawText", "source")
		).map((a) => [a.id, a]),
	);
	const symbols = new Map(
		(
			await db.instruments
				.where({ id: { in: applications.map((a) => a.instrumentId) } })
				.select("id", "symbolCanonical")
		).map((i) => [i.id, i.symbolCanonical]),
	);
	const users = await usersById(applications.map((a) => a.decidedByUserId));
	return applications.flatMap((a) => {
		const action = actions.get(a.corporateActionId);
		if (!action) return [];
		return [
			{
				applicationId: a.id,
				actionId: action.id,
				symbol: symbols.get(a.instrumentId) ?? "?",
				actionType: action.actionType,
				announcement: action.rawText,
				exDate: action.exDate,
				state: a.state === "declined" ? ("declined" as const) : ("applied" as const),
				quantityBefore: trim(Number(a.quantityBefore)),
				quantityAfter: trim(Number(a.quantityAfter)),
				by: a.decidedByUserId ? ("person" as const) : ("kosh" as const),
				byName: a.decidedByUserId ? (users.get(a.decidedByUserId)?.name ?? null) : null,
				source: action.source === "user" ? ("person" as const) : ("exchange" as const),
				canUndo: atLeast(level, "edit"),
			},
		];
	});
}
