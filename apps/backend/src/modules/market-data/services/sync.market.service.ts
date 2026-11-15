import { createHash } from "node:crypto";
import { db } from "@backend/db/db";
import { getRequestContext, requestContext } from "@backend/lib/request-context";
import {
	settleActions,
	syncCorporateActions,
} from "@backend/modules/corporate-actions/services/corporate_actions.service";
import { adoptIsin, shareLineOf } from "@backend/modules/instruments/services/isin.instruments.service";
import { logger } from "@backend/utils/logger.utils";
import { bhavcopyUrls, parseBhavcopy } from "../lib/bhavcopy.market";
import { AMFI_NAV_ALL_URL, mfapiUrl, parseAmfiNavAll, parseMfapi } from "../lib/funds.market";
import { fetchMarketFile } from "./fetcher.market";

// Keeping prices up to date. A system job: it sees every account's
// instruments, so it always runs outside any one person's request.
//
//   1. Track: anything held in some account is priced from its first trade;
//      the benchmarks from the first day anyone has money in.
//   2. Fetch each trading day's NSE bhavcopy that is not held yet, and keep it.
//   3. Read closes for tracked instruments out of the files held.
//   4. Funds (not listed on NSE) and the benchmarks: NAV history per scheme.
//
// Everything is resumable: a run does a bounded amount and says what is left.

const BHAVCOPY = "nse_bhavcopy";
const AMFI_ALL = "amfi_nav_all";
const MFAPI = "mfapi";
const DAY_MS = 86_400_000;
const LEASE_MS = 10 * 60 * 1000;
const FETCH_AT_ONCE = 4;
const AMFI_MAX_AGE_MS = 7 * DAY_MS;

export interface SyncReport {
	daysFetched: number;
	daysRemaining: number;
	barsWritten: number;
	/** New split, bonus and dividend announcements stored. */
	actionsFound: number;
	/** Splits and bonuses applied to accounts by this run. */
	actionsApplied: number;
	/** Why the run stopped early, in words fit for a status line. */
	problems: string[];
}

export interface SyncOptions {
	/** How many days' files to download at most in this run. */
	maxDays?: number;
	/** "Today" as YYYY-MM-DD — fixed in tests. Defaults to the date in India. */
	today?: string;
}

const todayInIndia = (): string => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const addDays = (date: string, days: number): string =>
	new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const isWeekday = (date: string): boolean => {
	const day = new Date(`${date}T00:00:00Z`).getUTCDay();
	return day !== 0 && day !== 6;
};
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const minDate = (a: string | null, b: string | null) => (a && b ? (a < b ? a : b) : (a ?? b));
const maxDate = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b));

async function savePayload(row: {
	source: string;
	key: string;
	url: string;
	status: "ok" | "missing";
	bytes: Buffer | null;
}): Promise<void> {
	const data = {
		url: row.url,
		status: row.status,
		sha256: row.bytes ? sha256(row.bytes) : null,
		sizeBytes: row.bytes?.length ?? 0,
		content: row.bytes,
		fetchedAt: Date.now(),
	};
	const updated = await db.providerPayloads.where({ source: row.source, key: row.key }).update(data);
	if (updated === 0) await db.providerPayloads.create({ source: row.source, key: row.key, ...data });
}

async function insertBars(
	bars: { instrumentId: string; barDate: string; close: string; source: string }[],
): Promise<number> {
	let written = 0;
	for (let i = 0; i < bars.length; i += 1000) {
		const chunk = bars.slice(i, i + 1000);
		// A bar already held is left as it is: published closes do not change.
		const result = await db.$query`
			INSERT INTO price_bars (instrument_id, resolution, bar_date, close, source)
			SELECT t.instrument_id, '1d', t.bar_date, t.close, t.source
			FROM unnest(
				${chunk.map((b) => b.instrumentId)}::text[],
				${chunk.map((b) => b.barDate)}::date[],
				${chunk.map((b) => b.close)}::numeric[],
				${chunk.map((b) => b.source)}::text[]
			) AS t(instrument_id, bar_date, close, source)
			ON CONFLICT DO NOTHING`;
		written += result.rowCount ?? 0;
	}
	return written;
}

// ── 1. What needs pricing, and since when ───────────────────────────────

