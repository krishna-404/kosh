import { db } from "@backend/db/db";
import {
	type CloseSeries,
	closeOn,
	closeOnOrAfter,
	loadCloses,
} from "@backend/modules/market-data/services/prices.market.service";
import type { Flow } from "@connected-repo/finance-math/flows";
import { xirr } from "@connected-repo/finance-math/xirr";
import type { Holding, Holdings, Scope, Script } from "@connected-repo/zod-schemas/kosh/money.zod";
import { ORPCError } from "@orpc/server";
import { addDays, money } from "./dates.metrics";
import {
	loadBenchmarks,
	loadSelection,
	pricesLoading,
	resolveScope,
	type Selection,
} from "./returns.metrics.service";

// Share by share: what each holding is worth, what it has returned, and what
// the same buys and sells would be worth in NIFTY — so it is plain which
// holdings carried the selection and which held it back.

const rate = (flows: Flow[]): number | null => {
	if (flows.length < 2) return null;
	try {
		const result = xirr(flows);
		return result.status === "converged" || result.status === "multiple_roots" ? result.rate : null;
	} catch {
		return null;
	}
};

type AssetClass = Holding["assetClass"];
const assetClassOf = (kind: string, name: string, symbol: string): AssetClass => {
	const gold = /gold/i.test(name) || /gold/i.test(symbol);
	if (kind === "sgb" || kind === "commodity" || ((kind === "etf" || kind === "mf") && gold)) return "gold";
	// A statement does not say a line is an exchange-traded fund; its name does
	// (NIFTYBEES, an "… ETF"). Listed as a share, it is still a fund.
	const fund = /BEES$|ETF/i.test(symbol) || /\bETF\b|exchange traded/i.test(name);
	if (kind === "equity" && fund) return gold ? "gold" : "funds";
	if (kind === "equity" || kind === "reit_invit") return gold ? "gold" : "stocks";
	if (kind === "etf" || kind === "mf") return "funds";
	if (kind === "bond") return "bonds";
	return "other";
};

const trim = (n: number): string => String(Math.round(n * 1e6) / 1e6);

interface Built {
	holdings: Holding[];
	closes: Map<string, CloseSeries>;
	labels: Map<string, { label: string; broker: Holding["heldIn"][number]["broker"] }>;
}

async function build(selection: Selection): Promise<Built> {
	const ids = [...new Set(selection.series.flatMap((s) => s.trades.map((t) => t.instrumentId)))];
	if (ids.length === 0 || selection.start === null) return { holdings: [], closes: new Map(), labels: new Map() };

	const instruments = await db.instruments
		.where({ id: { in: ids } })
		.select("id", "symbolCanonical", "name", "isin", "kind");
	const closes = await loadCloses(ids, addDays(selection.start, -14));
	const { list, closes: benchmarkCloses } = await loadBenchmarks();
	const nifty = benchmarkCloses.get(list.find((b) => b.slug === "nifty50")?.instrumentId ?? "");
	const accounts = await db.brokerAccounts
		.where({ id: { in: selection.series.map((s) => s.accountId) } })
		.select("id", "label", "broker");
	const labels = new Map(accounts.map((a) => [a.id, { label: a.label, broker: a.broker }]));
	const today = selection.today;

	const holdings: Holding[] = [];
	for (const instrument of instruments) {
		const series = closes.get(instrument.id);
		const market = closeOn(series, today);
		const priceDate = series && market !== null ? (series.dates.filter((d) => d <= today).pop() ?? null) : null;

		let quantity = 0;
		let bought = 0;
		let sold = 0;
		let lastTradePrice = 0;
		let received = 0; // dividends
		let units = 0; // what the same buys and sells would hold of NIFTY
		const flows: Flow[] = [];
		const heldIn: Holding["heldIn"] = [];
		for (const s of selection.series) {
			const mine = s.trades.filter((t) => t.instrumentId === instrument.id);
			if (mine.length === 0) continue;
			for (const t of mine) {
				const signed = t.side === "buy" ? t.value : -t.value;
				if (t.side === "buy") bought += t.value;
				else sold += t.value;
				flows.push({ date: t.date, amount: -signed });
				const index = closeOnOrAfter(nifty, t.date);
				if (index) units += signed / index;
				lastTradePrice = t.price;
			}
			// A dividend is money this share handed back; the same money comes out of NIFTY that day.
			for (const d of s.dividends) {
				if (d.instrumentId !== instrument.id) continue;
				received += d.amount;
				flows.push({ date: d.date, amount: d.amount });
				const index = closeOnOrAfter(nifty, d.date);
				if (index) units -= d.amount / index;
			}
			const held = s.quantities.get(instrument.id) ?? 0;
			quantity += held;
			if (held > 0) {
				const account = labels.get(s.accountId);
				heldIn.push({
					accountId: s.accountId,
					label: account?.label ?? "An account",
					broker: account?.broker ?? "manual",
					quantity: trim(held),
					value: money(held * (market ?? lastTradePrice)),
					since: mine[0]?.date ?? today,
				});
			}
		}

		const price = market ?? lastTradePrice;
		const value = quantity * price;
		const indexNow = closeOn(nifty, today);
		const benchmarkValue = indexNow === null || !nifty ? null : units * indexNow;
		flows.sort((a, b) => a.date.localeCompare(b.date));
		const closeOut = (terminal: number): Flow[] => [...flows, { date: today, amount: terminal }];

		holdings.push({
			instrumentId: instrument.id,
			symbol: instrument.symbolCanonical,
			name: instrument.name,
			isin: instrument.isin,
			assetClass: assetClassOf(instrument.kind, instrument.name, instrument.symbolCanonical),
			quantity: trim(quantity),
			price: market === null ? null : String(market),
			priceDate,
			value: money(value),
			weight: 0,
			invested: money(bought),
			gain: money(value + sold + received - bought),
			xirr: rate(closeOut(value)),
			benchmarkXirr: benchmarkValue === null ? null : rate(closeOut(benchmarkValue)),
			benchmarkValue: benchmarkValue === null ? null : money(benchmarkValue),
			effect: benchmarkValue === null ? null : money(value - benchmarkValue),
			heldIn,
			sold: quantity <= 1e-9,
		});
	}

	const total = holdings.reduce((sum, h) => sum + Number(h.value), 0);
	for (const h of holdings) h.weight = total > 0 ? Number(h.value) / total : 0;
	holdings.sort((a, b) => Number(b.value) - Number(a.value) || a.symbol.localeCompare(b.symbol));
	return { holdings, closes, labels };
}

