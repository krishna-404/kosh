import { formatDate } from "@connected-repo/ui-mui/format/date";
import { formatMoney, groupIndian } from "@connected-repo/ui-mui/format/money";
import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";

/**
 * The reasoning behind the dividends panel, kept apart from the drawing so
 * it can be tested: which financial year a dividend falls in, each year's
 * total, how a dividend's working reads, and what its state is called.
 */

// ─── Amounts ────────────────────────────────────────────────────────────

/** "910.00" → 91000. Amounts are added in whole paise so totals never drift. */
export const toPaise = (amount: string): number => Math.round(Number(amount) * 100);

/** 91000 → "910.00", the way the API writes an amount. */
export const fromPaise = (paise: number): string => (paise / 100).toFixed(2);

/** Paise are written only when an amount has any. */
export const paiseShown = (amount: string): 0 | 2 => (toPaise(amount) % 100 === 0 ? 0 : 2);

/** A dividend's amount as it is written: "₹910", "₹1,488.50". */
export const rupees = (amount: string): string => formatMoney(amount, { decimals: paiseShown(amount) });

/** An amount as a person would type it, to start a field from: "910", "1488.50". */
export const typedAmount = (amount: string): string => (toPaise(amount) / 100).toFixed(paiseShown(amount));

/**
 * What was announced per share: "₹26.00", "₹6.50". An announcement finer
 * than a paisa ("2.125") is written out in full rather than rounded, so the
 * working still multiplies out.
 */
export const perShare = (amountPerShare: string): string => {
	const [whole = "0", fraction = ""] = amountPerShare.split(".");
	return fraction.length > 2
		? `${formatMoney(whole)}.${fraction}`
		: formatMoney(amountPerShare, { decimals: 2 });
};

/** "1284" → "1,284"; "12.500" → "12.5". */
export const shareCount = (quantity: string): string => {
	const n = Number(quantity);
	if (!Number.isFinite(n)) return quantity;
	const [whole = "0", fraction = ""] = n.toFixed(6).split(".");
	const trimmed = fraction.replace(/0+$/, "");
	return trimmed ? `${groupIndian(whole)}.${trimmed}` : groupIndian(whole);
};

type Working = Pick<Dividend, "quantity" | "amountPerShare" | "source">;

/** "1,284 shares × ₹5.00" — or null for one a person entered, which has no working. */
export const sharesTimesPrice = (dividend: Working): string | null => {
	const quantity = Number(dividend.quantity);
	if (dividend.source !== "feed" || !(quantity > 0)) return null;
	return D.shares(shareCount(dividend.quantity), perShare(dividend.amountPerShare), quantity === 1);
};

/** What Kosh worked out was due — the shares × the announcement — or null where it worked nothing out. */
export const workedOutAmount = (dividend: Working): string | null => {
	const quantity = Number(dividend.quantity);
	if (dividend.source !== "feed" || !(quantity > 0)) return null;
	return fromPaise(Math.round(quantity * Number(dividend.amountPerShare) * 100));
};

/** Whether a person said a different amount arrived than Kosh worked out. */
export const amountWasChanged = (dividend: Pick<Dividend, "amount" | "state"> & Working): boolean => {
	const worked = workedOutAmount(dividend);
	return dividend.state === "confirmed" && worked !== null && toPaise(worked) !== toPaise(dividend.amount);
};

/** Whether it is counted in the return: everything except what a person struck out. */
export const isCounted = (dividend: Pick<Dividend, "state">): boolean => dividend.state !== "not_received";

/** The total of the dividends that count, as the API would write it. */
export const countedTotal = (dividends: readonly Pick<Dividend, "amount" | "state">[]): string =>
	fromPaise(dividends.reduce((paise, d) => (isCounted(d) ? paise + toPaise(d.amount) : paise), 0));

// ─── Financial years ────────────────────────────────────────────────────

/** The financial year (April to March) a day falls in, by the year it starts: "2026-03-31" → 2025. */
export const financialYearOf = (isoDate: string): number => {
	const year = Number(isoDate.slice(0, 4));
	const month = Number(isoDate.slice(5, 7));
	return month >= 4 ? year : year - 1;
};

