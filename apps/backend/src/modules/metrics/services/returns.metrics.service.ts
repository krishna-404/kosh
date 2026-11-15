import { db } from "@backend/db/db";
import { NO_ROWS } from "@backend/lib/request-context";
import { countDividendsToConfirm } from "@backend/modules/dividends/services/dividends.service";
import {
	type Benchmark,
	type CloseSeries,
	closeOn,
	closeOnOrAfter,
	getMarketState,
	listBenchmarks,
	loadCloses,
} from "@backend/modules/market-data/services/prices.market.service";
import {
	requireAccess,
	requireAccountLevel,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import { countQuestions } from "@backend/modules/questions/questions.service";
import type { Flow } from "@connected-repo/finance-math/flows";
import {
	annualizedVolatility,
	maxDrawdown,
	sharpeRatio,
	sortinoRatio,
} from "@connected-repo/finance-math/risk";
import { type TwrResult, twr } from "@connected-repo/finance-math/twr";
import { xirr } from "@connected-repo/finance-math/xirr";
import type { Period, Returns, Scope } from "@connected-repo/zod-schemas/kosh/money.zod";
import { ORPCError } from "@orpc/server";
import { addDays, dayRange, daysBetween, isWeekday, money, todayInIndia, yearsBefore } from "./dates.metrics";
import { type AccountSeries, type ExternalFlow, getAccountSeries } from "./series.metrics.service";

// Returns for any selection of accounts over any window — the same sums
// whether the selection is one account, a holder, a saved group or
// everything, which is what keeps those views consistent with each other
// (docs/kosh/03-metrics-spec.md).

/** Used for Sharpe and Sortino until a T-bill series is chosen. */
const RISK_FREE = 0.065;
const MIN_RISK_SAMPLES = 60;
const CHART_POINTS = 140;

const PROXY: Record<string, string> = {
	nifty50: "the NAV of a NIFTY 50 index fund — what an investor could really have earned, dividends included",
	gold: "the NAV of a gold fund",
};

// ─── Which accounts ─────────────────────────────────────────────────────

export interface ResolvedScope {
	kind: Scope["kind"];
	label: string;
	accountIds: string[];
}

/** A scope → the accounts in it that the caller can see. Unknown ids read as "not found". */
export async function resolveScope(scope: Scope): Promise<ResolvedScope> {
	const ctx = requireAccess();
	const visible = ctx.accountIds.filter((id) => id !== NO_ROWS);
	const notFound = (what: string) => new ORPCError("NOT_FOUND", { status: 404, message: `${what} not found` });

	switch (scope.kind) {
		case "everything":
			return { kind: "everything", label: "Everything you can see", accountIds: visible };
		case "account": {
			requireAccountLevel(scope.id, "view");
			const account = await db.brokerAccounts.find(scope.id).select("label");
			return { kind: "account", label: account.label, accountIds: [scope.id] };
		}
		case "holder": {
			const holder = await db.persons.where({ id: scope.id }).select("displayName").takeOptional();
			if (!holder) throw notFound("Person");
			return {
				kind: "holder",
				label: holder.displayName,
				accountIds: await db.brokerAccounts.where({ personId: scope.id }).pluck("id"),
			};
		}
		case "group": {
			const group = await db.accountGroups.where({ id: scope.id }).select("name").takeOptional();
			if (!group) throw notFound("Group");
			return {
				kind: "group",
				label: group.name,
				accountIds: await db.accountGroupMembers.where({ groupId: scope.id }).pluck("accountId"),
			};
		}
	}
}

// ─── A selection, added up ──────────────────────────────────────────────

export interface SelectionFlow extends ExternalFlow {
	accountId: string;
}

export interface Selection {
	series: AccountSeries[];
	/** First day anything in the selection has; null when it is empty. */
	start: string | null;
	today: string;
	dates: string[];
	total: Float64Array;
	oldPrice: Uint8Array;
	/** Money in and out of the selection as a whole. */
	flows: SelectionFlow[];
	/** What fund managers charged from outside the accounts — money the holder also paid. */
	feeFlows: SelectionFlow[];
}

export async function loadSelection(accountIds: readonly string[]): Promise<Selection> {
	const today = todayInIndia();
	const series = (await getAccountSeries(accountIds)).filter((s) => s.start !== null);
	if (series.length === 0)
		return {
			series: [],
			start: null,
			today,
			dates: [],
			total: new Float64Array(0),
			oldPrice: new Uint8Array(0),
			flows: [],
			feeFlows: [],
		};

	const start = series.map((s) => s.start as string).sort()[0] as string;
	const dates = dayRange(start, today);
	const total = new Float64Array(dates.length);
	const oldPrice = new Uint8Array(dates.length);
	for (const s of series) {
		const offset = daysBetween(start, s.start as string);
		for (let i = 0; i < s.total.length; i++) {
			total[offset + i] = (total[offset + i] as number) + (s.total[i] as number);
			if (s.oldPrice[i]) oldPrice[offset + i] = 1;
		}
	}

	// Money that only moved between two accounts of the selection is not money
	// in or out of it. With one leg outside, that leg still counts.
	const ids = series.map((s) => s.accountId);
	const inside = await db.transferLinks
		.where({ isLive: true, same: true, outAccountId: { in: ids }, inAccountId: { in: ids } })
		.select("outFlowId", "inFlowId");
	const internal = new Set(inside.flatMap((l) => [l.outFlowId, l.inFlowId]));
	const flows = series
		.flatMap((s) => s.flows.map((f) => ({ ...f, accountId: s.accountId })))
		.filter((f) => !internal.has(f.id))
		.sort((a, b) => a.date.localeCompare(b.date));

	const feeFlows = series
		.flatMap((s) =>
			s.managerFees.map((f) => ({
				id: `fee:${s.accountId}:${f.date}`,
				date: f.date,
				amount: f.amount,
				what: "manager_fee" as const,
				accountId: s.accountId,
			})),
		)
		.sort((a, b) => a.date.localeCompare(b.date));

	return { series, start, today, dates, total, oldPrice, flows, feeFlows };
}

/** The selection's value at the end of `date` (nothing before it starts). */
export const valueOn = (s: Selection, date: string): number => {
	if (s.start === null || date < s.start) return 0;
	const i = Math.min(daysBetween(s.start, date), s.total.length - 1);
	return s.total[i] as number;
};

// ─── Returns over a window ──────────────────────────────────────────────

export interface Window {
	/** The day before the first day counted: its closing value is the window's opening value. */
	from: string;
	to: string;
}

export function windowFor(s: Selection, period: Period): Window {
	const whole = addDays(s.start ?? s.today, -1);
	if (period === "all") return { from: whole, to: s.today };
	const asked = yearsBefore(s.today, Number(period[0]));
	return { from: asked > whole ? asked : whole, to: s.today };
}

export interface Core {
	opening: number;
	closing: number;
	flows: SelectionFlow[];
	xirr: number | null;
	solver: string;
	twr: TwrResult | null;
}

const solve = (flows: Flow[]): { rate: number | null; solver: string } => {
	if (flows.length < 2) return { rate: null, solver: "Not enough to work a return out from" };
	try {
		const result = xirr(flows);
		if (result.status === "converged")
			return { rate: result.rate, solver: `Solved in ${result.iterations} steps` };
		if (result.status === "multiple_roots")
			return { rate: result.rate, solver: "More than one rate fits these flows; the lowest is shown" };
		return {
			rate: null,
			solver:
				result.status === "no_sign_change"
					? "No return can be worked out: money only went one way"
					: "No rate fits these flows",
		};
	} catch {
		return { rate: null, solver: "No return can be worked out from these flows" };
	}
};

/** The investor's-pocket flows for a window: put in is negative, taken out and value held positive. */
const pocketFlows = (opening: number, flows: SelectionFlow[], closing: number, w: Window): Flow[] => [
	...(Math.abs(opening) >= 0.005 ? [{ date: w.from, amount: -opening }] : []),
	...flows.map((f) => ({ date: f.date, amount: -f.amount })),
	{ date: w.to, amount: closing },
];

export function coreReturns(s: Selection, w: Window): Core {
	const opening = valueOn(s, w.from);
	const closing = valueOn(s, w.to);
	const flows = s.flows.filter((f) => f.date > w.from && f.date <= w.to);
	const { rate, solver } = solve(pocketFlows(opening, flows, closing, w));

	let series: TwrResult | null = null;
	if (s.start !== null && w.to > w.from) {
		const inflow = new Map<string, number>();
		const outflow = new Map<string, number>();
		for (const f of flows)
			if (f.amount >= 0) inflow.set(f.date, (inflow.get(f.date) ?? 0) + f.amount);
			else outflow.set(f.date, (outflow.get(f.date) ?? 0) - f.amount);
		series = twr(
			dayRange(w.from, w.to).map((date) => ({
				date,
				value: valueOn(s, date),
				inflow: inflow.get(date) ?? 0,
				outflow: outflow.get(date) ?? 0,
			})),
		);
	}
	return { opening, closing, flows, xirr: rate, solver, twr: series };
}

/**
 * The same window with a fund manager's fees counted: paid from outside the
 * accounts, they are more money the holder put in that bought nothing — so
 * the value is unchanged and the return is lower. Null when no fee falls in
 * the window. (The time-weighted return is left as it was: it measures the
 * investments, not what they cost to have managed.)
 */
export function afterFees(s: Selection, core: Core, w: Window): Core | null {
	const fees = s.feeFlows.filter((f) => f.date > w.from && f.date <= w.to);
	if (fees.length === 0) return null;
	const flows = [...core.flows, ...fees].sort((a, b) => a.date.localeCompare(b.date));
	const { rate, solver } = solve(pocketFlows(core.opening, flows, core.closing, w));
	return { ...core, flows, xirr: rate, solver };
}

export interface Shadow {
	value: number | null;
	xirr: number | null;
	availableFrom: string | null;
	/** Units held after each flow, for drawing the path. */
	steps: { date: string; units: number }[];
}

/**
 * The same money, somewhere else: every rupee that went into the selection
 * buys `prices` on the day it arrived, every rupee taken out is sold from
 * it. Deposits on a day the market is shut buy at the next close.
 */
export function shadowOf(core: Core, w: Window, prices: CloseSeries | undefined): Shadow {
	const first = prices?.dates[0];
	if (!prices || first === undefined) return { value: null, xirr: null, availableFrom: null, steps: [] };
	const steps: Shadow["steps"] = [];
	let units = 0;
	if (Math.abs(core.opening) >= 0.005) {
		const price = closeOn(prices, w.from) ?? closeOnOrAfter(prices, w.from);
		if (price) units = core.opening / price;
		steps.push({ date: w.from, units });
	}
	for (const f of core.flows) {
		const price = closeOnOrAfter(prices, f.date);
		if (!price) continue;
		units += f.amount / price;
		steps.push({ date: f.date, units });
	}
	const last = closeOn(prices, w.to);
	if (last === null) return { value: null, xirr: null, availableFrom: first, steps };
	const value = units * last;
	const { rate } = solve(pocketFlows(core.opening, core.flows, value, w));
	// The comparison is honest only from the day this benchmark has prices.
	const firstNeeded = Math.abs(core.opening) >= 0.005 ? w.from : (core.flows[0]?.date ?? w.from);
	return { value, xirr: rate, availableFrom: first > firstNeeded ? first : null, steps };
}

export interface AccountSummary {
	value: string | null;
	xirr: number | null;
	/** NIFTY's return on the same money. */
	benchmarkXirr: number | null;
}

/**
 * Value, return and NIFTY's return on the same money for each account on
 * its own, since it started — what lists of accounts show beside each row.
 * All null for an account with nothing in it yet.
 */
export async function summarizeAccounts(accountIds: readonly string[]): Promise<Map<string, AccountSummary>> {
	const out = new Map<string, AccountSummary>();
	if (accountIds.length === 0) return out;
	const { list, closes } = await loadBenchmarks();
	const nifty = list.find((b) => b.slug === "nifty50");
	for (const id of accountIds) {
		const selection = await loadSelection([id]);
		if (selection.start === null) {
			out.set(id, { value: null, xirr: null, benchmarkXirr: null });
			continue;
		}
		const w = windowFor(selection, "all");
		const gross = coreReturns(selection, w);
		const core = afterFees(selection, gross, w) ?? gross;
		const shadow = nifty ? shadowOf(core, w, closes.get(nifty.instrumentId)) : null;
		out.set(id, { value: money(core.closing), xirr: core.xirr, benchmarkXirr: shadow?.xirr ?? null });
	}
	return out;
}

const sumIn = (items: { date: string; amount: number }[], w: Window): number =>
	items.reduce((sum, i) => (i.date > w.from && i.date <= w.to ? sum + i.amount : sum), 0);

const sampleDates = (w: Window, start: string): string[] => {
	const from = w.from < start ? addDays(start, -1) : w.from;
	const days = dayRange(from, w.to);
	if (days.length <= CHART_POINTS) return days;
	const step = (days.length - 1) / (CHART_POINTS - 1);
	return Array.from({ length: CHART_POINTS }, (_, i) => days[Math.round(i * step)] as string);
};

export async function loadBenchmarks(): Promise<{ list: Benchmark[]; closes: Map<string, CloseSeries> }> {
	const list = await listBenchmarks();
	return { list, closes: await loadCloses(list.map((b) => b.instrumentId)) };
}

/**
 * Whether prices for something held are still on their way for the first
 * time: it has no price at all, and the price files have not been gone
 * through for it yet. (Gone through and still nothing means it has no market
 * price — that is `unpricedHoldings`, not "loading".)
 */
export async function pricesLoading(unpriced: readonly string[]): Promise<boolean> {
	if (unpriced.length === 0) return false;
	return db.instruments.where({ id: { in: [...unpriced] }, pricedThrough: null }).exists();
}

export async function getReturns(scopeInput: Scope, period: Period): Promise<Returns> {
	const scope = await resolveScope(scopeInput);
	const selection = await loadSelection(scope.accountIds);
	const w = windowFor(selection, period);
	// `gross` is the accounts as their statements show them; `core` — what
	// every headline figure uses — also counts a manager's fees paid from outside.
	const gross = coreReturns(selection, w);
	const net = afterFees(selection, gross, w);
	const core = net ?? gross;
	const { list, closes } = await loadBenchmarks();
	const days = daysBetween(w.from, w.to);

	const shadows = list.map((b) => ({ b, shadow: shadowOf(core, w, closes.get(b.instrumentId)) }));
	const chartDates = selection.start ? sampleDates(w, selection.start) : [];

	// Risk is measured on market days: a weekend is not a day of no movement.
	const marketDays = (core.twr?.dailyReturns ?? []).filter((r) => isWeekday(r.date));
	const values = marketDays.map((r) => r.value);
	// A selection that never moved (cash only) has no volatility to divide by.
	const riskValue = (r: { status: string; value?: number }) =>
		r.status === "ok" && Number.isFinite(r.value) ? (r.value as number) : null;
	const drawdown = maxDrawdown(marketDays, MIN_RISK_SAMPLES);

	const fees = selection.series.reduce((sum, s) => sum + sumIn(s.fees, w), 0);
	const interest = selection.series.reduce((sum, s) => sum + sumIn(s.interest, w), 0);
	// Dividends go straight to the holder's bank: earned by the account, and gone from it the same day.
	const dividends = gross.flows.reduce((sum, f) => (f.what === "dividend" ? sum - f.amount : sum), 0);
	const putIn = gross.flows.reduce((sum, f) => (f.amount > 0 ? sum + f.amount : sum), 0);
	const takenOut = gross.flows.reduce((sum, f) => (f.amount < 0 ? sum - f.amount : sum), 0);
	const niftyBefore = shadowOf(gross, w, closes.get(list.find((b) => b.slug === "nifty50")?.instrumentId ?? ""));
	const gains = core.closing - core.opening - putIn + takenOut;

	const labels = new Map(
		(scope.accountIds.length > 0
			? await db.brokerAccounts.where({ id: { in: scope.accountIds } }).select("id", "label")
			: []
		).map((a) => [a.id, a.label]),
	);
	const waiting = await countQuestions();
	const firstDay = w.from < (selection.start ?? w.from) ? 0 : daysBetween(selection.start as string, w.from);
	let daysOnOldPrices = 0;
	for (let i = Math.max(0, firstDay); i < selection.oldPrice.length; i++) daysOnOldPrices += selection.oldPrice[i] as number;
	const pricesAsOf = selection.series.map((s) => s.pricesAsOf).filter((d): d is string => d !== null).sort().pop() ?? null;

	const what: Record<ExternalFlow["what"], string> = {
		deposit: "Put in",
		withdrawal: "Taken out",
		opening_balance: "Already in the account when its ledger starts",
		bought: "Bought (no ledger in — counted as put in)",
		sold: "Sold (no ledger in — counted as taken out)",
		dividend: "Dividend, paid to the holder’s bank",
		manager_fee: "Fund manager’s fee, paid from outside the account",
	};
	const toConfirm = await countDividendsToConfirm(scope.accountIds);

	return {
		scope: { kind: scope.kind, label: scope.label, accounts: scope.accountIds.length },
		window: { from: addDays(w.from, 1), to: w.to, days },
		pricesAsOf,
		value: money(core.closing),
		xirr: core.xirr,
		twr: core.twr ? core.twr.annualized : null,
		growth: core.twr ? core.twr.cumulative : null,
		benchmarks: shadows.map(({ b, shadow }) => ({
			slug: b.slug,
			name: b.name,
			proxy: PROXY[b.slug] ?? b.name,
			value: shadow.value === null ? null : money(shadow.value),
			xirr: shadow.xirr,
			ahead: shadow.value === null ? null : money(core.closing - shadow.value),
			availableFrom: shadow.availableFrom,
		})),
		moved: {
			opening: money(core.opening),
			putIn: money(putIn),
			takenOut: money(takenOut),
			priceGains: money(gains + fees - interest - dividends),
			dividends: money(dividends),
			dividendsToBank: money(dividends),
			deposits: gross.flows.filter((f) => f.amount > 0 && f.what !== "manager_fee").length,
			withdrawals: gross.flows.filter((f) => f.amount < 0 && f.what !== "dividend").length,
			interest: money(interest),
			fees: money(fees),
			closing: money(core.closing),
		},
		risk: {
			volatility: riskValue(annualizedVolatility(values, MIN_RISK_SAMPLES)),
			sharpe: riskValue(sharpeRatio(values, RISK_FREE, MIN_RISK_SAMPLES)),
			sortino: riskValue(sortinoRatio(values, RISK_FREE, MIN_RISK_SAMPLES)),
			maxDrawdown:
				drawdown.status === "ok"
					? { fall: drawdown.drawdown, peak: drawdown.peakDate, trough: drawdown.troughDate }
					: null,
		},
		chart: {
			dates: chartDates,
			you: chartDates.map((d) => Math.round(valueOn(selection, d))),
			benchmarks: shadows.map(({ b, shadow }) => {
				const prices = closes.get(b.instrumentId);
				let step = -1;
				return {
					slug: b.slug,
					values: chartDates.map((d) => {
						while (step + 1 < shadow.steps.length && (shadow.steps[step + 1] as { date: string }).date <= d) step++;
						const price = closeOn(prices, d);
						return step < 0 || price === null
							? null
							: Math.round((shadow.steps[step] as { units: number }).units * price);
					}),
				};
			}),
		},
		flags: {
			empty: selection.start === null,
			accountsWithoutLedger: selection.series.filter((s) => s.basis === "trades").length,
			unpricedHoldings: selection.series.reduce((sum, s) => sum + s.unpriced.length, 0),
			daysOnOldPrices,
			questionsWaiting: scope.accountIds.reduce((sum, id) => sum + (waiting.get(id) ?? 0), 0),
			shortWindow: days < 365,
			pricesLoading: await pricesLoading(selection.series.flatMap((x) => x.unpriced)),
			dividendsToConfirm: scope.accountIds.reduce((sum, id) => sum + (toConfirm.get(id) ?? 0), 0),
		},
		fees: net
			? {
					total: money(net.flows.reduce((sum, f) => (f.what === "manager_fee" ? sum + f.amount : sum), 0)),
					xirrBefore: gross.xirr,
					aheadPointsBefore: gross.xirr !== null && niftyBefore.xirr !== null ? gross.xirr - niftyBefore.xirr : null,
				}
			: null,
		trail: {
			flows: [
				...(Math.abs(core.opening) >= 0.005
					? [{ date: w.from, amount: money(-core.opening), what: "Value at the start of the window", account: null }]
					: []),
				...core.flows.slice(0, 500).map((f) => ({
					date: f.date,
					amount: money(-f.amount),
					what: what[f.what],
					account: labels.get(f.accountId) ?? null,
				})),
				{ date: w.to, amount: money(core.closing), what: "Value today", account: null },
			],
			solver: core.solver,
			notes: [
				"Return is the yearly rate at which the money put in, on the days it was put in, grows to the money taken out and the value today (XIRR, actual days over 365).",
				...(core.flows.length > 500 ? [`${core.flows.length - 500} more flows are not listed here.`] : []),
				...(await marketNote()),
			],
		},
	};
}

async function marketNote(): Promise<string[]> {
	const state = await getMarketState();
	// Only worth saying when the last fetch could not finish.
	return !state.lastSyncOk && state.lastSyncNote ? [`Prices: ${state.lastSyncNote}.`] : [];
}
