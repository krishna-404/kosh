import { formatDate, formatDateShort } from "@connected-repo/ui-mui/format/date";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import type { FeeArrangement, FeeKind, FeeOverview } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { errorWords } from "@frontend/modules/access/people.utils";

/**
 * The fee panel's arithmetic and wording, kept apart from React so it can be
 * tested: the sentence for an arrangement, what a person types turned into
 * what the API wants, and the before/after difference in words.
 */

type Payment = FeeOverview["payments"][number];
type Charge = FeeOverview["charges"][number];

// ─── Days ───────────────────────────────────────────────────────────────

/**
 * Today as the server counts it. Every day in Kosh is a day in India (the
 * market's), so the default "today" in a form is India's too — otherwise a
 * payment entered late in the evening abroad could be "tomorrow" there.
 */
export const todayInIndia = (now: Date = new Date()): string => {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
};

/** Whether what was typed is a whole calendar date that exists. */
export const isDay = (text: string): boolean => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
	const date = new Date(`${text}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

/** "2024-04-01" → "2024-03-31". */
export const dayBefore = (day: string): string => {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() - 1);
	return date.toISOString().slice(0, 10);
};

/** "2024-03-31" → "2024-04-01". */
export const dayAfter = (day: string): string => {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + 1);
	return date.toISOString().slice(0, 10);
};

// ─── Rates and amounts, as written ──────────────────────────────────────

/** The fewest decimals (0–4) that show a rate without rounding it: 0.015 → 1, 0.2 → 0, 0.0125 → 2. */
const rateDecimals = (fraction: number): number => {
	const percent = Number((fraction * 100).toFixed(4));
	for (let decimals = 0; decimals < 4; decimals++)
		if (Number(percent.toFixed(decimals)) === percent) return decimals;
	return 4;
};

/** A rate as it was set: 0.015 → "1.5%", 0.2 → "20%", 0.0125 → "1.25%" — never rounded to one decimal. */
export const rateWords = (fraction: number): string =>
	formatPercent(fraction, { decimals: rateDecimals(fraction) });

/** A yearly amount or a payment: paise only when there are some. */
export const amountWords = (amount: string): string =>
	formatMoney(amount, { decimals: Number.isInteger(Number(amount)) ? 0 : 2 });

// ─── What a person types → what the API wants ───────────────────────────

export type PercentProblem = "empty" | "not_a_number" | "zero" | "too_big" | "too_fine";
export type AmountProblem = "empty" | "not_an_amount" | "zero";
export type Parsed<Value, Problem> = { ok: true; value: Value } | { ok: false; problem: Problem };

/**
 * "1.5" (or "1.5 %") → 0.015, the fraction the API takes. More than zero
 * (zero is allowed for a hurdle), at most 100, at most four decimals — the
 * server keeps six of the fraction.
 */
export const percentToFraction = (
	text: string,
	options: { allowZero?: boolean } = {},
): Parsed<number, PercentProblem> => {
	const typed = text.replace(/\s+/g, "").replace(/%$/, "");
	if (typed === "") return { ok: false, problem: "empty" };
	if (!/^(\d+\.?\d*|\.\d+)$/.test(typed)) return { ok: false, problem: "not_a_number" };
	const percent = Number(typed);
	if ((typed.split(".")[1] ?? "").length > 4) return { ok: false, problem: "too_fine" };
	if (percent > 100) return { ok: false, problem: "too_big" };
	if (percent === 0 && !options.allowZero) return { ok: false, problem: "zero" };
	// 1.1 / 100 is 0.011000000000000001 in floating point; send 0.011.
	return { ok: true, value: Number((percent / 100).toFixed(6)) };
};

/** 0.015 → "1.5", for a field a person will edit. */
export const fractionToPercentText = (fraction: number): string =>
	String(Number((fraction * 100).toFixed(4)));

/** "₹1,20,000" or "6420.5" → "120000" / "6420.5": a decimal string in rupees, more than zero. */
export const parseAmount = (text: string): Parsed<string, AmountProblem> => {
	const typed = text.replace(/[\s,₹]/g, "");
	if (typed === "") return { ok: false, problem: "empty" };
	if (!/^\d{1,15}(\.\d{1,2})?$/.test(typed)) return { ok: false, problem: "not_an_amount" };
	if (Number(typed) === 0) return { ok: false, problem: "zero" };
	return { ok: true, value: typed.replace(/^0+(?=\d)/, "") };
};

/** The words for a percentage that could not be read. `what` picks the "nothing typed" line. */
export const percentProblemWords = (problem: PercentProblem, what: "rate" | "share" | "hurdle"): string => {
	const p = FEES.form.problems;
	if (problem === "empty") return what === "share" ? p.shareEmpty : p.rateEmpty;
	return {
		not_a_number: p.notPercent,
		zero: p.percentZero,
		too_big: p.percentTooBig,
		too_fine: p.percentTooFine,
	}[problem];
};

export const amountProblemWords = (problem: AmountProblem): string =>
	({
		empty: FEES.form.problems.amountEmpty,
		not_an_amount: FEES.form.problems.notAmount,
		zero: FEES.form.problems.amountZero,
	})[problem];

/** What the "set what the manager is paid" form holds: text, exactly as typed. */
export interface FeeForm {
	kind: FeeKind;
	/** Percentage a year, for a percentage of the account's value. */
	rate: string;
	/** Rupees a year, for a fixed amount. */
	amount: string;
	/** Percentage of the profit, for a profit share. */
	share: string;
	/** Percentage a year the profit must clear first; empty means none. */
	hurdle: string;
	payee: string;
	startsOn: string;
}

export interface FeeSetInput {
	accountId: string;
	kind: FeeKind;
	payee?: string;
	rate?: number;
	amountPerYear?: string;
	hurdleRate?: number;
	startsOn: string;
}

export type FeeFormField = "rate" | "amount" | "share" | "hurdle" | "startsOn";
export type FeeFormProblems = Partial<Record<FeeFormField, string>>;

/**
 * The form as the API's input — only the fields its kind needs — or the
 * words to put under each field that cannot be sent as typed.
 */
export const feeSetInput = (
	accountId: string,
	form: FeeForm,
): { ok: true; input: FeeSetInput } | { ok: false; problems: FeeFormProblems } => {
	const problems: FeeFormProblems = {};
	const input: FeeSetInput = { accountId, kind: form.kind, startsOn: form.startsOn };

	if (form.kind === "percent_of_assets") {
		const rate = percentToFraction(form.rate);
		if (rate.ok) input.rate = rate.value;
		else problems.rate = percentProblemWords(rate.problem, "rate");
	}
	if (form.kind === "fixed") {
		const amount = parseAmount(form.amount);
		if (amount.ok) input.amountPerYear = amount.value;
		else problems.amount = amountProblemWords(amount.problem);
	}
	if (form.kind === "profit_share") {
		const share = percentToFraction(form.share);
		if (share.ok) input.rate = share.value;
		else problems.share = percentProblemWords(share.problem, "share");
		// No hurdle typed means no hurdle.
		const hurdle = form.hurdle.trim() === "" ? ({ ok: true, value: 0 } as const) : percentToFraction(form.hurdle, { allowZero: true });
		if (hurdle.ok) input.hurdleRate = hurdle.value;
		else problems.hurdle = percentProblemWords(hurdle.problem, "hurdle");
	}
	const payee = form.payee.trim();
	if (payee !== "") input.payee = payee;
	if (!isDay(form.startsOn)) problems.startsOn = FEES.form.problems.dayMissing;

	return Object.keys(problems).length > 0 ? { ok: false, problems } : { ok: true, input };
};

/** The form to start from: empty, or the arrangement being changed. Starts today either way. */
export const feeFormFrom = (arrangement: FeeArrangement | null, today: string): FeeForm => ({
	kind: arrangement?.kind ?? "percent_of_assets",
	rate:
		arrangement?.kind === "percent_of_assets" && arrangement.rate !== null
			? fractionToPercentText(arrangement.rate)
			: "",
	amount: arrangement?.kind === "fixed" && arrangement.amountPerYear !== null ? arrangement.amountPerYear.replace(/\.00$/, "") : "",
	share:
		arrangement?.kind === "profit_share" && arrangement.rate !== null
			? fractionToPercentText(arrangement.rate)
			: "",
	hurdle:
		arrangement?.kind === "profit_share" && arrangement.hurdleRate !== null && arrangement.hurdleRate > 0
			? fractionToPercentText(arrangement.hurdleRate)
			: "",
	payee: arrangement?.payee ?? "",
	startsOn: today,
});

// ─── The arrangement, as a sentence ─────────────────────────────────────

/** What is paid, and to whom: "1.5% of the account’s value a year, paid to Ramesh Iyer". */
export const termsWords = (arrangement: FeeArrangement): string => {
	const { kind, rate, amountPerYear, hurdleRate, payee } = arrangement;
	if (kind === "invoiced") return payee ? FEES.terms.invoicedTo(payee) : FEES.terms.invoiced;
	const terms =
		kind === "percent_of_assets"
			? FEES.terms.percentOfAssets(rate === null ? "—" : rateWords(rate))
			: kind === "fixed"
				? FEES.terms.fixed(amountPerYear === null ? "—" : amountWords(amountPerYear))
				: hurdleRate !== null && hurdleRate > 0
					? FEES.terms.profitShareAbove(rate === null ? "—" : rateWords(rate), rateWords(hurdleRate))
					: FEES.terms.profitShare(rate === null ? "—" : rateWords(rate));
	return payee ? `${terms}, ${FEES.paidTo(payee)}` : terms;
};

/** When it runs: "since 1 Apr 2024", "from 1 Apr 2024 to 30 Sep 2025", "from 1 Jan 2027". */
export const datesWords = (arrangement: Pick<FeeArrangement, "startsOn" | "endsOn">, today: string): string => {
	const { startsOn, endsOn } = arrangement;
	if (endsOn !== null && endsOn < today)
		return startsOn === endsOn ? FEES.onOnly(formatDate(startsOn)) : FEES.fromTo(formatDate(startsOn), formatDate(endsOn));
	if (startsOn > today)
		return endsOn === null ? FEES.from(formatDate(startsOn)) : FEES.fromTo(formatDate(startsOn), formatDate(endsOn));
	const since = FEES.since(formatDate(startsOn));
	if (endsOn === null) return since;
	return `${since}, ${endsOn === today ? FEES.endingToday : FEES.until(formatDate(endsOn))}`;
};

/**
 * The arrangement as a person would say it: "1.5% of the account’s value a
 * year, paid to Ramesh Iyer, since 1 Apr 2024".
 */
export const arrangementSentence = (arrangement: FeeArrangement, today: string): string =>
	`${termsWords(arrangement)}, ${datesWords(arrangement, today)}`;

/** The days a quarter's fee is billed on, and the day a year's profit share is settled — as the kit writes dates. */
const QUARTER_ENDS = ["03-31", "06-30", "09-30", "12-31"].map((day) => formatDateShort(`2001-${day}`));
const YEAR_END = QUARTER_ENDS[0] as string;
const listWords = (items: readonly string[]): string =>
	items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** How this arrangement is worked out, in plain sentences. */
export const howWorkedOut = (arrangement: Pick<FeeArrangement, "kind" | "hurdleRate">): string[] => {
	const { kind, hurdleRate } = arrangement;
	if (kind === "invoiced") return [FEES.how.invoiced];
	if (kind === "profit_share")
		return [
			FEES.how.profit_share(YEAR_END),
			...(hurdleRate !== null && hurdleRate > 0 ? [FEES.howHurdle(rateWords(hurdleRate))] : []),
			FEES.howBuiltUp,
		];
	return [FEES.how[kind](listWords(QUARTER_ENDS)), FEES.howBuiltUp];
};

// ─── What is there already ──────────────────────────────────────────────

/**
 * The overview's `earlier` is every other arrangement on the account — one
 * entered for a later day is in it too. Those are what comes next, not what
 * came before.
 */
export const splitEarlier = (
	earlier: readonly FeeArrangement[],
	today: string,
): { upcoming: FeeArrangement[]; past: FeeArrangement[] } => ({
	upcoming: earlier.filter((a) => a.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn)),
	past: earlier.filter((a) => a.startsOn <= today),
});

/**
 * What setting an arrangement from `startsOn` does to the ones already there
 * (the server's rule): one running on that day ends the day before; any that
 * start on or after it are replaced; the rest are left alone.
 */
export const whatChanges = (
	existing: readonly FeeArrangement[],
	startsOn: string,
): { cutShort: FeeArrangement[]; replaced: FeeArrangement[] } => ({
	replaced: existing.filter((a) => a.startsOn >= startsOn),
	cutShort: existing.filter((a) => a.startsOn < startsOn && (a.endsOn === null || a.endsOn >= startsOn)),
});

/** "Paid by invoice to Ramesh Iyer" → "paid by invoice to Ramesh Iyer", to sit inside another sentence. */
const midSentence = (words: string): string => words.charAt(0).toLowerCase() + words.slice(1);

/** The same, as the note shown in the dialog before saving. Null when nothing is there yet. */
export const whatChangesWords = (existing: readonly FeeArrangement[], startsOn: string): string | null => {
	if (existing.length === 0 || !isDay(startsOn)) return null;
	const { cutShort, replaced } = whatChanges(existing, startsOn);
	const lines = [
		...cutShort.map((a) => FEES.form.keeps(midSentence(termsWords(a)), formatDate(dayBefore(startsOn)))),
		...(replaced.length > 0 ? [FEES.form.replaces(replaced.length, formatDate(startsOn))] : []),
	];
	return lines.length > 0 ? lines.join(" ") : FEES.form.untouched;
};

/**
 * Whether a payment entered is counted: only an invoice arrangement counts
 * payments, and only those paid while it runs.
 */
export const paymentCounted = (payment: Pick<Payment, "paidOn">, arrangements: readonly FeeArrangement[]): boolean =>
	arrangements.some(
		(a) =>
			a.kind === "invoiced" && a.startsOn <= payment.paidOn && (a.endsOn === null || payment.paidOn <= a.endsOn),
	);

/** The days a running arrangement can be stopped on, and the one to offer first. */
export const stopDays = (
	arrangement: Pick<FeeArrangement, "startsOn" | "endsOn">,
	today: string,
): { earliest: string; latest: string | null; offered: string } => {
	const { startsOn, endsOn } = arrangement;
	const offered = today < startsOn ? startsOn : endsOn !== null && today > endsOn ? endsOn : today;
	return { earliest: startsOn, latest: endsOn, offered };
};

/** Why a day cannot be the last day of this arrangement, or null when it can. */
export const stopProblem = (
	day: string,
	arrangement: Pick<FeeArrangement, "startsOn" | "endsOn">,
): string | null => {
	if (!isDay(day)) return FEES.stopForm.dayMissing;
	if (day < arrangement.startsOn) return FEES.stopForm.tooEarly(formatDate(arrangement.startsOn));
	if (arrangement.endsOn !== null && day > arrangement.endsOn)
		return FEES.stopForm.tooLate(formatDate(arrangement.endsOn));
	return null;
};

const BILL_DAYS = ["03-31", "06-30", "09-30", "12-31"];

/** Whether an arrangement of this kind bills on this day anyway: a quarter end, or 31 March for a profit share. */
export const isBillDay = (date: string, kind: FeeKind): boolean =>
	kind === "profit_share" ? date.slice(5) === BILL_DAYS[0] : kind !== "invoiced" && BILL_DAYS.includes(date.slice(5));

/**
 * The first day of what has built up and is not billed yet: the day after
 * the last bill day before `date`, or the day the arrangement started if
 * that is later. Null for an invoice arrangement — nothing builds up.
 */
export const builtUpSince = (
	date: string,
	arrangement: Pick<FeeArrangement, "kind" | "startsOn">,
): string | null => {
	if (arrangement.kind === "invoiced") return null;
	const year = Number(date.slice(0, 4));
	const billDays = arrangement.kind === "profit_share" ? BILL_DAYS.slice(0, 1) : BILL_DAYS;
	const lastBill = [year - 1, year]
		.flatMap((y) => billDays.map((day) => `${y}-${day}`))
		.filter((day) => day < date)
		.pop() as string;
	const first = dayAfter(lastBill);
	return first > arrangement.startsOn ? first : arrangement.startsOn;
};

/** What a charge in the list is, so the row can say it in words. */
export type ChargeKind =
	/** Built up since the last bill and not billed yet; `since` is its first day when that can be told. */
	| { what: "built_up"; since: string | null }
	/** A payment entered for an invoice arrangement. */
	| { what: "payment" }
	/** The part-period charged when an arrangement stopped between bill days. */
	| { what: "last_of_arrangement" }
	/** An ordinary bill: a quarter end, or a year's profit share. */
	| { what: "bill" };

/**
 * A charge carries only a day and an amount; what it is has to be read off
 * the arrangements and payments beside it. Nothing is guessed: a line is
 * only said when it cannot be anything else.
 */
export const chargeKind = (
	charge: Charge,
	arrangements: readonly FeeArrangement[],
	payments: readonly Pick<Payment, "paidOn" | "amount">[],
): ChargeKind => {
	if (charge.accrued) {
		// What has built up belongs to the arrangement still running on that day.
		const running = arrangements.find(
			(a) => a.kind !== "invoiced" && a.startsOn <= charge.date && (a.endsOn === null || a.endsOn >= charge.date),
		);
		return { what: "built_up", since: running ? builtUpSince(charge.date, running) : null };
	}
	const sameDay = payments.filter((p) => p.paidOn === charge.date);
	if (sameDay.some((p) => Number(p.amount) === Number(charge.amount) && paymentCounted(p, arrangements)))
		return { what: "payment" };
	const stopped = arrangements.some(
		(a) => a.kind !== "invoiced" && a.endsOn === charge.date && !isBillDay(charge.date, a.kind),
	);
	return stopped && sameDay.length === 0 ? { what: "last_of_arrangement" } : { what: "bill" };
};

/** Charges as the panel lists them: newest first. */
export const newestFirst = (charges: readonly Charge[]): Charge[] =>
	[...charges].sort((a, b) => b.date.localeCompare(a.date));

// ─── Before and after fees ──────────────────────────────────────────────

/** A difference between two yearly rates, in percentage points: 0.0165 → "1.7 pts". */
export const pointsWords = (fraction: number): string => formatPercent(Math.abs(fraction), { suffix: " pts" });

/** Whether a difference would print as "0.0 pts". */
const tooSmallToSee = (fraction: number): boolean => Math.abs(fraction) * 100 < 0.05;

/**
 * What the fee has done to the yearly return: `before` and `after` are the
 * returns before and after fees. Null figures are said, never guessed.
 */
export const feeEffectWords = (before: number | null, after: number | null): string => {
	if (before === null || after === null) return FEES.effect.unknown;
	const taken = before - after;
	if (tooSmallToSee(taken)) return FEES.effect.same;
	return taken > 0 ? FEES.effect.took(pointsWords(taken)) : FEES.effect.added(pointsWords(taken));
};

/** The same difference as a figure for the tile: before − after, or null when either is missing. */
export const feePointsTaken = (before: number | null, after: number | null): number | null =>
	before === null || after === null ? null : before - after;

const againstWords = (points: number, name: string, short: boolean): string => {
	if (tooSmallToSee(points)) return short ? FEES.effect.levelShort : FEES.effect.level(name);
	const words = pointsWords(points);
	if (points > 0) return short ? FEES.effect.aheadShort(words) : FEES.effect.ahead(words, name);
	return short ? FEES.effect.behindShort(words) : FEES.effect.behind(words, name);
};

/**
 * "Before fees this account was 7.9 pts a year ahead of NIFTY 50; after,
 * 6.2 pts ahead." `aheadBefore` and `aheadAfter` are the yearly return minus
 * the benchmark's on the same money. Null when either cannot be worked out.
 */
export const againstBenchmarkWords = (
	aheadBefore: number | null,
	aheadAfter: number | null,
	benchmark: string,
): string | null =>
	aheadBefore === null || aheadAfter === null
		? null
		: FEES.effect.against(againstWords(aheadBefore, benchmark, false), againstWords(aheadAfter, benchmark, true));

// ─── Refusals ───────────────────────────────────────────────────────────

/**
 * The server's own words for a refusal. A field it would not take comes back
 * as "Validation failed" with the reason under the field's name — the reason
 * is what a person needs to read.
 */
export const refusalWords = (error: unknown, fallback: string): string => {
	const fieldErrors = (error as { data?: { fieldErrors?: Record<string, unknown> } } | null)?.data?.fieldErrors;
	const reasons = Object.values(fieldErrors ?? {})
		.flat()
		.filter((reason): reason is string => typeof reason === "string" && reason !== "");
	return reasons.length > 0 ? reasons.join(" ") : errorWords(error, fallback);
};
