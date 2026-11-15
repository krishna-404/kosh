import { db } from "@backend/db/db";
import { importsRouter } from "@backend/modules/imports/imports.router";
import { moneyRouter } from "@backend/modules/metrics/money.router";
import { portfolioRouter } from "@backend/modules/portfolio/portfolio.router";
import { defaultContext } from "@backend/test/setup";
import { createRouterClient } from "@orpc/server";
import { zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { companyName } from "./lib/bhavcopy.market";
import { type FetchedFile, useMarketFetcher } from "./services/fetcher.market";
import { closeOn, closeOnOrAfter, listBenchmarks, loadCloses } from "./services/prices.market.service";
import { syncMarketData } from "./services/sync.market.service";

// Prices are fetched through one door; here a made-up exchange stands behind
// it. The files have the real layouts (old bhavcopy, UDiFF bhavcopy, AMFI's
// NAVAll, mfapi's JSON) with invented securities.

const ALPHAX = "INE001A01011";
const BETAX = "INE002B01010";
const FUND = "INF000F01019"; // a mutual fund: not listed on NSE

const zip = (name: string, text: string) => Buffer.from(zipSync({ [name]: Buffer.from(text) }));

const oldBhavcopy = (rows: [string, string, string][]) =>
	zip(
		"cm.csv",
		[
			"SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN,",
			...rows.map(([symbol, isin, close]) => `${symbol},EQ,1,1,1,${close},1,1,1,1,X,1,${isin},`),
		].join("\n"),
	);
const udiffBhavcopy = (rows: [string, string, string][]) =>
	zip(
		"BhavCopy.csv",
		[
			"TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric",
			...rows.map(([symbol, isin, close]) => `d,d,CM,NSE,STK,1,${isin},${symbol},EQ,,,,,${symbol} LTD,1,1,1,${close}`),
		].join("\n"),
	);

/** What the made-up exchange publishes, by date. Absent = a holiday. */
const DAYS: Record<string, Buffer> = {
	"2024-07-04": oldBhavcopy([["ALPHAX", ALPHAX, "100"], ["BETAX", BETAX, "200"]]),
	"2024-07-05": oldBhavcopy([["ALPHAX", ALPHAX, "101.5"], ["BETAX", BETAX, "198"]]),
	"2024-07-08": udiffBhavcopy([["ALPHAX", ALPHAX, "103"], ["BETAX", BETAX, "199"]]),
	// 2024-07-09: holiday
	"2024-07-10": udiffBhavcopy([["ALPHAX", ALPHAX, "104.25"], ["BETAX", BETAX, "201"]]),
};

const NAV_ALL = [
	"Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date",
	"",
	"Open Ended Schemes(Equity Scheme - Flexi Cap Fund)",
	`900001;${FUND};-;Demo Flexi Cap Fund - Growth;55.1234;10-Jul-2024`,
].join("\n");

const navs = (points: [string, string][]) =>
	Buffer.from(JSON.stringify({ meta: {}, data: points.map(([date, nav]) => ({ date, nav })).reverse() }));
const NAV_HISTORY: Record<string, Buffer> = {
	"900001": navs([["04-07-2024", "54.00"], ["05-07-2024", "54.50"], ["10-07-2024", "55.1234"]]),
	"100822": navs([["01-07-2024", "150.00"], ["04-07-2024", "151.00"], ["10-07-2024", "153.00"]]),
	"114616": navs([["04-07-2024", "28.00"], ["10-07-2024", "28.50"]]),
};

describe("company names", () => {
	it("are set the way a person would write them, keeping what it can tell are acronyms", () => {
		expect(companyName("BHARTI AIRTEL LIMITED")).toBe("Bharti Airtel Ltd");
		expect(companyName("HDFC BANK LTD")).toBe("HDFC Bank Ltd");
		expect(companyName("ICICI BANK LIMITED")).toBe("ICICI Bank Ltd");
		expect(companyName("TATA CONSULTANCY SERV LT")).toBe("Tata Consultancy Serv LT");
		expect(companyName("STATE BANK OF INDIA")).toBe("State Bank of India");
		expect(companyName("LARSEN & TOUBRO LTD.")).toBe("Larsen & Toubro Ltd");
		expect(companyName("  ITC   LIMITED ")).toBe("ITC Ltd");
		expect(companyName("NIPPON INDIA ETF GOLD BEES")).toBe("Nippon India ETF Gold Bees");
	});
});

describe("Market data", () => {
	let calls: string[];
	let restore: () => void;
	let refuse = false;

	const exchange = async (url: string): Promise<FetchedFile> => {
		calls.push(url);
		if (refuse) return { status: 403, bytes: Buffer.from("Access Denied") };
		const day = /(\d{4})(\d{2})(\d{2})_F_0000/.exec(url);
		const old = /cm(\d{2})([A-Z]{3})(\d{4})bhav/.exec(url);
		if (day || old) {
			const date = day
				? `${day[1]}-${day[2]}-${day[3]}`
				: `${old?.[3]}-${String(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(old?.[2] as string) + 1).padStart(2, "0")}-${old?.[1]}`;
			// The made-up exchange serves each day in one layout only, like the real one.
			const isUdiffUrl = day !== null;
			const publishedAsUdiff = date >= "2024-07-08";
			const bytes = DAYS[date];
			return bytes && isUdiffUrl === publishedAsUdiff ? { status: 200, bytes } : { status: 404, bytes: Buffer.alloc(0) };
		}
		// Nothing announced for these shares.
		if (url.includes("corporates-corporateActions")) return { status: 200, bytes: Buffer.from("[]") };
		if (url.includes("NAVAll")) return { status: 200, bytes: Buffer.from(NAV_ALL) };
		const scheme = /\/mf\/(\d+)/.exec(url)?.[1];
		const history = scheme ? NAV_HISTORY[scheme] : undefined;
		return history ? { status: 200, bytes: history } : { status: 404, bytes: Buffer.alloc(0) };
	};

	const tradebook = (rows: string[]) =>
		[
			"symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time",
			...rows,
		].join("\n");
	let upload: (name: string, text: string) => Promise<unknown>;

	beforeEach(async () => {
		if (!defaultContext) throw new Error("defaultContext not initialized");
		calls = [];
		refuse = false;
		restore = useMarketFetcher(exchange);
		const portfolio = createRouterClient(portfolioRouter, { context: defaultContext });
		const imports = createRouterClient(importsRouter, { context: defaultContext });
		const holder = await portfolio.createPerson({ displayName: "Anil" });
		const account = await portfolio.createAccount({ personId: holder.id, broker: "zerodha", label: "Anil Zerodha" });
		upload = (name, text) =>
			imports.apply({ accountId: account.id, fileName: name, contentBase64: Buffer.from(text).toString("base64") });
		await upload(
			"tb.csv",
			tradebook([
				`ALPHAX,${ALPHAX},2024-07-05,NSE,EQ,EQ,buy,false,10,101,T1,O1,2024-07-05T10:00:00`,
				`DEMOFUND,${FUND},2024-07-05,NSE,MF,MF,buy,false,100,54.5,T2,O2,2024-07-05T10:00:00`,
			]),
		);
	});
	afterEach(() => restore());

	const closes = async (isin: string) => {
		const instrument = await db.instruments.where({ isin }).select("id", "priceSource", "kind").take();
		const series = (await loadCloses([instrument.id])).get(instrument.id);
		return { ...instrument, bars: series ? series.dates.map((d, i) => [d, series.closes[i]]) : [] };
	};

	it("prices what is held from its first trade, from both bhavcopy layouts, skipping holidays", async () => {
		const report = await syncMarketData({ today: "2024-07-10" });
		expect(report.problems).toEqual([]);
		expect(report).toMatchObject({ daysFetched: 3, daysRemaining: 0 });

		// ALPHAX: bought on the 5th, so priced from the 5th — the 4th is not asked for.
		const alphax = await closes(ALPHAX);
		expect(alphax.priceSource).toBe("nse");
		// The statement named it only by its symbol; the price file gives the company.
		expect(await db.instruments.where({ isin: ALPHAX }).get("name")).toBe("Alphax Ltd");
		expect(alphax.bars).toEqual([
			["2024-07-05", 101.5],
			["2024-07-08", 103],
			["2024-07-10", 104.25],
		]);
		// The holiday is remembered, so it is never asked for again.
		const days = await db.providerPayloads.where({ source: "nse_bhavcopy" }).order({ key: "ASC" }).select("key", "status");
		expect(days.map((d) => [d.key, d.status])).toEqual([
			["2024-07-05", "ok"],
			["2024-07-08", "ok"],
			["2024-07-09", "missing"],
			["2024-07-10", "ok"],
		]);
	});

	it("finds a fund NSE does not list through AMFI, and prices it by NAV", async () => {
		await syncMarketData({ today: "2024-07-10" });
		const fund = await closes(FUND);
		expect(fund).toMatchObject({ priceSource: "amfi", kind: "mf" });
		expect(fund.bars).toEqual([
			["2024-07-04", 54],
			["2024-07-05", 54.5],
			["2024-07-10", 55.1234],
		]);
	});

	it("prices the benchmarks from just before the first day anyone has money in", async () => {
		await syncMarketData({ today: "2024-07-10" });
		const benchmarks = await listBenchmarks();
		expect(benchmarks.map((b) => b.slug)).toEqual(["nifty50", "gold"]);
		const series = await loadCloses(benchmarks.map((b) => b.instrumentId));
		const nifty = series.get(benchmarks[0]?.instrumentId as string);
		expect(nifty?.dates).toEqual(["2024-07-01", "2024-07-04", "2024-07-10"]);
		// A day with no close reads the one before; money arriving reads the next.
		expect(closeOn(nifty, "2024-07-07")).toBe(151);
		expect(closeOnOrAfter(nifty, "2024-07-07")).toBe(153);
		expect(closeOn(nifty, "2024-06-30")).toBeNull();
	});

	it("does nothing the second time, and bumps the prices version only when prices change", async () => {
		await syncMarketData({ today: "2024-07-10" });
		const version = await db.marketState.where({ id: 1 }).get("pricesVersion");
		expect(version).toBe(1);
		calls = [];
		const again = await syncMarketData({ today: "2024-07-10" });
		expect(again).toMatchObject({ daysFetched: 0, barsWritten: 0, problems: [] });
		expect(calls).toEqual([]);
		expect(await db.marketState.where({ id: 1 }).get("pricesVersion")).toBe(version);
	});

	it("prices something bought later from the files already held, without downloading again", async () => {
		await syncMarketData({ today: "2024-07-10" });
		await upload("tb2.csv", tradebook([`BETAX,${BETAX},2024-07-04,NSE,EQ,EQ,buy,false,5,200,T3,O3,2024-07-04T10:00:00`]));
		calls = [];
		await syncMarketData({ today: "2024-07-10" });
		// Only the one day nobody had needed before is fetched.
		expect(calls.filter((u) => u.includes("bhav") || u.includes("BhavCopy"))).toHaveLength(1);
		expect((await closes(BETAX)).bars).toEqual([
			["2024-07-04", 200],
			["2024-07-05", 198],
			["2024-07-08", 199],
			["2024-07-10", 201],
		]);
	});

	it("does a bounded amount per run and says what is left", async () => {
		const first = await syncMarketData({ today: "2024-07-10", maxDays: 2 });
		expect(first).toMatchObject({ daysRemaining: 2 });
		const second = await syncMarketData({ today: "2024-07-10", maxDays: 10 });
		expect(second.daysRemaining).toBe(0);
		expect((await closes(ALPHAX)).bars).toHaveLength(3);
	});

	it("fills in the whole history however the downloads are chunked", async () => {
		// Five weeks of market days. Downloads go newest-first, then oldest-first,
		// a few at a time — the days in between must not be passed over.
		const days: string[] = [];
		for (let ms = Date.parse("2024-06-03"); ms <= Date.parse("2024-07-10"); ms += 86_400_000) {
			const d = new Date(ms);
			if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10));
		}
		const saved = { ...DAYS };
		for (const [n, day] of days.entries())
			DAYS[day] = (day >= "2024-07-08" ? udiffBhavcopy : oldBhavcopy)([["BETAX", BETAX, String(200 + n)]]);
		try {
			await upload("early.csv", tradebook([`BETAX,${BETAX},2024-06-03,NSE,EQ,EQ,buy,false,5,200,T7,O7,2024-06-03T10:00:00`]));
			let rounds = 0;
			let report = await syncMarketData({ today: "2024-07-10", maxDays: 4 });
			while (report.daysRemaining > 0 && rounds++ < 20) report = await syncMarketData({ today: "2024-07-10", maxDays: 4 });
			expect(report.problems).toEqual([]);
			expect((await closes(BETAX)).bars.map(([d]) => d)).toEqual(days);
			const betax = await db.instruments.where({ isin: BETAX }).select("pricedFrom", "pricedThrough").take();
			expect(betax).toEqual({ pricedFrom: "2024-06-03", pricedThrough: "2024-07-10" });
		} finally {
			for (const key of Object.keys(DAYS)) delete DAYS[key];
			Object.assign(DAYS, saved);
		}
	});

	it("follows a share through a change of ISIN, as a face-value split brings", async () => {
		// From the 11th ALPHAX trades under a new number on the same share line.
		const NEXT = "INE001A01029";
		const saved = { ...DAYS };
		DAYS["2024-07-11"] = udiffBhavcopy([["ALPHAX", NEXT, "20.9"], ["BETAX", BETAX, "202"]]);
		DAYS["2024-07-12"] = udiffBhavcopy([["ALPHAX", NEXT, "21"], ["BETAX", BETAX, "203"]]);
		try {
			const report = await syncMarketData({ today: "2024-07-12" });
			expect(report.problems).toEqual([]);

			// The same instrument, now known by the new number; its prices carry on.
			expect(await db.instruments.where({ isin: ALPHAX }).count()).toBe(0);
			const alphax = await closes(NEXT);
			expect(alphax.bars.map(([d]) => d)).toEqual(["2024-07-05", "2024-07-08", "2024-07-10", "2024-07-11", "2024-07-12"]);
			expect(alphax.bars.at(-1)).toEqual(["2024-07-12", 21]);
			expect(await db.instrumentAliases.where({ instrumentId: alphax.id, aliasKind: "old_isin" }).pluck("alias")).toEqual([
				ALPHAX,
			]);

			// A later statement names it either way; both are the one share.
			await upload(
				"later.csv",
				tradebook([
					`ALPHAX,${NEXT},2024-07-12,NSE,EQ,EQ,buy,false,5,21,T8,O8,2024-07-12T10:00:00`,
					`ALPHAX,${ALPHAX},2024-07-08,NSE,EQ,EQ,buy,false,1,103,T9,O9,2024-07-08T10:00:00`,
				]),
			);
			expect(await db.trades.where({ instrumentId: alphax.id }).count()).toBe(3);
			expect(await db.instruments.where({ symbolCanonical: "ALPHAX" }).count()).toBe(1);
		} finally {
			for (const key of Object.keys(DAYS)) delete DAYS[key];
			Object.assign(DAYS, saved);
		}
	});

	it("takes a statement's newer ISIN as the same share — without letting the statement rename it", async () => {
		const NEXT = "INE001A01029";
		await upload("later.csv", tradebook([`ALPHAX,${NEXT},2024-07-09,NSE,EQ,EQ,buy,false,5,21,T8,O8,2024-07-09T10:00:00`]));
		// One share still, and it keeps the number the exchange knows it by until the exchange says otherwise.
		const instrument = await db.instruments.where({ symbolCanonical: "ALPHAX" }).select("id", "isin");
		expect(instrument).toEqual([{ id: expect.any(String), isin: ALPHAX }]);
		expect(await db.trades.where({ instrumentId: instrument[0]?.id }).count()).toBe(2);
		expect(await db.instrumentAliases.where({ aliasKind: "old_isin" }).count()).toBe(0);
		// A fund's ISIN is never matched this way.
		await upload("fund.csv", tradebook([`OTHERFUND,INF000F01027,2024-07-09,NSE,MF,MF,buy,false,5,21,T9,O9,2024-07-09T10:00:00`]));
		expect(await db.instruments.where({ isin: { in: [FUND, "INF000F01027"] } }).count()).toBe(2);
	});

	it("calls a share what the exchange calls it, whatever the first statement said", async () => {
		// Someone's statement gave BETAX's ISIN under another company's symbol.
		await upload("odd.csv", tradebook([`ALPHAX,${BETAX},2024-07-05,NSE,EQ,EQ,buy,false,1,200,T7,O7,2024-07-05T10:00:00`]));
		expect(await db.instruments.where({ isin: BETAX }).get("symbolCanonical")).toBe("ALPHAX");
		await syncMarketData({ today: "2024-07-10" });
		// The exchange's file for that ISIN says BETAX: announcements will be asked for under that.
		expect(await db.instruments.where({ isin: BETAX }).select("symbolCanonical", "name").take()).toEqual({
			symbolCanonical: "BETAX",
			name: "Betax Ltd",
		});
	});

	it("stops and says so when the exchange refuses, keeping nothing it was not given", async () => {
		refuse = true;
		const report = await syncMarketData({ today: "2024-07-10" });
		expect(report.problems[0]).toMatch(/NSE answered 403/);
		expect(await db.providerPayloads.count()).toBe(0);
		expect(await db.marketState.where({ id: 1 }).get("lastSyncNote")).toMatch(/403/);
		expect(await db.marketState.where({ id: 1 }).get("lastSyncOk")).toBe(false);
		// People are told that it did not finish — not the addresses and error text, which stay in the log.
		const status = await createRouterClient(moneyRouter, { context: defaultContext as NonNullable<typeof defaultContext> }).market();
		expect(status.trouble).toMatch(/couldn’t reach the exchange/);
		expect(JSON.stringify(status)).not.toMatch(/403|nsearchives/);
		// Nothing is marked as a holiday on the strength of a refusal.
		refuse = false;
		expect((await syncMarketData({ today: "2024-07-10" })).daysFetched).toBe(3);
		// …and a fetch that goes through clears the trouble.
		expect(await db.marketState.where({ id: 1 }).get("lastSyncOk")).toBe(true);
	});
});
