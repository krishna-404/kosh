import { db } from "@backend/db/db";
import {
	type CloseSeries,
	getMarketState,
	loadCloses,
} from "@backend/modules/market-data/services/prices.market.service";
import { addDays, dayRange, todayInIndia } from "./dates.metrics";

// One account, day by day: what it held, what that was worth, how much cash
// sat in it, and the money that went in and out. Everything the money
// screens show is added up from these.
//
// A series is derived data: it is built from the live ledger and the price
// bars, kept in memory, and thrown away the moment either changes (the
// account's `ledgerVersion`, or the market's `pricesVersion`). Nothing here
// is ever written back.

export interface ExternalFlow {
	id: string;
	date: string;
	/** Signed: + into the account, − out of it. */
	amount: number;
	what: "deposit" | "withdrawal" | "opening_balance" | "bought" | "sold" | "dividend" | "manager_fee";
}

/** A dividend counted for an account: positive, on the day it is counted. */
export interface DividendPoint {
	id: string;
	instrumentId: string;
	date: string;
	amount: number;
	confirmed: boolean;
}

export interface TradePoint {
	date: string;
	instrumentId: string;
	side: "buy" | "sell";
	quantity: number;
	price: number;
	value: number;
}

export interface DatedAmount {
	date: string;
	amount: number;
}

export interface AccountSeries {
	accountId: string;
	/** First day with anything in it; null for an account with no statements. */
	start: string | null;
	/** Every calendar day from `start` to today. */
	dates: string[];
	/** Holdings at the day's close. */
	securities: Float64Array;
	/** Ledger balance at the end of the day, less trades not yet settled. */
	cash: Float64Array;
	total: Float64Array;
	/** 1 on days when some holding had no market price and was carried at its last trade price. */
	oldPrice: Uint8Array;
	/** Money in and out. From the ledger; from the trades themselves when no ledger is in. */
	flows: ExternalFlow[];
	basis: "ledger" | "trades" | "none";
	trades: TradePoint[];
	/** Brokerage, taxes and charges, as positive amounts on the day they were debited. */
	fees: DatedAmount[];
	interest: DatedAmount[];
	/**
	 * Dividends, which go to the holder's bank rather than into the account:
	 * each is also in `flows` as money that left on the day it is counted.
	 */
	dividends: DividendPoint[];
	/**
	 * What a fund manager charged from OUTSIDE the account (it is in no
	 * statement): not in `flows`, `fees` or the value — counted only when a
	 * return is asked for after fees.
	 */
	managerFees: ManagerFee[];
	/** What is held today. */
	quantities: Map<string, number>;
	/** Held today with no market price at all. */
	unpriced: string[];
	/** The newest price date used. */
	pricesAsOf: string | null;
}

const EMPTY = (accountId: string): AccountSeries => ({
	accountId,
	start: null,
	dates: [],
	securities: new Float64Array(0),
	cash: new Float64Array(0),
	total: new Float64Array(0),
	oldPrice: new Uint8Array(0),
	flows: [],
	basis: "none",
	trades: [],
	fees: [],
	interest: [],
	dividends: [],
	managerFees: [],
	quantities: new Map(),
	unpriced: [],
	pricesAsOf: null,
});

/**
 * Changes to how many shares a holding is, on a day, without a trade — a
 * split or a bonus. `factor` multiplies the quantity held at the start of
 * `date` (2 for a 1:1 bonus, 10 for a ₹10 → ₹1 split). Filled in by the
 * corporate-actions phase; until then there are none.
 */
export type QuantityFactors = Map<string, { date: string; factor: number }[]>;
let quantityFactorsFor: (accountId: string) => Promise<QuantityFactors> = async () => new Map();
export const setQuantityFactorSource = (source: typeof quantityFactorsFor): void => {
	quantityFactorsFor = source;
};

/** Filled in by the dividends module; until it loads there are none. */
let dividendsFor: (accountId: string) => Promise<DividendPoint[]> = async () => [];
export const setDividendSource = (source: typeof dividendsFor): void => {
	dividendsFor = source;
};

export interface ManagerFee {
	date: string;
	amount: number;
	/** Built up since the last bill, not billed yet. */
	accrued: boolean;
}
/** Filled in by the fees module; until it loads nobody is charged anything. */
let managerFeesFor: (
	accountId: string,
	account: { start: string; today: string; valueOn: (date: string) => number; flows: readonly ExternalFlow[] },
) => Promise<ManagerFee[]> = async () => [];
export const setFeeSource = (source: typeof managerFeesFor): void => {
	managerFeesFor = source;
};

const SETTLE_WITHIN_DAYS = 7;

