import { db } from "@backend/db/db";
import { importsRouter } from "@backend/modules/imports/imports.router";
import { moneyRouter } from "@backend/modules/metrics/money.router";
import { useFixedToday } from "@backend/modules/metrics/services/dates.metrics";
import { clearSeriesCache } from "@backend/modules/metrics/services/series.metrics.service";
import { accessRouter } from "@backend/modules/portfolio/access.router";
import { portfolioRouter } from "@backend/modules/portfolio/portfolio.router";
import { questionsRouter } from "@backend/modules/questions/questions.router";
import { defaultContext } from "@backend/test/setup";
import { createUserAndLogin } from "@backend/test/utils/user-auth.utils";
import { xirr } from "@connected-repo/finance-math/xirr";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Value and returns, on a history small enough to check by hand.
//
//   1 Jan 2024  Anil puts in ₹1,00,000
//   2 Jan       buys 100 ALPHAX at ₹500 (₹50,000); settles on the 3rd for ₹50,050 — ₹50 of costs
//   1 Jul       puts in another ₹50,000
//   2 Sep       takes out ₹20,000 …
//   3 Sep       … and ₹20,000 arrives in Riya's account (the same money)
//   "today" is 1 Jan 2025; ALPHAX closed at ₹600, NIFTY went 100 → 110 (Jul) → 121.

type Session = Awaited<ReturnType<typeof createUserAndLogin>>;
const as = (context: Session) => ({
	id: context.user.id,
	email: context.user.email as string,
	portfolio: createRouterClient(portfolioRouter, { context }),
	access: createRouterClient(accessRouter, { context }),
	imports: createRouterClient(importsRouter, { context }),
	questions: createRouterClient(questionsRouter, { context }),
	money: createRouterClient(moneyRouter, { context }),
});
type Person = ReturnType<typeof as>;

async function signUp(): Promise<Person> {
	const session = await createUserAndLogin();
	await db.users.where({ id: session.user.id }).update({ emailVerified: true });
	return as(session);
}

const ALPHAX = "INE001A01011";
const LEDGER_HEADER = "particulars,posting_date,cost_center,voucher_type,debit,credit,net_balance";
const ledger = (lines: string[], closing: string) =>
	[LEDGER_HEADER, "Opening Balance,,,,,,0.000000", ...lines, `Closing Balance,,,,,,${closing}`].join("\n");
const ANIL_LEDGER = ledger(
	[
		"Funds added using UPI a1,2024-01-01,NSE-EQ - Z,Bank Receipts,0.000000,100000.000000,100000.000000",
		"Net settlement for Equity with settlement number: 1,2024-01-03,NSE-EQ - Z,Book Voucher,50050.000000,0.000000,49950.000000",
		"Funds added using UPI a2,2024-07-01,NSE-EQ - Z,Bank Receipts,0.000000,50000.000000,99950.000000",
		"\"Instant Payout of 20000.0/- to DEMO BANK LTD, 0000111122 A/C number as per withdrawal request made on 2024-09-02 with reference number r1\",2024-09-02,NSE-EQ - Z,Bank Payments,20000.000000,0.000000,79950.000000",
	],
	"79950.000000",
);
const RIYA_LEDGER = ledger(
	["Funds added using NEFT r1,2024-09-03,NSE-EQ - Z,Bank Receipts,0.000000,20000.000000,20000.000000"],
	"20000.000000",
);
const TRADEBOOK = [
	"symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time",
	`ALPHAX,${ALPHAX},2024-01-02,NSE,EQ,EQ,buy,false,100,500,T1,O1,2024-01-02T10:00:00`,
].join("\n");

const file = (accountId: string, fileName: string, text: string) => ({
	accountId,
	fileName,
	contentBase64: Buffer.from(text).toString("base64"),
});

