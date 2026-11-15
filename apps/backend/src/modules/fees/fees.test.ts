import { db } from "@backend/db/db";
import { feesRouter } from "@backend/modules/fees/fees.router";
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

// A fund manager's fee, paid from outside the account — on the same small
// history the money tests use, so every figure can be checked by hand.
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
	fees: createRouterClient(feesRouter, { context }),
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

describe("Fund-manager fees", () => {
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

	it("after fees: the same value, a lower return — and the difference is exactly the fees", async () => {
		const before = await anil.money.returns(account(anilAccount));
		expect(before.fees).toBeNull();

		// Ramesh bills by invoice: ₹1,000 at the end of June, ₹1,500 at the end of December.
		await anil.fees.set({ accountId: anilAccount, kind: "invoiced", payee: "Ramesh Iyer", startsOn: "2024-01-01" });
		await anil.fees.addPayment({ accountId: anilAccount, paidOn: "2024-06-30", amount: "1000" });
		await anil.fees.addPayment({ accountId: anilAccount, paidOn: "2024-12-31", amount: "1500", note: "H2 invoice" });
		const after = await anil.money.returns(account(anilAccount));

		// Nothing about the account itself changed: the fee never touched it.
		expect(after.value).toBe(before.value);
		expect(after.moved).toEqual(before.moved);
		expect(after.twr).toBe(before.twr);

		// The return is the rate at which everything he paid — the manager included — grew to today's value.
		const expected = xirr([
			{ date: "2024-01-01", amount: -100000 },
			{ date: "2024-06-30", amount: -1000 },
			{ date: "2024-07-01", amount: -50000 },
			{ date: "2024-09-02", amount: 20000 },
			{ date: "2024-12-31", amount: -1500 },
			{ date: "2025-01-01", amount: 139950 },
		]);
		if (expected.status !== "converged") throw new Error("fixture should have a return");
		expect(after.xirr).toBeCloseTo(expected.rate, 9);
		expect(after.xirr as number).toBeLessThan(before.xirr as number);
		expect(after.fees).toMatchObject({ total: "2500.00" });
		expect(after.fees?.xirrBefore).toBeCloseTo(before.xirr as number, 12);

		// Before fees − after fees = the fees: the money counted as paid in differs by exactly ₹2,500.
		const paidIn = (r: typeof after) => r.trail.flows.reduce((sum, f) => (Number(f.amount) < 0 ? sum - Number(f.amount) : sum), 0);
		expect(paidIn(after) - paidIn(before)).toBeCloseTo(2500, 2);
		expect(after.trail.flows).toContainEqual(
			expect.objectContaining({ date: "2024-06-30", amount: "-1000.00", what: "Fund manager’s fee, paid from outside the account" }),
		);

		// NIFTY gets the fee money too — it is the same money — so it ends higher than before.
		const nifty = (r: typeof after) => r.benchmarks.find((b) => b.slug === "nifty50");
		expect(Number(nifty(after)?.value)).toBeGreaterThan(Number(nifty(before)?.value));
		expect(Number(nifty(after)?.ahead)).toBeLessThan(Number(nifty(before)?.ahead));
		expect(after.fees?.aheadPointsBefore).toBeCloseTo((before.xirr as number) - (nifty(before)?.xirr as number), 9);
	});

	it("a percentage of assets is charged each quarter on each day's value, and what has built up since counts too", async () => {
		await anil.fees.set({ accountId: anilAccount, kind: "percent_of_assets", rate: 0.01, startsOn: "2024-01-01" });
		const overview = await anil.fees.overview({ accountId: anilAccount });

		expect(overview.arrangement).toMatchObject({ kind: "percent_of_assets", rate: 0.01, startsOn: "2024-01-01", endsOn: null });
		expect(overview.charges.map((c) => [c.date, c.accrued])).toEqual([
			["2024-03-31", false],
			["2024-06-30", false],
			["2024-09-30", false],
			["2024-12-31", false],
			["2025-01-01", true], // one day into the new quarter, not billed yet
		]);
		// First quarter by hand: ₹1,00,000 on 1 and 2 Jan, ₹99,950 from the 3rd (₹50 of costs), 91 days in all.
		expect(overview.charges[0]?.amount).toBe((((2 * 100000 + 89 * 99950) * 0.01) / 365).toFixed(2));
		expect((await anil.money.returns(account(anilAccount))).fees?.total).toBe(overview.total);
		expect(Number(overview.total)).toBeCloseTo(overview.charges.reduce((sum, c) => sum + Number(c.amount), 0), 2);
	});

	it("is replaced from a day on, keeping what ran before; and can be stopped", async () => {
		await anil.fees.set({ accountId: anilAccount, kind: "fixed", amountPerYear: "3650", startsOn: "2024-01-01" });
		await anil.fees.set({ accountId: anilAccount, kind: "percent_of_assets", rate: 0.02, payee: "Iyer Capital", startsOn: "2024-07-01" });

		let overview = await anil.fees.overview({ accountId: anilAccount });
		expect(overview.arrangement).toMatchObject({ kind: "percent_of_assets", payee: "Iyer Capital", startsOn: "2024-07-01" });
		expect(overview.earlier).toEqual([expect.objectContaining({ kind: "fixed", startsOn: "2024-01-01", endsOn: "2024-06-30" })]);
		// ₹10 a day for the 182 days to 30 June.
		expect(overview.charges.filter((c) => c.date <= "2024-06-30").reduce((sum, c) => sum + Number(c.amount), 0)).toBeCloseTo(1820, 2);

		await anil.fees.end({ accountId: anilAccount, endsOn: "2024-09-30" });
		overview = await anil.fees.overview({ accountId: anilAccount });
		expect(overview.charges.at(-1)).toMatchObject({ date: "2024-09-30", accrued: false });
		expect(overview.arrangement).toBeNull(); // nothing is running today
		expect((await anil.portfolio.directory()).accounts.find((a) => a.id === anilAccount)?.fee).toBeNull();
		await expect(anil.fees.end({ accountId: anilAccount, endsOn: "2024-12-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("says what kind of arrangement needs", async () => {
		await expect(anil.fees.set({ accountId: anilAccount, kind: "percent_of_assets", startsOn: "2024-01-01" })).rejects.toThrow();
		await expect(anil.fees.set({ accountId: anilAccount, kind: "fixed", startsOn: "2024-01-01" })).rejects.toThrow();
		await expect(
			anil.fees.set({ accountId: anilAccount, kind: "invoiced", startsOn: "2024-06-01", endsOn: "2024-01-01" }),
		).rejects.toThrow();
		await expect(anil.fees.addPayment({ accountId: anilAccount, paidOn: "2025-06-01", amount: "10" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("shows wherever the account is listed or compared", async () => {
		await anil.fees.set({ accountId: anilAccount, kind: "invoiced", payee: "Ramesh Iyer", startsOn: "2024-01-01" });
		const { id: paymentId } = await anil.fees.addPayment({ accountId: anilAccount, paidOn: "2024-06-30", amount: "1000" });
		const group = await anil.portfolio.createGroup({ name: "Ramesh", kind: "fund_manager", accountIds: [anilAccount] });

		const listed = (await anil.portfolio.directory()).accounts.find((a) => a.id === anilAccount);
		expect(listed?.fee).toMatchObject({ kind: "invoiced", payee: "Ramesh Iyer" });
		const returns = await anil.money.returns(account(anilAccount));
		expect(listed?.xirr).toBeCloseTo(returns.xirr as number, 9); // lists show the after-fees return too

		const row = (await anil.money.groups({ period: "all" })).groups.find((g) => g.groupId === group.id);
		expect(row?.xirr).toBeCloseTo(returns.xirr as number, 9);
		expect(row?.fees).toMatchObject({ total: "1000.00" });
		expect(row?.fees?.xirrBefore as number).toBeGreaterThan(row?.xirr as number);

		// A payment taken back is no longer counted (and is kept, not deleted).
		await anil.fees.removePayment({ paymentId });
		expect((await anil.money.returns(account(anilAccount))).fees).toBeNull();
		expect(await db.feePayments.where({ id: paymentId }).get("isLive")).toBe(false);
	});

	it("is set by owners only; anyone who can see the account can see it", async () => {
		const sunita = await signUp();
		const ramesh = await signUp();
		const stranger = await signUp();
		await anil.access.grant({ target: { accountId: anilAccount }, email: sunita.email, level: "view" });
		await anil.access.grant({ target: { accountId: anilAccount }, email: ramesh.email, level: "edit" });
		await anil.fees.set({ accountId: anilAccount, kind: "percent_of_assets", rate: 0.015, startsOn: "2024-01-01" });

		const seen = await sunita.fees.overview({ accountId: anilAccount });
		expect(seen.canChange).toBe(false);
		expect(seen.arrangement).toMatchObject({ rate: 0.015 });
		expect((await sunita.money.returns(account(anilAccount))).fees).not.toBeNull();

		// The manager himself can edit the account, but not what he is paid.
		for (const who of [sunita, ramesh]) {
			await expect(who.fees.set({ accountId: anilAccount, kind: "fixed", amountPerYear: "1", startsOn: "2024-01-01" })).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
			await expect(who.fees.addPayment({ accountId: anilAccount, paidOn: "2024-06-30", amount: "5" })).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(who.fees.end({ accountId: anilAccount, endsOn: "2024-06-30" })).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		await expect(stranger.fees.overview({ accountId: anilAccount })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			stranger.fees.set({ accountId: anilAccount, kind: "fixed", amountPerYear: "1", startsOn: "2024-01-01" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
