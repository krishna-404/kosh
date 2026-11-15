import { db } from "@backend/db/db";
import { settleActions, syncCorporateActions } from "@backend/modules/corporate-actions/services/corporate_actions.service";
import { dividendsRouter } from "@backend/modules/dividends/dividends.router";
import { settleDividends } from "@backend/modules/dividends/services/dividends.service";
import { importsRouter } from "@backend/modules/imports/imports.router";
import { type FetchedFile, useMarketFetcher } from "@backend/modules/market-data/services/fetcher.market";
import { moneyRouter } from "@backend/modules/metrics/money.router";
import { useFixedToday } from "@backend/modules/metrics/services/dates.metrics";
import { clearSeriesCache } from "@backend/modules/metrics/services/series.metrics.service";
import { accessRouter } from "@backend/modules/portfolio/access.router";
import { portfolioRouter } from "@backend/modules/portfolio/portfolio.router";
import { questionsRouter } from "@backend/modules/questions/questions.router";
import { defaultContext } from "@backend/test/setup";
import { createUserAndLogin } from "@backend/test/utils/user-auth.utils";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Dividends.
//
//   2 Jan 2024  Anil buys 100 ALPHAX at ₹500
//   3 Jun 2024  ALPHAX goes ex-bonus 1:1 — he holds 200
//   1 Jul 2024  he buys 50 more at ₹290 — he holds 250
//   1 Aug 2024  ALPHAX goes ex-dividend, ₹5 a share: ₹1,250 is due to him,
//               paid to his bank — no statement Kosh reads will ever show it
//   "today" is 1 Jan 2025; ALPHAX closed at ₹300.

type Session = Awaited<ReturnType<typeof createUserAndLogin>>;
const as = (context: Session) => ({
	id: context.user.id,
	email: context.user.email as string,
	portfolio: createRouterClient(portfolioRouter, { context }),
	access: createRouterClient(accessRouter, { context }),
	imports: createRouterClient(importsRouter, { context }),
	questions: createRouterClient(questionsRouter, { context }),
	money: createRouterClient(moneyRouter, { context }),
	dividends: createRouterClient(dividendsRouter, { context }),
});
type Person = ReturnType<typeof as>;
async function signUp(): Promise<Person> {
	const session = await createUserAndLogin();
	await db.users.where({ id: session.user.id }).update({ emailVerified: true });
	return as(session);
}

const ALPHAX = "INE001A01011";
const tradebook = (rows: string[]) =>
	[
		"symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time",
		...rows,
	].join("\n");
const trade = (id: string, date: string, quantity: number, price: number) =>
	`ALPHAX,${ALPHAX},${date},NSE,EQ,EQ,buy,false,${quantity},${price},${id},O${id},${date}T10:00:00`;
const file = (accountId: string, fileName: string, text: string) => ({
	accountId,
	fileName,
	contentBase64: Buffer.from(text).toString("base64"),
});

/** What the made-up exchange has announced for ALPHAX. */
let announcements: { subject: string; exDate: string; recDate?: string }[];