async function buildSeries(accountId: string, today: string): Promise<AccountSeries> {
	const tradeRows = await db.trades
		.where({ accountId, isLive: true })
		.order({ tradeDate: "ASC" })
		.select("tradeDate", "instrumentId", "side", "quantity", "price", "grossValue");
	const lines = await db.rawLedgerLines
		.where({ accountId, isLive: true })
		.order({ postedDate: "ASC", batchId: "ASC", lineNo: "ASC" })
		.select("postedDate", "runningBalance");
	const flowRows = await db.cashFlows
		.where({ accountId, isLive: true })
		.order({ flowDate: "ASC" })
		.select("id", "flowDate", "amount", "classification", "origin");

	const trades: TradePoint[] = tradeRows.map((t) => ({
		date: t.tradeDate,
		instrumentId: t.instrumentId,
		side: t.side,
		quantity: Number(t.quantity),
		price: Number(t.price),
		value: Number(t.grossValue),
	}));
	// A dividend only counts while the account has a history to count it in.
	const dividends = (await dividendsFor(accountId)).filter((d) => d.date <= today);
	const firsts = [trades[0]?.date, lines[0]?.postedDate, flowRows[0]?.flowDate].filter(
		(d): d is string => d !== undefined,
	);
	if (firsts.length === 0) return EMPTY(accountId);
	const start = firsts.sort()[0] as string;
	const dates = dayRange(start, today);
	const n = dates.length;
	const indexOf = new Map(dates.map((d, i) => [d, i]));

	const instrumentIds = [...new Set(trades.map((t) => t.instrumentId))];
	const closes = await loadCloses(instrumentIds, addDays(start, -14));
	const factors = await quantityFactorsFor(accountId);

	// ── Money in and out, fees, interest ──────────────────────────────────
	const hasLedger = lines.length > 0;
	const flows: ExternalFlow[] = [];
	const fees: DatedAmount[] = [];
	const interest: DatedAmount[] = [];
	const settlements = new Map<string, number>();
	for (const f of flowRows) {
		const amount = Number(f.amount);
		if (f.classification === "external_deposit" || f.classification === "external_withdrawal")
			flows.push({
				id: f.id,
				date: f.flowDate,
				amount,
				what:
					f.origin === "opening_balance"
						? "opening_balance"
						: f.classification === "external_deposit"
							? "deposit"
							: "withdrawal",
			});
		else if (f.classification === "charge") fees.push({ date: f.flowDate, amount: -amount });
		else if (f.classification === "interest") interest.push({ date: f.flowDate, amount });
		else if (f.classification === "trade_settlement")
			settlements.set(f.flowDate, (settlements.get(f.flowDate) ?? 0) + amount);
	}
	// With no ledger, the trades themselves are the money: a buy is money put
	// in that day, a sale is money taken out.
	if (!hasLedger)
		for (const [i, t] of trades.entries())
			flows.push({
				id: `trade:${i}`,
				date: t.date,
				amount: t.side === "buy" ? t.value : -t.value,
				what: t.side === "buy" ? "bought" : "sold",
			});

	// A dividend is money the account earned and paid straight out to the
	// holder's bank: it never shows in the balance, so it is counted as money
	// taken out on its day — which is what makes it part of the return.
	for (const d of dividends)
		if (d.date >= start) flows.push({ id: `dividend:${d.id}`, date: d.date, amount: -d.amount, what: "dividend" });
	flows.sort((a, b) => a.date.localeCompare(b.date));

	// ── Trades not yet settled ────────────────────────────────────────────
	// A share bought today is held today, but its money leaves the ledger a
	// day or two later. Until then that money is still in the cash balance
	// and would be counted twice; `pending` takes it back out.
	const pending = new Float64Array(n + 1);
	const settleDays = [...settlements.keys()].sort();
	const tradedInto = new Map<string, number>();
	for (const t of trades) {
		const signed = t.side === "buy" ? t.value : -t.value;
		const settle = settleDays.find((d) => d > t.date && d <= addDays(t.date, SETTLE_WITHIN_DAYS));
		if (!settle) continue;
		tradedInto.set(settle, (tradedInto.get(settle) ?? 0) + signed);
		const from = indexOf.get(t.date) as number;
		const to = indexOf.get(settle) as number;
		pending[from] = (pending[from] as number) + signed;
		pending[to] = (pending[to] as number) - signed;
	}
	// What a settlement took beyond the trades it settled is the cost of trading.
	for (const [date, traded] of tradedInto) {
		const cost = -(settlements.get(date) ?? 0) - traded;
		if (Math.abs(cost) >= 0.005) fees.push({ date, amount: cost });
	}

	// ── Day by day ────────────────────────────────────────────────────────
	const securities = new Float64Array(n);
	const cash = new Float64Array(n);
	const total = new Float64Array(n);
	const oldPrice = new Uint8Array(n);
	const quantity = new Map<string, number>();
	const lastTradePrice = new Map<string, number>();
	const pointer = new Map<string, number>();
	const factorPointer = new Map<string, number>();
	let ti = 0;
	let li = 0;
	let balance = 0;
	let unsettled = 0;
	let pricesAsOf: string | null = null;

	for (let d = 0; d < n; d++) {
		const day = dates[d] as string;

		// Splits and bonuses change the count at the start of the day.
		for (const [id, list] of factors) {
			let p = factorPointer.get(id) ?? 0;
			while (p < list.length && (list[p] as { date: string }).date <= day) {
				const { factor } = list[p] as { factor: number };
				quantity.set(id, (quantity.get(id) ?? 0) * factor);
				const px = lastTradePrice.get(id);
				if (px !== undefined) lastTradePrice.set(id, px / factor);
				p++;
			}
			factorPointer.set(id, p);
		}

		while (ti < trades.length && (trades[ti] as TradePoint).date <= day) {
			const t = trades[ti++] as TradePoint;
			quantity.set(t.instrumentId, (quantity.get(t.instrumentId) ?? 0) + (t.side === "buy" ? t.quantity : -t.quantity));
			lastTradePrice.set(t.instrumentId, t.price);
		}
		while (li < lines.length && (lines[li] as { postedDate: string }).postedDate <= day) {
			const running = (lines[li++] as { runningBalance: string | null }).runningBalance;
			if (running !== null) balance = Number(running);
		}
		unsettled += pending[d] as number;

		let held = 0;
		for (const [id, q] of quantity) {
			// More sold than Kosh has seen bought means earlier history is
			// missing; such a holding is worth nothing here rather than less than nothing.
			if (q <= 1e-9) continue;
			const series: CloseSeries | undefined = closes.get(id);
			let price: number | null = null;
			if (series) {
				let p = pointer.get(id) ?? -1;
				while (p + 1 < series.dates.length && (series.dates[p + 1] as string) <= day) p++;
				pointer.set(id, p);
				if (p >= 0) {
					price = series.closes[p] as number;
					const priced = series.dates[p] as string;
					if (pricesAsOf === null || priced > pricesAsOf) pricesAsOf = priced;
				}
			}
			if (price === null) {
				price = lastTradePrice.get(id) ?? 0;
				oldPrice[d] = 1;
			}
			held += q * price;
		}
		securities[d] = held;
		cash[d] = hasLedger ? balance - unsettled : 0;
		total[d] = (securities[d] as number) + (cash[d] as number);
	}

	const quantities = new Map([...quantity].filter(([, q]) => q > 1e-9));
	const managerFees = await managerFeesFor(accountId, {
		start,
		today,
		valueOn: (date) => {
			const i = indexOf.get(date);
			return i === undefined ? 0 : (total[i] as number);
		},
		flows,
	});
	return {
		accountId,
		start,
		dates,
		securities,
		cash,
		total,
		oldPrice,
		flows,
		basis: hasLedger ? "ledger" : trades.length > 0 ? "trades" : "none",
		trades,
		fees,
		interest,
		dividends: dividends.filter((d) => d.date >= start),
		managerFees,
		quantities,
		unpriced: [...quantities.keys()].filter((id) => !closes.has(id)),
		pricesAsOf,
	};
}