async function trackInstruments(): Promise<void> {
	const held = await db.$query<{ instrument_id: string; since: string }>`
		SELECT instrument_id, min(trade_date)::text AS since FROM trades WHERE is_live GROUP BY 1`;
	// When something turns out to have been held earlier than known, its
	// prices are gone through again from the new start.
	for (const row of held.rows)
		await db.instruments
			.where({ id: row.instrument_id })
			.whereSql`"tracked_since" IS NULL OR "tracked_since" > ${row.since}::date`
			.update({ trackedSince: row.since, pricedFrom: null, pricedThrough: null });

	// The benchmarks are needed from the first day anyone has money in.
	const first = await db.$query<{ since: string | null }>`
		SELECT least(
			(SELECT min(trade_date) FROM trades WHERE is_live),
			(SELECT min(flow_date) FROM cash_flows WHERE is_live)
		)::text AS since`;
	const since = first.rows[0]?.since;
	if (since)
		await db.instruments
			.whereSql`"slug" IS NOT NULL AND ("tracked_since" IS NULL OR "tracked_since" > ${addDays(since, -7)}::date)`
			.update({ trackedSince: addDays(since, -7), pricedFrom: null, pricedThrough: null });
}

// ── 2. Fetch the days that are not held yet ─────────────────────────────

async function fetchBhavcopies(
	from: string,
	today: string,
	maxDays: number,
	report: SyncReport,
): Promise<void> {
	const held = new Set(
		await db.providerPayloads
			.where({ source: BHAVCOPY, key: { gte: from } })
			.pluck("key"),
	);
	const wanted: string[] = [];
	for (let d = from; d <= today; d = addDays(d, 1)) if (isWeekday(d) && !held.has(d)) wanted.push(d);
	// The last few days first, so today's value is right early; then the
	// history, oldest first, so the series fills in without holes.
	const recent = wanted.filter((d) => d > addDays(today, -7)).reverse();
	const queue = [...recent, ...wanted.filter((d) => !recent.includes(d))];
	const batch = queue.slice(0, maxDays);
	report.daysRemaining = queue.length - batch.length;

	let refused: string | null = null;
	const fetchDay = async (date: string) => {
		if (refused) return;
		for (const url of bhavcopyUrls(date)) {
			const file = await fetchMarketFile(url);
			if (file.status === 200 && file.bytes.length > 100) {
				await savePayload({ source: BHAVCOPY, key: date, url, status: "ok", bytes: file.bytes });
				report.daysFetched++;
				return;
			}
			if (file.status !== 404) {
				refused = `NSE answered ${file.status} for ${date}`;
				return;
			}
		}
		// Nothing published. For a past day that is a holiday, and worth
		// remembering; for today it only means "not yet".
		if (date < today)
			await savePayload({
				source: BHAVCOPY,
				key: date,
				url: bhavcopyUrls(date)[0] as string,
				status: "missing",
				bytes: null,
			});
	};
	for (let i = 0; i < batch.length && !refused; i += FETCH_AT_ONCE)
		await Promise.all(
			batch.slice(i, i + FETCH_AT_ONCE).map((date) =>
				fetchDay(date).catch((error) => {
					refused = `Could not reach NSE for ${date}: ${error instanceof Error ? error.message : error}`;
				}),
			),
		);
	if (refused) report.problems.push(refused);
}

// ── 3. Closes for tracked instruments, from the files held ──────────────

