import { parseCsv } from "@connected-repo/broker-parsers/csv";
import { unzipSync } from "fflate";

/**
 * NSE's daily "bhavcopy": one file per trading day with every listed
 * security's close. The stable, bulk way to get prices — one request a day
 * instead of one per share.
 *
 * Two layouts exist: the old one (to early July 2024) and the UDiFF layout
 * since. Both carry the ISIN, which is how Kosh matches a row to a holding.
 */
export interface BhavRow {
	isin: string;
	symbol: string;
	series: string;
	/** Decimal string, as published. */
	close: string;
	name: string | null;
}

/** The first trading day published in the UDiFF layout. */
const UDIFF_FROM = "2024-07-08";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const ARCHIVE = "https://nsearchives.nseindia.com/content";

/** Where a day's file may be, most likely first. `date` is YYYY-MM-DD. */
export function bhavcopyUrls(date: string): string[] {
	const [yyyy = "", mm = "", dd = ""] = date.split("-");
	const udiff = `${ARCHIVE}/cm/BhavCopy_NSE_CM_0_0_0_${yyyy}${mm}${dd}_F_0000.csv.zip`;
	const month = MONTHS[Number(mm) - 1];
	const old = `${ARCHIVE}/historical/EQUITIES/${yyyy}/${month}/cm${dd}${month}${yyyy}bhav.csv.zip`;
	// Around the changeover either may be the one that exists.
	return date >= UDIFF_FROM ? [udiff, old] : [old, udiff];
}

/** When a security is listed under several series on one day, which row to trust. */
const SERIES_RANK: Record<string, number> = { EQ: 0, BE: 1, BZ: 2, SM: 3, ST: 4 };
const rank = (series: string) => SERIES_RANK[series] ?? 9;

/** A day's zip → one row per ISIN. Throws if it is not a bhavcopy. */
export function parseBhavcopy(zip: Uint8Array): BhavRow[] {
	const files = unzipSync(zip);
	const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
	if (!name) throw new Error("Bhavcopy zip holds no CSV");
	const csv = parseCsv(Buffer.from(files[name] as Uint8Array).toString("utf8"));
	const header = csv.header.map((h) => h.trim().toUpperCase());
	const at = (...names: string[]) => {
		for (const n of names) {
			const i = header.indexOf(n);
			if (i !== -1) return i;
		}
		return -1;
	};
	const col = {
		isin: at("ISIN"),
		symbol: at("TCKRSYMB", "SYMBOL"),
		series: at("SCTYSRS", "SERIES"),
		close: at("CLSPRIC", "CLOSE"),
		name: at("FININSTRMNM"),
	};
	if (col.isin === -1 || col.symbol === -1 || col.close === -1)
		throw new Error(`Not a bhavcopy: columns are ${header.slice(0, 8).join(", ")}…`);

	const best = new Map<string, BhavRow>();
	for (const record of csv.records) {
		const isin = (record[col.isin] ?? "").trim();
		const close = (record[col.close] ?? "").trim();
		if (!isin || !/^\d+(\.\d+)?$/.test(close) || Number(close) <= 0) continue;
		const row: BhavRow = {
			isin,
			symbol: (record[col.symbol] ?? "").trim(),
			series: col.series === -1 ? "" : (record[col.series] ?? "").trim(),
			close,
			name: col.name === -1 ? null : (record[col.name] ?? "").trim() || null,
		};
		const have = best.get(isin);
		if (!have || rank(row.series) < rank(have.series)) best.set(isin, row);
	}
	return [...best.values()];
}

/** Words the exchange writes in capitals that are not acronyms are set in ordinary case; these stay as they are. */
const KEEP_UPPER = new Set([
	"ICICI", "ITC", "SBI", "LIC", "IDFC", "IDBI", "HCL", "ONGC", "GAIL", "SAIL", "UPL", "DLF", "IRCTC", "ETF", "NIFTY",
	"UTI", "AU", "IIFL", "REC", "PFC", "NHPC", "IOB", "UCO", "AIA", "IT", "II", "III", "IV",
]);
const SMALL = new Set(["of", "and", "the", "for", "in"]);

/**
 * The exchange's name for a company ("BHARTI AIRTEL LIMITED") as a person
 * would write it ("Bharti Airtel Ltd"). Acronyms it can recognise — a word
 * with no vowel, or one on the short list above — keep their capitals.
 */
export function companyName(raw: string): string {
	return raw
		.trim()
		.split(/\s+/)
		.map((word, index) => {
			const bare = word.replace(/[^A-Za-z]/g, "").toUpperCase();
			if (bare === "LIMITED" || bare === "LTD") return "Ltd";
			if (KEEP_UPPER.has(bare) || (bare.length >= 2 && bare.length <= 5 && !/[AEIOUY]/.test(bare))) return word.toUpperCase();
			const lower = word.toLowerCase();
			if (index > 0 && SMALL.has(lower)) return lower;
			return lower.replace(/(^|[-&(/.])([a-z])/g, (_match, lead: string, letter: string) => lead + letter.toUpperCase());
		})
		.join(" ");
}