describe("Money", () => {
	let anil: Person;
	let anilHolder: string;
	let anilAccount: string;
	let riyaAccount: string;
	let unfix: () => void;

	const prices = async (instrumentId: string, points: [string, number][]) => {
		await db.priceBars.createMany(
			points.map(([barDate, close]) => ({ instrumentId, barDate, close: String(close), source: "test" })),
		);
		await db.marketState.where({ id: 1 }).increment("pricesVersion");
	};
	const benchmark = async (slug: string) => (await db.instruments.where({ slug }).select("id").take()).id;

	beforeEach(async () => {
		if (!defaultContext) throw new Error("defaultContext not initialized");
		unfix = useFixedToday("2025-01-01");
		clearSeriesCache();
		await db.users.where({ id: defaultContext.user.id }).update({ emailVerified: true });
		anil = as(defaultContext);
		anilHolder = (await anil.portfolio.createPerson({ displayName: "Anil" })).id;
		anilAccount = (
			await anil.portfolio.createAccount({ personId: anilHolder, broker: "zerodha", label: "Anil · Zerodha" })
		).id;
		const riya = (await anil.portfolio.createPerson({ displayName: "Riya", kind: "no_login" })).id;
		riyaAccount = (
			await anil.portfolio.createAccount({ personId: riya, broker: "zerodha", label: "Riya · Zerodha" })
		).id;

		await anil.imports.apply(file(anilAccount, "ledger.csv", ANIL_LEDGER));
		await anil.imports.apply(file(anilAccount, "tradebook.csv", TRADEBOOK));
		await anil.imports.apply(file(riyaAccount, "ledger.csv", RIYA_LEDGER));

		const alphax = (await db.instruments.where({ isin: ALPHAX }).select("id").take()).id;
		await prices(alphax, [
			["2024-01-02", 500],
			["2024-01-03", 500],
			["2024-07-01", 550],
			["2024-12-31", 600],
		]);
		await prices(await benchmark("nifty50"), [
			["2023-12-29", 100],
			["2024-01-01", 100],
			["2024-01-02", 100],
			["2024-07-01", 110],
			["2024-09-02", 115],
			["2024-09-03", 115],
			["2024-12-31", 121],
		]);
	});
	afterEach(() => unfix());

	const account = (id: string) => ({ scope: { kind: "account" as const, id } });

	it("values an account as its holdings plus its cash, and returns what the money really earned", async () => {
		const r = await anil.money.returns(account(anilAccount));

		// 100 shares at ₹600, plus ₹79,950 in the ledger.
		expect(r.value).toBe("139950.00");
		expect(r.window).toMatchObject({ from: "2024-01-01", to: "2025-01-01" });
		// The return is the rate that makes these exact flows balance.
		const expected = xirr([
			{ date: "2024-01-01", amount: -100000 },
			{ date: "2024-07-01", amount: -50000 },
			{ date: "2024-09-02", amount: 20000 },
			{ date: "2025-01-01", amount: 139950 },
		]);
		if (expected.status !== "converged") throw new Error("fixture should have a return");
		expect(r.xirr).toBeCloseTo(expected.rate, 9);
		expect(r.trail.flows.map((f) => [f.date, f.amount])).toEqual([
			["2024-01-01", "-100000.00"],
			["2024-07-01", "-50000.00"],
			["2024-09-02", "20000.00"],
			["2025-01-01", "139950.00"],
		]);
		expect(r.flags).toMatchObject({ empty: false, accountsWithoutLedger: 0, unpricedHoldings: 0 });
	});

	it("puts the same figures beside each account wherever accounts are listed", async () => {
		const r = await anil.money.returns(account(anilAccount));
		const nifty = r.benchmarks.find((b) => b.slug === "nifty50");

		const listed = (await anil.portfolio.directory()).accounts.find((a) => a.id === anilAccount);
		expect(listed?.value).toBe(r.value);
		expect(listed?.xirr).toBeCloseTo(r.xirr as number, 9);
		expect(listed?.benchmarkXirr).toBeCloseTo(nifty?.xirr as number, 9);

		const grid = await anil.access.matrix();
		expect(grid.holders.flatMap((h) => h.accounts).find((a) => a.id === anilAccount)?.value).toBe(r.value);

		// An account nothing has been uploaded to has no figures — not zeros.
		const empty = await anil.portfolio.createAccount({ personId: anilHolder, broker: "groww", label: "Anil · Empty" });
		const blank = (await anil.portfolio.directory()).accounts.find((a) => a.id === empty.id);
		expect(blank).toMatchObject({ value: null, xirr: null, benchmarkXirr: null });
	});

	it("says what moved the money: put in, taken out, what prices did, what it cost", async () => {
		const { moved } = await anil.money.returns(account(anilAccount));
		expect(moved).toEqual({
			opening: "0.00",
			putIn: "150000.00",
			takenOut: "20000.00",
			priceGains: "10000.00", // 100 shares × ₹100
			dividends: "0.00",
			dividendsToBank: "0.00",
			deposits: 2,
			withdrawals: 1,
			interest: "0.00",
			fees: "50.00", // the settlement took ₹50,050 for ₹50,000 of shares
			closing: "139950.00",
		});
	});

	it("puts the same money into NIFTY: same days, same amounts", async () => {
		const r = await anil.money.returns(account(anilAccount));
		const nifty = r.benchmarks.find((b) => b.slug === "nifty50");
		// 1,00,000 buys 1000 units at 100; 50,000 buys 454.545 at 110; 20,000 sells 173.913 at 115.
		const units = 100000 / 100 + 50000 / 110 - 20000 / 115;
		expect(Number(nifty?.value)).toBeCloseTo(units * 121, 1);
		expect(Number(nifty?.ahead)).toBeCloseTo(139950 - units * 121, 1);
		expect(nifty?.xirr).toBeGreaterThan(r.xirr as number);
		// Gold has no prices here: no number is made up for it.
		expect(r.benchmarks.find((b) => b.slug === "gold")).toMatchObject({ value: null, xirr: null, ahead: null });
	});

	it("does not count a share twice between the day it is bought and the day it is paid for", async () => {
		// Looked at two months in, so the chart has a point for every day.
		unfix();
		unfix = useFixedToday("2024-03-01");
		clearSeriesCache();
		const r = await anil.money.returns(account(anilAccount));
		const on = (date: string) => r.chart.you[r.chart.dates.indexOf(date)];
		expect(on("2024-01-01")).toBe(100000);
		expect(on("2024-01-02")).toBe(100000); // shares 50,000 + cash 1,00,000 − 50,000 owed
		expect(on("2024-01-03")).toBe(99950); // paid, with ₹50 of costs
	});

	it("treats money moved between two accounts as one's withdrawal and the other's deposit — until paired, within a selection that holds both", async () => {
		const everything = { scope: { kind: "everything" as const } };
		const before = await anil.money.returns(everything);
		expect(before.moved).toMatchObject({ putIn: "170000.00", takenOut: "20000.00" });

		const [suggested] = (await anil.questions.list({})).filter((q) => q.kind === "transfer");
		if (suggested?.kind !== "transfer") throw new Error("expected a transfer suggestion");
		await anil.questions.transfer({ outFlowId: suggested.out.flowId, inFlowId: suggested.in.flowId, same: true });

		// For the family as a whole, that ₹20,000 never left.
		const after = await anil.money.returns(everything);
		expect(after.moved).toMatchObject({ putIn: "150000.00", takenOut: "0.00" });
		expect(after.value).toBe(before.value);
		// Each account on its own still saw money go out, and come in.
		expect((await anil.money.returns(account(anilAccount))).moved.takenOut).toBe("20000.00");
		expect((await anil.money.returns(account(riyaAccount))).moved.putIn).toBe("20000.00");
	});

	it("can look at the last year only: the value at its start counts as money put in then", async () => {
		const unfixLater = useFixedToday("2025-07-01");
		const r = await anil.money.returns({ ...account(anilAccount), period: "1y" });
		unfixLater();
		useFixedToday("2025-01-01");
		// Opening on 1 Jul 2024: 100 × ₹550 + ₹99,950.
		expect(r.moved.opening).toBe("154950.00");
		expect(r.moved.putIn).toBe("0.00");
		expect(r.window.from).toBe("2024-07-02");
		expect(r.trail.flows[0]).toMatchObject({ date: "2024-07-01", amount: "-154950.00" });
	});

	it("shows each holding against NIFTY on the same buys", async () => {
		const h = await anil.money.holdings(account(anilAccount));
		expect(h.total).toBe("60000.00");
		expect(h.holdings).toHaveLength(1);
		expect(h.holdings[0]).toMatchObject({
			symbol: "ALPHAX",
			assetClass: "stocks",
			quantity: "100",
			price: "600",
			priceDate: "2024-12-31",
			value: "60000.00",
			weight: 1,
			invested: "50000.00",
			gain: "10000.00",
			benchmarkValue: "60500.00", // ₹50,000 of NIFTY at 100 is 500 units; at 121, ₹60,500
			effect: "-500.00",
			sold: false,
		});
		expect(h).toMatchObject({ ahead: 0, behind: 1 });
		expect(h.holdings[0]?.heldIn).toEqual([
			expect.objectContaining({ accountId: anilAccount, quantity: "100", value: "60000.00", since: "2024-01-02" }),
		]);

		const script = await anil.money.script({ ...account(anilAccount), instrumentId: h.holdings[0]?.instrumentId as string });
		expect(script.trades).toEqual([
			{ date: "2024-01-02", side: "buy", quantity: "100", price: "500", value: "50000.00", accountLabel: "Anil · Zerodha", accountId: anilAccount },
		]);
		expect(script.chart.closes.at(-1)).toBe(600);
	});

	it("works from trades alone when no ledger is in, and says so", async () => {
		const groww = (
			await anil.portfolio.createAccount({ personId: anilHolder, broker: "manual", label: "Anil · Other" })
		).id;
		await anil.imports.apply(file(groww, "tradebook.csv", TRADEBOOK.replace("T1", "T9")));
		const r = await anil.money.returns(account(groww));
		expect(r.value).toBe("60000.00");
		expect(r.flags.accountsWithoutLedger).toBe(1);
		expect(r.moved).toMatchObject({ putIn: "50000.00", priceGains: "10000.00" });
		expect(r.trail.flows[0]?.what).toMatch(/no ledger/i);
	});

	it("is recomputed the moment the ledger or the prices change", async () => {
		expect((await anil.money.returns(account(anilAccount))).value).toBe("139950.00");

		const alphax = (await db.instruments.where({ isin: ALPHAX }).select("id").take()).id;
		await prices(alphax, [["2025-01-01", 610]]);
		expect((await anil.money.returns(account(anilAccount))).value).toBe("140950.00");

		const [tradebook] = (await anil.imports.list({ accountId: anilAccount })).filter((u) => u.kind === "tradebook");
		await anil.imports.undo({ batchId: tradebook?.batchId as string });
		// The shares are gone; the cash the ledger shows is still there.
		expect((await anil.money.returns(account(anilAccount))).value).toBe("79950.00");
	});

	it("answers only for accounts the caller can see", async () => {
		const stranger = await signUp();
		await expect(stranger.money.returns(account(anilAccount))).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(stranger.money.holdings(account(anilAccount))).rejects.toMatchObject({ code: "NOT_FOUND" });
		const nothing = await stranger.money.returns({});
		expect(nothing).toMatchObject({ value: "0.00", xirr: null, flags: { empty: true } });

		// Shared one account at View: that account, and nothing of the other.
		await anil.access.grant({ target: { accountId: riyaAccount }, email: stranger.email, level: "view" });
		const shared = await stranger.money.returns({});
		expect(shared).toMatchObject({ value: "20000.00", scope: { accounts: 1 } });
		await expect(stranger.money.returns(account(anilAccount))).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			stranger.money.returns({ scope: { kind: "holder", id: anilHolder } }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("compares the caller's own groups, each against NIFTY on its own money", async () => {
		const solo = await anil.portfolio.createGroup({ name: "Anil alone", kind: "personal", accountIds: [anilAccount] });
		const both = await anil.portfolio.createGroup({ name: "Family", kind: "family", accountIds: [anilAccount, riyaAccount] });

		const compared = await anil.money.groups({});
		expect(compared.overlapping).toBe(true);
		expect(compared.groups.map((g) => [g.name, g.accounts, g.value])).toEqual([
			["Anil alone", 1, "139950.00"],
			["Family", 2, "159950.00"],
		]);
		const row = compared.groups.find((g) => g.groupId === solo.id);
		const direct = await anil.money.returns({ scope: { kind: "group", id: solo.id } });
		expect(row?.xirr).toBeCloseTo(direct.xirr as number, 9);
		expect(row?.aheadPoints).toBeCloseTo((direct.xirr as number) - (direct.benchmarks[0]?.xirr as number), 9);
		expect(compared.years.map((y) => y.year)).toEqual([2025, 2024]);

		const whatIf = await anil.money.whatIf({ groupId: solo.id });
		expect(whatIf.rows.find((r) => r.kind === "self")).toMatchObject({ value: "139950.00" });
		expect(whatIf.rows.find((r) => r.id === "nifty50")?.value).not.toBeNull();
		// "Family" holds Anil's account too — partly the same money — so it is not offered to follow.
		expect(whatIf.rows.some((r) => r.id === both.id)).toBe(false);
		// A group that shares nothing with it is: Riya's own started later, so it has no value, and says why.
		const riyas = await anil.portfolio.createGroup({ name: "Riya alone", kind: "personal", accountIds: [riyaAccount] });
		const again = await anil.money.whatIf({ groupId: solo.id });
		expect(again.rows.find((r) => r.id === riyas.id)).toMatchObject({ value: null, why: "started_later" });
		// Part-years are marked: 2024 is whole for Anil's account (it began on 1 January), 2025 is still running.
		const cells = (year: number) => compared.years.find((y) => y.year === year)?.cells.find((c) => c.groupId === solo.id);
		expect(cells(2024)?.partial).toBe(false);
		expect(cells(2025)?.partial).toBe(true);
		expect(row?.empty).toBe(false);

		// Someone else's group is not there to be asked about.
		const stranger = await signUp();
		await expect(stranger.money.whatIf({ groupId: solo.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect((await stranger.money.groups({})).groups).toEqual([]);
	});
});