async function applyBhavcopies(today: string, report: SyncReport): Promise<void> {
	const instruments = await db.instruments
		.whereSql`"tracked_since" IS NOT NULL AND "isin" IS NOT NULL AND ("price_source" IS NULL OR "price_source" = 'nse')`
		.select("id", "isin", "priceSource", "trackedSince", "pricedThrough");
	if (instruments.length === 0) return;

	const from = instruments.map((i) => i.trackedSince as string).sort()[0] as string;
	const held = await db.providerPayloads
		.where({ source: BHAVCOPY, key: { gte: from, lte: today } })
		.order({ key: "ASC" })
		.select("key", "status");
	const fetched = new Set(held.map((h) => h.key));
	const days = held.filter((h) => h.status === "ok").map((h) => h.key);

	// `pricedThrough` is a frontier: every day up to it has been gone through
	// for that instrument. Files arrive out of order (the newest first, then
	// the history), so a day is read again until the frontier has passed it —
	// reading one twice adds nothing, and no day in between is ever skipped.
	const needs = (i: (typeof instruments)[number], day: string) =>
		day >= (i.trackedSince as string) && (i.pricedThrough === null || day > i.pricedThrough);
	const todo = days.filter((day) => instruments.some((i) => needs(i, day)));

	const formerIsins = new Map<string, string[]>();
	for (const a of await db.instrumentAliases
		.where({ aliasKind: "old_isin", instrumentId: { in: instruments.map((i) => i.id) } })
		.select("instrumentId", "alias"))
		formerIsins.set(a.instrumentId, [...(formerIsins.get(a.instrumentId) ?? []), a.alias]);

	const found = new Set<string>();
	for (let offset = 0; offset < todo.length; offset += 20) {
		const files = await db.providerPayloads
			.where({ source: BHAVCOPY, key: { in: todo.slice(offset, offset + 20) } })
			.order({ key: "ASC" })
			.select("key", "content");
		const bars: Parameters<typeof insertBars>[0] = [];
		for (const file of files) {
			if (!file.content) continue;
			let closes: Map<string, string>;
			try {
				closes = new Map(parseBhavcopy(file.content).map((row) => [row.isin, row.close]));
			} catch (error) {
				report.problems.push(`Could not read the bhavcopy for ${file.key}: ${error}`);
				continue;
			}
			// Built only if a share is missing under every number known for it.
			let byLine: Map<string, string[]> | null = null;
			for (const i of instruments) {
				if (!needs(i, file.key)) continue;
				const numbers = [i.isin as string, ...(formerIsins.get(i.id) ?? [])];
				let close = numbers.map((isin) => closes.get(isin)).find(Boolean);
				if (!close) {
					// A face-value split gives the share a new ISIN from the ex-date:
					// the one row on the same share line is the same share.
					const line = shareLineOf(i.isin as string);
					if (line) {
						if (!byLine) {
							byLine = new Map();
							for (const isin of closes.keys()) {
								const l = shareLineOf(isin);
								if (l) byLine.set(l, [...(byLine.get(l) ?? []), isin]);
							}
						}
						const candidates = byLine.get(line) ?? [];
						const next = candidates.length === 1 ? candidates[0] : undefined;
						if (next) {
							const was = i.isin as string;
							i.isin = await adoptIsin(i, next, file.key);
							formerIsins.set(i.id, [...new Set([...(formerIsins.get(i.id) ?? []), was, next])]);
							close = closes.get(next);
						}
					}
				}
				if (!close) continue;
				bars.push({ instrumentId: i.id, barDate: file.key, close, source: "nse" });
				found.add(i.id);
			}
		}
		report.barsWritten += await insertBars(bars);
	}

	for (const i of instruments) {
		// Move the frontier to the last day before the first one not fetched yet.
		let frontier = i.pricedThrough;
		for (let d = frontier ? addDays(frontier, 1) : (i.trackedSince as string); d <= today; d = addDays(d, 1)) {
			if (isWeekday(d) && !fetched.has(d)) break;
			frontier = d;
		}
		const priced = found.has(i.id) && i.priceSource === null;
		if (frontier !== i.pricedThrough || priced)
			await db.instruments.where({ id: i.id }).update({
				pricedFrom: i.trackedSince,
				pricedThrough: frontier,
				// Seen on NSE at least once: that is where its price comes from.
				...(priced ? { priceSource: "nse" } : {}),
			});
	}
}

// ── 4. Funds and benchmarks: NAV history per scheme ─────────────────────

async function resolveFunds(report: SyncReport): Promise<void> {
	// Fund ISINs (INF…) that NSE's files have been checked for and do not carry.
	const unknown = await db.instruments
		.whereSql`"tracked_since" IS NOT NULL AND "price_source" IS NULL AND "isin" LIKE 'INF%' AND "priced_through" IS NOT NULL`
		.select("id", "isin");
	if (unknown.length === 0) return;

	const cached = await db.providerPayloads
		.where({ source: AMFI_ALL, key: "latest" })
		.select("fetchedAt", "content")
		.takeOptional();
	let text = cached?.content ? Buffer.from(cached.content).toString("utf8") : null;
	if (!text || Date.now() - (cached?.fetchedAt ?? 0) > AMFI_MAX_AGE_MS) {
		const file = await fetchMarketFile(AMFI_NAV_ALL_URL);
		if (file.status !== 200) {
			report.problems.push(`AMFI answered ${file.status}`);
			if (!text) return;
		} else {
			text = file.bytes.toString("utf8");
			await savePayload({ source: AMFI_ALL, key: "latest", url: AMFI_NAV_ALL_URL, status: "ok", bytes: file.bytes });
		}
	}
	const schemes = parseAmfiNavAll(text);
	for (const i of unknown) {
		const scheme = schemes.get(i.isin as string);
		if (!scheme) continue;
		await db.instruments
			.where({ id: i.id })
			.update({ priceSource: "amfi", amfiCode: scheme.code, kind: "mf", name: scheme.name, pricedFrom: null, pricedThrough: null });
	}
}

