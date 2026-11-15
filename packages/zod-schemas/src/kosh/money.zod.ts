import { z } from "zod";
import { brokerZod, groupKindZod } from "../enums.zod.js";
import { feeEffectZod } from "./income.zod.js";

/**
 * Value, returns and "the same money elsewhere" — the contract between the
 * backend and the money screens (docs/kosh/06-build-plan.md, phase 4).
 *
 * Amounts are decimal strings in rupees. Rates are fractions (0.142 is
 * 14.2% a year). A figure is `null` when it cannot honestly be worked out —
 * the screen says why (see `flags`), never shows a zero in its place.
 */

// ─── What is being looked at, over which stretch of time ────────────────

/** A selection of accounts. Always resolved against what the caller can see. */
export const scopeZod = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("everything") }),
	z.object({ kind: z.literal("group"), id: z.string() }),
	z.object({ kind: z.literal("holder"), id: z.string() }),
	z.object({ kind: z.literal("account"), id: z.string() }),
]);
export type Scope = z.infer<typeof scopeZod>;

export const PERIODS = ["1y", "3y", "5y", "all"] as const;
export const periodZod = z.enum(PERIODS);
export type Period = z.infer<typeof periodZod>;

export const moneyInputZod = z.object({
	scope: scopeZod.default({ kind: "everything" }),
	period: periodZod.default("all"),
});

// ─── Returns ────────────────────────────────────────────────────────────

const benchmarkResultZod = z.object({
	slug: z.string(),
	name: z.string(),
	/** What stands in for it ("the NAV of a NIFTY 50 index fund"). */
	proxy: z.string(),
	/** The same deposits and withdrawals, put here instead: value today. */
	value: z.string().nullable(),
	/** Its return on the same money. */
	xirr: z.number().nullable(),
	/** Your value minus this one: positive is ahead. */
	ahead: z.string().nullable(),
	/** The day its prices start, when that is after the window does. */
	availableFrom: z.string().nullable(),
});

export const movedZod = z.object({
	/** Value when the window starts ("0.00" from the very start). */
	opening: z.string(),
	putIn: z.string(),
	takenOut: z.string(),
	/** What prices did, before fees. */
	priceGains: z.string(),
	dividends: z.string(),
	interest: z.string(),
	/** Brokerage, taxes and charges, as a positive amount. */
	fees: z.string(),
	/**
	 * Of `takenOut`: dividends, which are paid straight to the holder's bank —
	 * money the account earned (`dividends`) and that left it the same day.
	 */
	dividendsToBank: z.string().optional(),
	/** How many separate times money was put in, and taken out (dividends not counted). */
	deposits: z.number().int().optional(),
	withdrawals: z.number().int().optional(),
	closing: z.string(),
});

export const trailZod = z.object({
	/** The exact flows the return was solved over, investor's-pocket signs. */
	flows: z.array(
		z.object({ date: z.string(), amount: z.string(), what: z.string(), account: z.string().nullable() }),
	),
	solver: z.string(),
	notes: z.array(z.string()),
});

export const returnsZod = z.object({
	scope: z.object({
		kind: z.enum(["everything", "group", "holder", "account"]),
		label: z.string(),
		accounts: z.number().int(),
	}),
	window: z.object({ from: z.string(), to: z.string(), days: z.number().int() }),
	/** The day the newest price used is from. */
	pricesAsOf: z.string().nullable(),
	value: z.string(),
	/** Money-weighted return a year: your outcome, timing included. */
	xirr: z.number().nullable(),
	/** Time-weighted return a year: how the holdings did, timing removed. */
	twr: z.number().nullable(),
	/** Growth over the whole window, not annualised — for windows under a year. */
	growth: z.number().nullable(),
	benchmarks: z.array(benchmarkResultZod),
	moved: movedZod,
	risk: z.object({
		volatility: z.number().nullable(),
		sharpe: z.number().nullable(),
		sortino: z.number().nullable(),
		maxDrawdown: z
			.object({ fall: z.number(), peak: z.string(), trough: z.string() })
			.nullable(),
	}),
	chart: z.object({
		dates: z.array(z.string()),
		you: z.array(z.number()),
		benchmarks: z.array(z.object({ slug: z.string(), values: z.array(z.number().nullable()) })),
	}),
	flags: z.object({
		/** Nothing to show yet: no statements in any account of the selection. */
		empty: z.boolean(),
		/** Accounts valued from trades alone because no ledger is in. */
		accountsWithoutLedger: z.number().int(),
		/** Holdings with no market price at all, carried at their last trade price. */
		unpricedHoldings: z.number().int(),
		/** Days in the window on which some holding had no price yet. */
		daysOnOldPrices: z.number().int(),
		questionsWaiting: z.number().int(),
		/** Under a year: annualised figures swing a lot. */
		shortWindow: z.boolean(),
		/** Prices are still being fetched for the first time. */
		pricesLoading: z.boolean(),
		/** Dividends counted on Kosh's working alone, waiting for someone to confirm. */
		dividendsToConfirm: z.number().int().optional(),
	}),
	/**
	 * Set when a manager's fee is paid from outside the accounts: `xirr` and
	 * each benchmark's `ahead` are then AFTER those fees (the benchmark gets
	 * the fee money too — it is the same money), and this says what they
	 * were before.
	 */
	fees: feeEffectZod.nullable().optional(),
	trail: trailZod,
});
export type Returns = z.infer<typeof returnsZod>;

// ─── Holdings ───────────────────────────────────────────────────────────