// ── Cache ───────────────────────────────────────────────────────────────

const MAX_CACHED = 300;
const cache = new Map<string, { key: string; series: AccountSeries }>();

/** Day-by-day series for accounts the caller can see (others are silently absent). */
export async function getAccountSeries(accountIds: readonly string[]): Promise<AccountSeries[]> {
	if (accountIds.length === 0) return [];
	const accounts = await db.brokerAccounts
		.where({ id: { in: [...accountIds] } })
		.select("id", "ledgerVersion");
	const { pricesVersion } = await getMarketState();
	const today = todayInIndia();

	const out: AccountSeries[] = [];
	for (const account of accounts) {
		const key = `${account.ledgerVersion}:${pricesVersion}:${today}`;
		const hit = cache.get(account.id);
		if (hit?.key === key) {
			out.push(hit.series);
			continue;
		}
		const series = await buildSeries(account.id, today);
		cache.delete(account.id);
		cache.set(account.id, { key, series });
		if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
		out.push(series);
	}
	return out;
}

/** After anything that changes an account's ledger: what was derived from it is stale. */
export async function bumpLedger(accountId: string): Promise<void> {
	await db.brokerAccounts.where({ id: accountId }).increment("ledgerVersion");
}

/** Tests only. */
export const clearSeriesCache = (): void => cache.clear();
