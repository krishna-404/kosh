/**
 * Mutual-fund NAVs. AMFI's NAVAll lists every scheme with today's NAV and its
 * ISINs — Kosh uses it to find a fund's scheme code from the ISIN in a
 * statement. A scheme's NAV history comes from mfapi.in, which republishes
 * AMFI's history per scheme.
 */
export const AMFI_NAV_ALL_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";

export interface AmfiScheme {
	code: string;
	name: string;
}

/**
 * NAVAll.txt → ISIN → scheme. Lines are
 * `Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;NAV;Date`,
 * between headings and blank lines that are skipped.
 */
export function parseAmfiNavAll(text: string): Map<string, AmfiScheme> {
	const byIsin = new Map<string, AmfiScheme>();
	for (const line of text.split(/\r?\n/)) {
		const parts = line.split(";");
		if (parts.length < 6 || !/^\d+$/.test((parts[0] ?? "").trim())) continue;
		const scheme = { code: (parts[0] as string).trim(), name: (parts[3] ?? "").trim() };
		for (const isin of [parts[1], parts[2]]) {
			const clean = (isin ?? "").trim();
			if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(clean)) byIsin.set(clean, scheme);
		}
	}
	return byIsin;
}

/** A scheme's NAV history; `from` (YYYY-MM-DD) asks only for days since then. */
export const mfapiUrl = (schemeCode: string, from?: string, to?: string): string =>
	`https://api.mfapi.in/mf/${schemeCode}${from ? `?startDate=${from}&endDate=${to ?? from}` : ""}`;

export interface NavPoint {
	/** YYYY-MM-DD */
	date: string;
	nav: string;
}

/** mfapi's JSON → NAVs oldest first. Its dates are DD-MM-YYYY, newest first. */
export function parseMfapi(json: string): NavPoint[] {
	const body = JSON.parse(json) as { data?: { date?: string; nav?: string }[] };
	const points: NavPoint[] = [];
	for (const row of body.data ?? []) {
		const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(row.date ?? "");
		const nav = (row.nav ?? "").trim();
		if (!match || !/^\d+(\.\d+)?$/.test(nav) || Number(nav) <= 0) continue;
		points.push({ date: `${match[3]}-${match[2]}-${match[1]}`, nav });
	}
	return points.sort((a, b) => a.date.localeCompare(b.date));
}
