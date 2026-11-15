import { db } from "@backend/db/db";

/**
 * One share, several ISINs.
 *
 * When a company changes its face value (a split), the exchange gives the
 * share a new ISIN from the ex-date: HDFC Bank was INE040A01018, then
 * INE040A01026, now INE040A01034. Statements from before the change carry
 * the old number, price files after it carry the new one — and unless Kosh
 * knows they are the same share, prices stop on the split day and later
 * trades land on what looks like a different share.
 *
 * An Indian equity ISIN is `IN` + `E` + issuer (4) + security type (2) +
 * serial (2) + check digit. A face-value change moves only the serial, so
 * the first nine characters name the share line. (Partly-paid shares and
 * DVRs sit under a different prefix or security type, so they do not match.)
 */
const EQUITY_ISIN = /^INE[A-Z0-9]{4}01\d{3}$/;

/** The share line an ISIN belongs to, or null when the rule does not apply (funds, bonds, foreign). */
export function shareLineOf(isin: string): string | null {
	return EQUITY_ISIN.test(isin) ? isin.slice(0, 9) : null;
}

const serialOf = (isin: string) => Number(isin.slice(9, 11));

/**
 * Note that `isin` is the same share as `instrument`. The instrument keeps
 * the newest number as its own; the others are kept as `old_isin` aliases.
 * Returns the instrument's ISIN afterwards.
 */
export async function adoptIsin(
	instrument: { id: string; isin: string | null },
	isin: string,
	seenOn: string | null = null,
): Promise<string> {
	if (instrument.isin === isin) return isin;
	const remember = async (alias: string, validTo: string | null) => {
		const have = await db.instrumentAliases
			.where({ instrumentId: instrument.id, aliasKind: "old_isin", alias })
			.exists();
		if (!have)
			await db.instrumentAliases.create({ instrumentId: instrument.id, aliasKind: "old_isin", alias, validTo });
	};
	if (instrument.isin !== null && serialOf(isin) > serialOf(instrument.isin)) {
		await remember(instrument.isin, seenOn);
		await db.instrumentAliases.where({ instrumentId: instrument.id, aliasKind: "old_isin", alias: isin }).delete();
		await db.instruments.where({ id: instrument.id }).update({ isin });
		return isin;
	}
	await remember(isin, null);
	return instrument.isin ?? isin;
}

/**
 * The instrument behind each ISIN: by its own number, by one it used to
 * have, or — for a number not seen before — by its share line, which is
 * then remembered. ISINs nothing is known about are left out.
 */
export async function findInstrumentsByIsin(isins: string[]): Promise<Map<string, string>> {
	const found = new Map<string, string>();
	let rest = [...new Set(isins)];
	if (rest.length === 0) return found;

	for (const i of await db.instruments.where({ isin: { in: rest } }).select("id", "isin"))
		found.set(i.isin as string, i.id);
	rest = rest.filter((isin) => !found.has(isin));
	if (rest.length === 0) return found;

	for (const a of await db.instrumentAliases
		.where({ aliasKind: "old_isin", alias: { in: rest } })
		.select("instrumentId", "alias"))
		found.set(a.alias, a.instrumentId);
	rest = rest.filter((isin) => !found.has(isin));

	const lines = [...new Set(rest.map(shareLineOf).filter((line): line is string => line !== null))];
	if (lines.length === 0) return found;
	const sameLine = await db.instruments
		.where({ OR: lines.map((line) => ({ isin: { startsWith: line } })) })
		.select("id", "isin");
	for (const isin of rest) {
		const line = shareLineOf(isin);
		if (!line) continue;
		const matches = sameLine.filter((i) => (i.isin as string).startsWith(line));
		// Two instruments on one line would be a surprise; guess at neither.
		const match = matches.length === 1 ? matches[0] : undefined;
		if (!match) continue;
		match.isin = await adoptIsin(match, isin);
		found.set(isin, match.id);
	}
	return found;
}