describe("Dividends", () => {
	let anil: Person;
	let holder: string;
	let account: string;
	let alphax: string;
	let restoreFetcher: () => void;
	let unfix: () => void;

	const exchange = async (url: string): Promise<FetchedFile> =>
		url.includes("corporates-corporateActions") && url.includes("symbol=ALPHAX")
			? { status: 200, bytes: Buffer.from(JSON.stringify(announcements)) }
			: { status: 404, bytes: Buffer.alloc(0) };

	/** What the server's own sync does for corporate actions, without the price files. */
	const syncActions = async () => {
		const problems: string[] = [];
		await db.providerPayloads.where({ source: "nse_corp_actions" }).delete();
		const found = await syncCorporateActions("2025-01-01", problems);
		expect(problems).toEqual([]);
		return { found, applied: await settleActions(), dividends: await settleDividends() };
	};
	const here = () => ({ scope: { kind: "account" as const, id: account } });

	beforeEach(async () => {
		if (!defaultContext) throw new Error("defaultContext not initialized");
		unfix = useFixedToday("2025-01-01");
		clearSeriesCache();
		restoreFetcher = useMarketFetcher(exchange);
		announcements = [
			{ subject: " Bonus 1:1", exDate: "03-Jun-2024", recDate: "03-Jun-2024" },
			{ subject: "Annual General Meeting", exDate: "10-Jul-2024" },
			{ subject: "Dividend - Rs 5 Per Share", exDate: "01-Aug-2024" },
		];
		await db.users.where({ id: defaultContext.user.id }).update({ emailVerified: true });
		anil = as(defaultContext);
		holder = (await anil.portfolio.createPerson({ displayName: "Anil" })).id;
		account = (await anil.portfolio.createAccount({ personId: holder, broker: "zerodha", label: "Anil · Zerodha" })).id;
		await anil.imports.apply(
			file(account, "tb.csv", tradebook([trade("T1", "2024-01-02", 100, 500), trade("T2", "2024-07-01", 50, 290)])),
		);
		alphax = (await db.instruments.where({ isin: ALPHAX }).select("id").take()).id;
		// As the price sync would have left it: listed on NSE, priced from the first trade.
		await db.instruments.where({ id: alphax }).update({ priceSource: "nse", trackedSince: "2024-01-02" });
		await db.priceBars.createMany(
			[
				["2024-01-02", 500],
				["2024-05-31", 560],
				["2024-06-03", 280],
				["2024-12-31", 300],
			].map(([barDate, close]) => ({ instrumentId: alphax, barDate: String(barDate), close: String(close), source: "test" })),
		);
		await db.marketState.where({ id: 1 }).increment("pricesVersion");
	});
	afterEach(() => {
		restoreFetcher();
		unfix();
	});

	it("works out what was due from the announcement and the shares held going into the ex-date", async () => {
		await syncActions();
		const list = await anil.dividends.list({ accountId: account });
		expect(list.toConfirm).toEqual({ count: 1, total: "1250.00" });
		expect(list.dividends).toEqual([
			expect.objectContaining({
				symbol: "ALPHAX",
				exDate: "2024-08-01",
				receivedOn: "2024-08-01",
				quantity: "250", // 100 × 2 after the bonus, + 50
				amountPerShare: "5",
				amount: "1250.00",
				state: "expected",
				source: "feed",
				announcement: "Dividend - Rs 5 Per Share",
			}),
		]);
		// Running it again changes nothing.
		expect(await settleDividends()).toBe(0);
	});

	it("counts it in the return from the ex-date: earned by the account, and paid out the same day", async () => {
		// The same account with the dividend struck out, to compare with.
		await syncActions();
		const [due] = (await anil.dividends.list({ accountId: account })).dividends;
		await anil.dividends.notReceived({ dividendId: due?.id as string });
		const before = await anil.money.returns(here());
		await anil.dividends.reopen({ dividendId: due?.id as string });
		const after = await anil.money.returns(here());

		expect(after.value).toBe(before.value); // it went to his bank, not into the account
		expect(after.moved.dividends).toBe("1250.00");
		expect(after.moved.dividendsToBank).toBe("1250.00");
		expect(Number(after.moved.takenOut) - Number(before.moved.takenOut)).toBeCloseTo(1250, 2);
		// The breakdown still adds up to the value.
		const m = after.moved;
		expect(
			Number(m.opening) + Number(m.putIn) - Number(m.takenOut) + Number(m.priceGains) + Number(m.dividends) + Number(m.interest) - Number(m.fees),
		).toBeCloseTo(Number(m.closing), 2);
		expect(after.xirr as number).toBeGreaterThan(before.xirr as number);
		expect(after.trail.flows).toContainEqual(
			expect.objectContaining({ date: "2024-08-01", amount: "1250.00", what: "Dividend, paid to the holder’s bank" }),
		);
		expect(after.flags.dividendsToConfirm).toBe(1);

		// The share is judged with its dividend too.
		const [holding] = (await anil.money.holdings(here())).holdings;
		expect(Number(holding?.gain)).toBeCloseTo(250 * 300 + 1250 - (100 * 500 + 50 * 290), 2);
	});

	it("is confirmed in one go, or one at a time with what really arrived", async () => {
		await syncActions();
		const [due] = (await anil.dividends.list({ accountId: account })).dividends;
		const guess = await anil.money.returns(here());

		expect(await anil.dividends.confirm({ accountId: account })).toEqual({ confirmed: 1 });
		const confirmed = await anil.money.returns(here());
		expect(confirmed.flags.dividendsToConfirm).toBe(0);
		expect(confirmed.xirr).toBeCloseTo(guess.xirr as number, 12); // confirming as expected changes no figure

		// ₹1,125 arrived (tax was held back), three weeks later.
		await anil.dividends.change({ dividendId: due?.id as string, amount: "1125", receivedOn: "2024-08-22" });
		const changed = await anil.money.returns(here());
		expect(changed.moved.dividends).toBe("1125.00");
		expect(changed.trail.flows).toContainEqual(expect.objectContaining({ date: "2024-08-22", amount: "1125.00" }));
		expect(changed.xirr as number).toBeLessThan(guess.xirr as number);
		expect((await anil.dividends.list({ accountId: account })).dividends[0]).toMatchObject({ state: "confirmed", amount: "1125.00" });

		// Undoing the answer goes back to Kosh's own working.
		await anil.dividends.reopen({ dividendId: due?.id as string });
		expect((await anil.dividends.list({ accountId: account })).dividends[0]).toMatchObject({
			state: "expected",
			amount: "1250.00",
			receivedOn: "2024-08-01",
		});
		await expect(anil.dividends.change({ dividendId: due?.id as string, amount: "10", receivedOn: "2024-07-01" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("stops counting one that never came", async () => {
		await syncActions();
		const [due] = (await anil.dividends.list({ accountId: account })).dividends;
		await anil.dividends.notReceived({ dividendId: due?.id as string });

		const r = await anil.money.returns(here());
		expect(r.moved.dividends).toBe("0.00");
		expect(r.flags.dividendsToConfirm).toBe(0);
		const list = await anil.dividends.list({ accountId: account });
		expect(list.counted).toEqual({ count: 0, total: "0.00" });
		expect(list.dividends[0]).toMatchObject({ state: "not_received" }); // still listed — nothing is deleted
		// Settling again does not bring it back.
		expect(await settleDividends()).toBe(0);
	});

	it("follows the holdings: when they change, what was due changes — unless someone has confirmed it", async () => {
		await syncActions();
		// The bonus is undone: he held 150 going into the ex-date, not 250.
		const [bonus] = await anil.questions.corporateActions({ accountId: account });
		await anil.questions.undoCorporateAction({ applicationId: bonus?.applicationId as string });
		expect((await anil.dividends.list({ accountId: account })).dividends[0]).toMatchObject({ quantity: "150", amount: "750.00" });

		// Confirmed at ₹750, then the bonus is applied again: the confirmed figure stands.
		await anil.dividends.confirm({ accountId: account });
		const [question] = (await anil.questions.list({ accountId: account })).filter((q) => q.kind === "corporate_action");
		if (question?.kind !== "corporate_action") throw new Error("the undone bonus should be a question");
		await anil.questions.applyCorporateAction({ accountId: account, actionId: question.actionId });
		expect((await anil.dividends.list({ accountId: account })).dividends[0]).toMatchObject({ state: "confirmed", amount: "750.00" });

		// Undoing the upload retires a dividend nobody has answered.
		const other = (await anil.portfolio.createAccount({ personId: holder, broker: "manual", label: "Anil · Other" })).id;
		const upload = await anil.imports.apply(file(other, "tb.csv", tradebook([trade("T9", "2024-07-15", 10, 290)])));
		expect((await anil.dividends.list({ accountId: other })).toConfirm).toEqual({ count: 1, total: "50.00" });
		await anil.imports.undo({ batchId: upload.batchId });
		expect((await anil.dividends.list({ accountId: other })).dividends).toEqual([]);
	});

	it("takes one the exchange's feed did not carry", async () => {
		const { id } = await anil.dividends.record({ accountId: account, instrumentId: alphax, amount: "400.50", receivedOn: "2024-10-10" });
		expect((await anil.money.returns(here())).moved.dividends).toBe("400.50");
		expect((await anil.dividends.list({ accountId: account })).dividends[0]).toMatchObject({ source: "person", state: "confirmed" });
		// Taking it back removes it.
		await anil.dividends.reopen({ dividendId: id });
		expect((await anil.money.returns(here())).moved.dividends).toBe("0.00");
		const never = (await db.instruments.create({ kind: "equity", isin: "INE999Z01011", symbolCanonical: "NEVER", name: "NEVER", currency: "INR" })).id;
		await expect(
			anil.dividends.record({ accountId: account, instrumentId: never, amount: "1", receivedOn: "2024-10-10" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("can be seen by anyone who sees the account, and answered only by those who can edit it", async () => {
		await syncActions();
		const sunita = await signUp();
		const stranger = await signUp();
		await anil.access.grant({ target: { accountId: account }, email: sunita.email, level: "view" });

		const seen = await sunita.dividends.list({ accountId: account });
		expect(seen.canAnswer).toBe(false);
		expect(seen.dividends).toHaveLength(1);
		await expect(sunita.dividends.confirm({ accountId: account })).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(sunita.dividends.notReceived({ dividendId: seen.dividends[0]?.id as string })).rejects.toMatchObject({ code: "FORBIDDEN" });

		await expect(stranger.dividends.list({ accountId: account })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(stranger.dividends.reopen({ dividendId: seen.dividends[0]?.id as string })).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