/** 2026 → "2026–27"; 1999 → "1999–00". */
export const financialYearLabel = (startYear: number): string =>
	`${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;

export interface DividendYear<T> {
	/** The year the financial year starts in. */
	startYear: number;
	/** "2026–27" */
	label: string;
	/** Newest first. */
	dividends: T[];
	/** Counted in the return that year: expected and confirmed. */
	total: string;
	toConfirm: number;
	notReceived: number;
}

type Dated = Pick<Dividend, "receivedOn" | "exDate" | "amount" | "state">;

/**
 * The dividends by financial year, newest year first and newest dividend
 * first within it. A dividend belongs to the year of the day it is counted
 * on — the ex-date until someone says when it arrived — so each year's
 * total is what that year's return carries.
 */
export const groupByFinancialYear = <T extends Dated>(dividends: readonly T[]): DividendYear<T>[] => {
	const byYear = new Map<number, T[]>();
	for (const dividend of dividends) {
		const year = financialYearOf(dividend.receivedOn);
		const inYear = byYear.get(year);
		if (inYear) inYear.push(dividend);
		else byYear.set(year, [dividend]);
	}
	return [...byYear.entries()]
		.sort(([a], [b]) => b - a)
		.map(([startYear, inYear]) => ({
			startYear,
			label: financialYearLabel(startYear),
			// A stable sort: ties stay in the order the server sent (newest first).
			dividends: [...inYear].sort(
				(a, b) => b.receivedOn.localeCompare(a.receivedOn) || b.exDate.localeCompare(a.exDate),
			),
			total: countedTotal(inYear),
			toConfirm: inYear.filter((d) => d.state === "expected").length,
			notReceived: inYear.filter((d) => d.state === "not_received").length,
		}));
};

// ─── How one dividend reads ─────────────────────────────────────────────

/** The name to call a script by: its name, or its symbol when it has none. */
export const scriptName = (script: { name: string; symbol: string }): string => script.name.trim() || script.symbol;

type Described = Pick<Dividend, "state" | "source" | "exDate" | "receivedOn">;

/**
 * A dividend's state in words: the label on its tag, and what goes with it —
 * the day it arrived when a person gave one other than the ex-date, or that
 * it is not counted when it never arrived.
 */
export const stateWords = (dividend: Described): { tag: string; note: string | null } => {
	const tag = D.state[dividend.state];
	if (dividend.state === "not_received") return { tag, note: D.notCounted };
	if (dividend.state === "confirmed" && dividend.source === "feed" && dividend.receivedOn !== dividend.exDate)
		return { tag, note: D.arrived(formatDate(dividend.receivedOn)) };
	return { tag, note: null };
};

/**
 * The quiet line under a script's name, as its parts: the ex-date and the
 * working, then the day it arrived when a person gave a different one.
 * Where a person said a different amount arrived, the working carries what
 * it came to, so the two figures are not mistaken for one. One a person
 * entered has only the day it arrived.
 */
export const dividendFacts = (dividend: Described & Working & Pick<Dividend, "amount">): string[] => {
	if (dividend.source === "person") return [D.arrivedOn(formatDate(dividend.receivedOn))];
	const sentence = sharesTimesPrice(dividend);
	const worked = workedOutAmount(dividend);
	const working =
		sentence && worked && amountWasChanged(dividend) ? D.change.working(sentence, rupees(worked)) : sentence;
	const { note } = stateWords(dividend);
	return [
		D.exDate(formatDate(dividend.exDate)),
		...(working ? [working] : []),
		...(dividend.state === "confirmed" && note ? [note] : []),
	];
};

// ─── What a person types ────────────────────────────────────────────────

/**
 * An amount as typed ("₹ 6,420.5") → the form the server takes ("6420.5"),
 * or null when it is not an amount in rupees and paise.
 */
export const parseAmount = (text: string): string | null => {
	const cleaned = text.replace(/[₹,\s]/g, "");
	return /^\d{1,15}(\.\d{1,2})?$/.test(cleaned) ? cleaned : null;
};

/** Whether a typed day is a whole calendar date. */
export const isDay = (date: string): boolean =>
	/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));

/** Today as a calendar date in the viewer's own time zone. */
export const todayIso = (now: Date = new Date()): string => {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** The scripts a dividend could have come from: held now first, then sold, each by name. */
export const payingScripts = <H extends Pick<Holding, "instrumentId" | "name" | "symbol" | "sold">>(
	holdings: readonly H[],
): H[] =>
	[...holdings].sort(
		(a, b) => Number(a.sold) - Number(b.sold) || scriptName(a).localeCompare(scriptName(b), "en-IN"),
	);

interface RefusalLike {
	status?: number;
	data?: { fieldErrors?: { amount?: string[] } };
}

/** Whether the server understood the request and said no — its message is then written for the person. */
export const isRefusal = (error: unknown): boolean => (error as RefusalLike | null)?.status === 400;

/** The server's own words about the amount, when that is what it refused. */
export const amountRefusal = (error: unknown): string | undefined =>
	(error as RefusalLike | null)?.data?.fieldErrors?.amount?.[0];