export const ASSET_CLASSES = ["stocks", "funds", "gold", "bonds", "other"] as const;
export const assetClassZod = z.enum(ASSET_CLASSES);

const heldInZod = z.object({
	accountId: z.string(),
	label: z.string(),
	broker: brokerZod,
	quantity: z.string(),
	value: z.string(),
	since: z.string(),
});

export const holdingZod = z.object({
	instrumentId: z.string(),
	symbol: z.string(),
	name: z.string(),
	isin: z.string().nullable(),
	assetClass: assetClassZod,
	quantity: z.string(),
	/** Null when there is no market price; then `value` is at the last trade price. */
	price: z.string().nullable(),
	priceDate: z.string().nullable(),
	value: z.string(),
	/** Share of the selection's holdings. */
	weight: z.number(),
	invested: z.string(),
	/** Value now, plus what was sold, minus what was bought. */
	gain: z.string(),
	xirr: z.number().nullable(),
	/** NIFTY on the same buys and sells. */
	benchmarkXirr: z.number().nullable(),
	/** What that money would be worth in NIFTY now; `effect` = value − this. */
	benchmarkValue: z.string().nullable(),
	effect: z.string().nullable(),
	heldIn: z.array(heldInZod),
	/** Fully sold: kept so the list can include what was held before. */
	sold: z.boolean(),
});
export type Holding = z.infer<typeof holdingZod>;

export const holdingsInputZod = z.object({
	scope: scopeZod.default({ kind: "everything" }),
	includeSold: z.boolean().default(false),
});

export const holdingsZod = z.object({
	scope: returnsZod.shape.scope,
	pricesAsOf: z.string().nullable(),
	total: z.string(),
	byClass: z.array(z.object({ assetClass: assetClassZod, value: z.string(), weight: z.number() })),
	holdings: z.array(holdingZod),
	ahead: z.number().int(),
	behind: z.number().int(),
	flags: returnsZod.shape.flags.pick({ unpricedHoldings: true, pricesLoading: true, empty: true }),
});
export type Holdings = z.infer<typeof holdingsZod>;

export const scriptInputZod = z.object({
	scope: scopeZod.default({ kind: "everything" }),
	instrumentId: z.string(),
});

export const scriptZod = z.object({
	holding: holdingZod,
	trades: z.array(
		z.object({
			date: z.string(),
			side: z.enum(["buy", "sell"]),
			quantity: z.string(),
			price: z.string(),
			value: z.string(),
			accountLabel: z.string(),
			/** So a trade can link to the account it was made in. */
			accountId: z.string().optional(),
		}),
	),
	chart: z.object({ dates: z.array(z.string()), closes: z.array(z.number()) }),
});
export type Script = z.infer<typeof scriptZod>;

// ─── Groups compared ────────────────────────────────────────────────────

const groupRowZod = z.object({
	groupId: z.string(),
	name: z.string(),
	kind: groupKindZod.nullable(),
	accounts: z.number().int(),
	value: z.string(),
	xirr: z.number().nullable(),
	benchmarkXirr: z.number().nullable(),
	/** Percentage points a year ahead of (or behind) NIFTY on the same money. */
	aheadPoints: z.number().nullable(),
	aheadAmount: z.string().nullable(),
	/** Under a year of history: shown, but not ranked. */
	shortHistory: z.boolean(),
	/** Nothing has been uploaded to any of its accounts: there are no figures at all. */
	empty: z.boolean().optional(),
	/** Calendar years in which it beat NIFTY, of those it has a full year for. */
	yearsAhead: z.number().int(),
	yearsCounted: z.number().int(),
	/** Set when a manager's fee is paid from outside its accounts: the figures above are after it. */
	fees: feeEffectZod.nullable().optional(),
});

export const groupsComparedZod = z.object({
	period: periodZod,
	groups: z.array(groupRowZod),
	/** One row per calendar year: each group's return minus NIFTY's on the same money. */
	years: z.array(
		z.object({
			year: z.number().int(),
			cells: z.array(
				z.object({
					groupId: z.string(),
					points: z.number().nullable(),
					/** Not a whole year for this group: the year it started in, or the one still running. */
					partial: z.boolean().optional(),
				}),
			),
		}),
	),
	/** Groups share accounts, so their values must never be added up. */
	overlapping: z.boolean(),
});
export type GroupsCompared = z.infer<typeof groupsComparedZod>;

export const whatIfInputZod = z.object({ groupId: z.string(), period: periodZod.default("all") });

/** "What if this group's money had followed another group?" */
export const whatIfZod = z.object({
	groupId: z.string(),
	name: z.string(),
	value: z.string(),
	rows: z.array(
		z.object({
			/** Another group's id, or a benchmark's slug. */
			id: z.string(),
			name: z.string(),
			kind: z.enum(["self", "group", "benchmark"]),
			value: z.string().nullable(),
			/** Why a group has no value here. Groups that share an account with this one are not listed at all. */
			why: z.enum(["started_later", "nothing_uploaded"]).nullable().optional(),
		}),
	),
});
export type WhatIf = z.infer<typeof whatIfZod>;

/** Where prices stand — shown wherever a number depends on them. */
export const marketStatusZod = z.object({
	pricesAsOf: z.string().nullable(),
	lastSyncAt: z.number().nullable(),
	/** What the last fetch did, in a few words. */
	note: z.string().nullable(),
	/** Why the last fetch could not finish; null when it went through. */
	trouble: z.string().nullable().optional(),
	loading: z.boolean(),
});