export async function getHoldings(scopeInput: Scope, includeSold: boolean): Promise<Holdings> {
	const scope = await resolveScope(scopeInput);
	const selection = await loadSelection(scope.accountIds);
	const { holdings } = await build(selection);
	const held = holdings.filter((h) => !h.sold);
	const total = held.reduce((sum, h) => sum + Number(h.value), 0);

	const classes = new Map<Holding["assetClass"], number>();
	for (const h of held) classes.set(h.assetClass, (classes.get(h.assetClass) ?? 0) + Number(h.value));
	const judged = held.filter((h) => h.effect !== null);

	return {
		scope: { kind: scope.kind, label: scope.label, accounts: scope.accountIds.length },
		pricesAsOf: held.map((h) => h.priceDate).filter((d): d is string => d !== null).sort().pop() ?? null,
		total: money(total),
		byClass: [...classes]
			.map(([assetClass, value]) => ({ assetClass, value: money(value), weight: total > 0 ? value / total : 0 }))
			.sort((a, b) => Number(b.value) - Number(a.value)),
		holdings: includeSold ? holdings : held,
		ahead: judged.filter((h) => Number(h.effect) >= 0).length,
		behind: judged.filter((h) => Number(h.effect) < 0).length,
		flags: {
			empty: selection.start === null,
			unpricedHoldings: held.filter((h) => h.price === null).length,
			pricesLoading: await pricesLoading(selection.series.flatMap((x) => x.unpriced)),
		},
	};
}

export async function getScript(scopeInput: Scope, instrumentId: string): Promise<Script> {
	const scope = await resolveScope(scopeInput);
	const selection = await loadSelection(scope.accountIds);
	const { holdings, closes, labels } = await build(selection);
	const holding = holdings.find((h) => h.instrumentId === instrumentId);
	// Not traded in anything the caller can see: as far as they can tell, it is not there.
	if (!holding) throw new ORPCError("NOT_FOUND", { status: 404, message: "Holding not found" });

	const trades = selection.series
		.flatMap((s) =>
			s.trades
				.filter((t) => t.instrumentId === instrumentId)
				.map((t) => ({
					date: t.date,
					side: t.side,
					quantity: trim(t.quantity),
					price: String(t.price),
					value: money(t.value),
					accountLabel: labels.get(s.accountId)?.label ?? "An account",
					accountId: s.accountId,
				})),
		)
		.sort((a, b) => b.date.localeCompare(a.date));

	const series = closes.get(instrumentId);
	const from = trades[trades.length - 1]?.date ?? selection.today;
	const points = series ? series.dates.map((d, i) => ({ d, c: series.closes[i] as number })).filter((p) => p.d >= from) : [];
	const step = Math.max(1, Math.ceil(points.length / 180));
	const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
	return {
		holding,
		trades,
		chart: { dates: sampled.map((p) => p.d), closes: sampled.map((p) => p.c) },
	};
}
