import { db } from "@backend/db/db";

// Reading prices. Callers get plain ascending series; "the price on a day"
// is the last close on or before it (markets are shut on most days someone
// might ask about).

export interface CloseSeries {
	/** YYYY-MM-DD, ascending. */
	dates: string[];
	closes: number[];
}

/** Closes for each instrument, oldest first. Instruments with none are absent. */
export async function loadCloses(
	instrumentIds: readonly string[],
	from?: string,
): Promise<Map<string, CloseSeries>> {
	const series = new Map<string, CloseSeries>();
	if (instrumentIds.length === 0) return series;
	const rows = await db.priceBars
		.where({
			instrumentId: { in: [...instrumentIds] },
			resolution: "1d",
			...(from ? { barDate: { gte: from } } : {}),
		})
		.order({ instrumentId: "ASC", barDate: "ASC" })
		.select("instrumentId", "barDate", "close");
	for (const row of rows) {
		let s = series.get(row.instrumentId);
		if (!s) {
			s = { dates: [], closes: [] };
			series.set(row.instrumentId, s);
		}
		s.dates.push(row.barDate);
		s.closes.push(Number(row.close));
	}
	return series;
}

/** Index of the last entry on or before `date`, or -1. */
export function indexOnOrBefore(dates: readonly string[], date: string): number {
	let lo = 0;
	let hi = dates.length - 1;
	let found = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if ((dates[mid] as string) <= date) {
			found = mid;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return found;
}

/** The close on or before `date`; null when the series starts later. */
export function closeOn(series: CloseSeries | undefined, date: string): number | null {
	if (!series) return null;
	const i = indexOnOrBefore(series.dates, date);
	return i === -1 ? null : (series.closes[i] as number);
}

/** The first close on or after `date` — what money arriving that day could buy at. */
export function closeOnOrAfter(series: CloseSeries | undefined, date: string): number | null {
	if (!series) return null;
	const before = indexOnOrBefore(series.dates, date);
	if (before !== -1 && series.dates[before] === date) return series.closes[before] as number;
	const next = series.closes[before + 1];
	return next ?? (before === -1 ? null : (series.closes[before] as number));
}

export interface Benchmark {
	slug: string;
	instrumentId: string;
	name: string;
}

/** What "the same money" is compared with, in display order. */
export async function listBenchmarks(): Promise<Benchmark[]> {
	const rows = await db.instruments.whereSql`"slug" IS NOT NULL`.select("id", "slug", "name");
	const order = ["nifty50", "gold"];
	return rows
		.map((r) => ({ slug: r.slug as string, instrumentId: r.id, name: r.name }))
		.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
}

export interface MarketState {
	pricesVersion: number;
	lastSyncAt: number | null;
	lastSyncNote: string | null;
	lastSyncOk: boolean;
}

export async function getMarketState(): Promise<MarketState> {
	const row = await db.marketState
		.where({ id: 1 })
		.select("pricesVersion", "lastSyncAt", "lastSyncNote", "lastSyncOk")
		.takeOptional();
	return row ?? { pricesVersion: 0, lastSyncAt: null, lastSyncNote: null, lastSyncOk: true };
}
