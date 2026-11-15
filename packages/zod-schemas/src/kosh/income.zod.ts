import { z } from "zod";

/**
 * Dividends and fund-manager fees — the contract between the backend and
 * the screens that show them (docs/kosh/06-build-plan.md, phase 6).
 *
 * Amounts are decimal strings in rupees. Rates are fractions (0.015 is 1.5%).
 */

const accountRefZod = z.object({ id: z.string(), label: z.string() });
const moneyStringZod = z.string().regex(/^\d{1,15}(\.\d{1,2})?$/, "An amount in rupees, like 6420 or 6420.50");

// ─── Dividends ──────────────────────────────────────────────────────────

/**
 * `expected`: worked out from the exchange's announcement × the shares held
 * on the ex-date, and counted from that day as the best guess.
 * `confirmed`: a person said what arrived, and when.
 * `not_received`: a person said it never came; it is not counted.
 */
export const DIVIDEND_STATES = ["expected", "confirmed", "not_received"] as const;
export const dividendStateZod = z.enum(DIVIDEND_STATES);

export const dividendZod = z.object({
	id: z.string(),
	instrumentId: z.string(),
	symbol: z.string(),
	name: z.string(),
	/** The day the share stopped carrying the dividend. */
	exDate: z.string(),
	/** The day it is counted on: the ex-date until someone says when it arrived. */
	receivedOn: z.string(),
	/** Shares held going into the ex-date. */
	quantity: z.string(),
	amountPerShare: z.string(),
	/** Before any tax deducted at source. */
	amount: z.string(),
	state: dividendStateZod,
	/** Worked out from the exchange's announcement, or entered by a person. */
	source: z.enum(["feed", "person"]),
	/** The exchange's own words: "Dividend - Rs 5 Per Share". */
	announcement: z.string().nullable(),
});
export type Dividend = z.infer<typeof dividendZod>;

export const dividendListZod = z.object({
	account: accountRefZod,
	/** The caller can confirm, change and add (Can edit or Owner). */
	canAnswer: z.boolean(),
	/** Dividends still counted on Kosh's working alone. */
	toConfirm: z.object({ count: z.number().int(), total: z.string() }),
	/** Counted in the return: expected and confirmed, in the account's whole history. */
	counted: z.object({ count: z.number().int(), total: z.string() }),
	/** Newest first. */
	dividends: z.array(dividendZod),
});
export type DividendList = z.infer<typeof dividendListZod>;

/** Confirm dividends as expected: the ones named, or every one still waiting on the account. */
export const confirmDividendsInputZod = z.object({
	accountId: z.string(),
	dividendIds: z.array(z.string()).max(1000).optional(),
});

/** "The amount is different": what really arrived, and when. */
export const changeDividendInputZod = z.object({
	dividendId: z.string(),
	amount: moneyStringZod,
	receivedOn: z.iso.date(),
});

/** A dividend the exchange's feed did not carry. */
export const recordDividendInputZod = z.object({
	accountId: z.string(),
	instrumentId: z.string(),
	amount: moneyStringZod,
	receivedOn: z.iso.date(),
});

// ─── Fund-manager fees ──────────────────────────────────────────────────

/**
 * How a manager or adviser is paid for an account, when the money comes
 * from outside the account (so no statement shows it):
 *  - `percent_of_assets`: `rate` of the account's value a year, charged each calendar quarter
 *  - `fixed`: `amountPerYear`, charged each calendar quarter
 *  - `profit_share`: `rate` of the year's profit above `hurdleRate`, charged each 31 March
 *  - `invoiced`: whatever was actually paid — entered payment by payment
 */
export const FEE_KINDS = ["percent_of_assets", "fixed", "profit_share", "invoiced"] as const;
export const feeKindZod = z.enum(FEE_KINDS);
export type FeeKind = z.infer<typeof feeKindZod>;

export const feeArrangementZod = z.object({
	id: z.string(),
	kind: feeKindZod,
	/** Who is paid. */
	payee: z.string().nullable(),
	rate: z.number().nullable(),
	amountPerYear: z.string().nullable(),
	hurdleRate: z.number().nullable(),
	startsOn: z.string(),
	endsOn: z.string().nullable(),
});
export type FeeArrangement = z.infer<typeof feeArrangementZod>;

const rateZod = z.number().gt(0).max(1);

/** Set (or replace) an account's arrangement. Owners only. */
export const feeSetInputZod = z
	.object({
		accountId: z.string(),
		kind: feeKindZod,
		payee: z.string().trim().min(1).max(120).optional(),
		rate: rateZod.optional(),
		amountPerYear: moneyStringZod.optional(),
		hurdleRate: z.number().min(0).max(1).optional(),
		startsOn: z.iso.date(),
		endsOn: z.iso.date().optional(),
	})
	.superRefine((input, ctx) => {
		const need = (field: "rate" | "amountPerYear", message: string) => {
			if (input[field] === undefined) ctx.addIssue({ code: "custom", path: [field], message });
		};
		if (input.kind === "percent_of_assets") need("rate", "Give the yearly rate, like 0.015 for 1.5%.");
		if (input.kind === "profit_share") need("rate", "Give the share of profit, like 0.2 for 20%.");
		if (input.kind === "fixed") need("amountPerYear", "Give the yearly amount.");
		if (input.endsOn !== undefined && input.endsOn < input.startsOn)
			ctx.addIssue({ code: "custom", path: ["endsOn"], message: "It can’t end before it starts." });
	});

export const feePaymentZod = z.object({
	id: z.string(),
	paidOn: z.string(),
	amount: z.string(),
	note: z.string().nullable(),
});

export const feePaymentInputZod = z.object({
	accountId: z.string(),
	paidOn: z.iso.date(),
	amount: moneyStringZod,
	note: z.string().trim().max(200).optional(),
});

/** One charge Kosh counts against the return: worked out from the arrangement, or a payment entered. */
export const feeChargeZod = z.object({
	date: z.string(),
	amount: z.string(),
	/** Built up since the last charge and not yet billed — counted so the return is not flattered. */
	accrued: z.boolean(),
});

export const feeOverviewZod = z.object({
	account: accountRefZod,
	/** Only an owner sets or changes what the manager is paid. */
	canChange: z.boolean(),
	arrangement: feeArrangementZod.nullable(),
	/** Earlier arrangements, newest first. */
	earlier: z.array(feeArrangementZod),
	payments: z.array(feePaymentZod),
	charges: z.array(feeChargeZod),
	total: z.string(),
});
export type FeeOverview = z.infer<typeof feeOverviewZod>;

/** A return that fees paid from outside have been taken out of — and what it was before them. */
export const feeEffectZod = z.object({
	/** Fees counted in the window, including what has built up since the last charge. */
	total: z.string(),
	/** The return before those fees. */
	xirrBefore: z.number().nullable(),
	/** Percentage points a year ahead of NIFTY on the same money, before fees (after fees is the headline). */
	aheadPointsBefore: z.number().nullable(),
});
export type FeeEffect = z.infer<typeof feeEffectZod>;