async function syncNavs(today: string, report: SyncReport): Promise<void> {
	const funds = await db.instruments
		.whereSql`"tracked_since" IS NOT NULL AND "price_source" = 'amfi' AND "amfi_code" IS NOT NULL`
		.select("id", "amfiCode", "trackedSince", "pricedFrom", "pricedThrough");
	for (const fund of funds) {
		const code = fund.amfiCode as string;
		const since = fund.trackedSince as string;
		// The whole history the first time (or when it must reach further back);
		// after that, only the days since the last one held.
		const backfill = fund.pricedThrough === null || since < (fund.pricedFrom ?? since);
		if (!backfill && (fund.pricedThrough as string) >= today) continue;
		const url = backfill ? mfapiUrl(code) : mfapiUrl(code, addDays(fund.pricedThrough as string, 1), today);
		try {
			const file = await fetchMarketFile(url);
			if (file.status !== 200) {
				report.problems.push(`mfapi answered ${file.status} for scheme ${code}`);
				continue;
			}
			const points = parseMfapi(file.bytes.toString("utf8"));
			if (backfill) await savePayload({ source: MFAPI, key: code, url, status: "ok", bytes: file.bytes });
			report.barsWritten += await insertBars(
				points
					.filter((p) => p.date >= addDays(since, -10))
					.map((p) => ({ instrumentId: fund.id, barDate: p.date, close: p.nav, source: "amfi" })),
			);
			const last = points[points.length - 1]?.date ?? null;
			await db.instruments.where({ id: fund.id }).update({
				// After a full pull, everything from `since` on is covered — even when
				// the scheme itself only began later (there is nothing earlier to get).
				pricedFrom: backfill ? minDate(since, points[0]?.date ?? since) : fund.pricedFrom,
				pricedThrough: maxDate(fund.pricedThrough, last),
			});
		} catch (error) {
			report.problems.push(`Could not reach mfapi for scheme ${code}: ${error instanceof Error ? error.message : error}`);
		}
	}
}

// ── The run ─────────────────────────────────────────────────────────────

async function acquireLease(): Promise<boolean> {
	const now = Date.now();
	const taken = await db.marketState
		.where({ id: 1 })
		.whereSql`"sync_lease_until" IS NULL OR "sync_lease_until" < now()`
		.update({ syncLeaseUntil: now + LEASE_MS });
	return taken > 0;
}

async function run(options: SyncOptions): Promise<SyncReport> {
	const report: SyncReport = {
		daysFetched: 0,
		daysRemaining: 0,
		barsWritten: 0,
		actionsFound: 0,
		actionsApplied: 0,
		problems: [],
	};
	if (!(await acquireLease())) {
		report.problems.push("Another sync is running");
		return report;
	}
	const today = options.today ?? todayInIndia();
	try {
		await trackInstruments();
		const earliest = await db.$query<{ since: string | null }>`
			SELECT min(tracked_since)::text AS since FROM instruments
			WHERE tracked_since IS NOT NULL AND isin IS NOT NULL AND (price_source IS NULL OR price_source = 'nse')`;
		const from = earliest.rows[0]?.since;
		if (from) {
			await fetchBhavcopies(from, today, options.maxDays ?? 60, report);
			await applyBhavcopies(today, report);
		}
		// Only once NSE's files have been gone through can "not on NSE" be said.
		if (report.daysRemaining === 0) await resolveFunds(report);
		await syncNavs(today, report);
		// 5. Splits and bonuses: what the exchange announced, applied where Kosh is sure.
		report.actionsFound = await syncCorporateActions(today, report.problems);
		report.actionsApplied = await settleActions();
	} finally {
		const note =
			report.problems.length > 0
				? report.problems.slice(0, 3).join("; ")
				: `${report.daysFetched} days fetched, ${report.barsWritten} prices added${report.daysRemaining > 0 ? `, ${report.daysRemaining} days still to fetch` : ""}`;
		await db.marketState.where({ id: 1 }).update({
			syncLeaseUntil: null,
			lastSyncAt: Date.now(),
			lastSyncNote: note,
		});
		if (report.barsWritten > 0) await db.marketState.where({ id: 1 }).increment("pricesVersion");
	}
	return report;
}

/** Bring prices up to date. Bounded per run; see `SyncReport.daysRemaining`. */
export function syncMarketData(options: SyncOptions = {}): Promise<SyncReport> {
	// Never inside someone's request scope: this job is about every account.
	return getRequestContext() ? requestContext.exit(() => run(options)) : run(options);
}

let background: Promise<void> | null = null;

/**
 * Start a sync without waiting for it, and keep going until nothing is left
 * to fetch (or it cannot go on). One at a time per process.
 */
export function kickMarketSync(): void {
	if (background) return;
	background = (async () => {
		for (let round = 0; round < 200; round++) {
			const report = await syncMarketData({ maxDays: 120 });
			if (report.problems.length > 0) {
				logger.warn({ problems: report.problems }, "Market data sync stopped early");
				return;
			}
			if (report.daysRemaining === 0) return;
		}
	})()
		.catch((error) => logger.error({ error }, "Market data sync failed"))
		.finally(() => {
			background = null;
		});
}
