import { db } from "@backend/db/db";
import {
	readAnnouncement,
	settleActions,
	syncCorporateActions,
} from "@backend/modules/corporate-actions/services/corporate_actions.service";
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

// Splits and bonuses.
//
//   2 Jan 2024  Anil buys 100 ALPHAX at ₹500
//   3 Jun 2024  ALPHAX goes ex-bonus 1:1 — one share becomes two, the price halves
//   1 Jul 2024  he buys 50 more at ₹290 (these are already post-bonus shares)
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

describe("Splits and bonuses", () => {
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
		return { found, applied: await settleActions() };
	};
	const holding = async (who: Person = anil, accountId: string = account) =>
		(await who.money.holdings({ scope: { kind: "account", id: accountId } })).holdings[0];

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

	it("reads an announcement only as far as it is sure", () => {
		const read = (subject: string, exDate = "03-Jun-2024") => readAnnouncement({ subject, exDate });
		expect(read(" Bonus 1:1")).toEqual([
			expect.objectContaining({ actionType: "bonus", exDate: "2024-06-03", quantityFactor: 2, confidence: "high" }),
		]);
		expect(read("Face Value Split (Sub-Division) - From Rs 10/- Per Share To Re 1/- Per Share")).toEqual([
			expect.objectContaining({ actionType: "split", quantityFactor: 10, confidence: "high" }),
		]);
		expect(read("Bonus 3:2")[0]).toMatchObject({ quantityFactor: 2.5 });
		expect(read("Dividend - Rs 5 Per Share")[0]).toMatchObject({
			actionType: "dividend",
			quantityFactor: null,
			amountPerShare: "5",
			confidence: "high",
		});
		expect(read("Bonus issue as approved by the Board")[0]).toMatchObject({ quantityFactor: null, confidence: "low" });
		expect(read("Annual General Meeting")).toEqual([]);
		expect(read("Bonus 1:1", "soon")).toEqual([]);
	});

	it("reads both halves of a combined announcement — a bonus is never applied without its split", () => {
		// The trap that broke earlier tools: a bonus and a split on one record date.
		const both = readAnnouncement({
			subject: "Bonus 1:1 And Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share",
			exDate: "13-Jun-2017",
		});
		expect(both.map((a) => [a.actionType, a.quantityFactor, a.confidence])).toEqual([
			["bonus", 2, "high"],
			["split", 5, "high"],
		]);
		expect(readAnnouncement({ subject: "Annual General Meeting/Dividend - Rs 2.50 Per Share", exDate: "01-Aug-2024" })).toEqual([
			expect.objectContaining({ actionType: "dividend", amountPerShare: "2.50" }),
		]);
	});

	it("without the bonus, the holding reads as half of what it is", async () => {
		expect(await holding()).toMatchObject({ quantity: "150", value: "45000.00" });
	});

	it("applies a bonus Kosh is sure of to the shares held on the ex-date — and only those", async () => {
		expect(await syncActions()).toEqual({ found: 2, applied: 1 }); // the bonus and the dividend; the AGM is nothing
		// 100 became 200; the 50 bought in July were bought after the bonus.
		expect(await holding()).toMatchObject({ quantity: "250", value: "75000.00" });

		const [applied] = await anil.questions.corporateActions({ accountId: account });
		expect(applied).toMatchObject({
			symbol: "ALPHAX",
			announcement: "Bonus 1:1",
			exDate: "2024-06-03",
			state: "applied",
			quantityBefore: "100",
			quantityAfter: "200",
			by: "kosh",
			source: "exchange",
			canUndo: true,
		});
		expect(await anil.questions.list({ accountId: account })).toEqual([]);

		// Fetching and settling again changes nothing.
		expect(await syncActions()).toEqual({ found: 0, applied: 0 });
		expect((await holding())?.quantity).toBe("250");
	});

	it("does not touch an account that only bought afterwards", async () => {
		const later = (await anil.portfolio.createAccount({ personId: holder, broker: "manual", label: "Anil · Other" })).id;
		await anil.imports.apply(file(later, "tb.csv", tradebook([trade("T9", "2024-07-01", 50, 290)])));
		await syncActions();
		expect(await anil.questions.corporateActions({ accountId: later })).toEqual([]);
		expect((await holding(anil, later))?.quantity).toBe("50");
	});

	it("applies what is already known as soon as an upload brings the shares in", async () => {
		await syncActions();
		const second = (await anil.portfolio.createAccount({ personId: holder, broker: "manual", label: "Anil · Second" })).id;
		await anil.imports.apply(file(second, "tb.csv", tradebook([trade("T8", "2024-02-01", 10, 510)])));
		expect((await holding(anil, second))?.quantity).toBe("20");
	});

	it("can be undone, and is then asked about instead of being applied again", async () => {
		await syncActions();
		const [applied] = await anil.questions.corporateActions({ accountId: account });
		await anil.questions.undoCorporateAction({ applicationId: applied?.applicationId as string });
		expect((await holding())?.quantity).toBe("150");

		// The sync does not quietly put it back.
		await syncActions();
		expect((await holding())?.quantity).toBe("150");
		const [question] = await anil.questions.list({ accountId: account });
		expect(question).toMatchObject({
			kind: "corporate_action",
			why: "undone",
			announcement: "Bonus 1:1",
			quantityBefore: "100",
			quantityAfter: "200",
			canAnswer: true,
		});
		if (question?.kind !== "corporate_action") throw new Error("expected a corporate action question");

		await anil.questions.declineCorporateAction({ accountId: account, actionId: question.actionId });
		expect(await anil.questions.list({ accountId: account })).toEqual([]);
		expect((await anil.questions.corporateActions({ accountId: account }))[0]).toMatchObject({ state: "declined", by: "person" });

		// And "not for this account" can itself be taken back, and the bonus applied after all.
		const [declined] = await anil.questions.corporateActions({ accountId: account });
		await anil.questions.undoCorporateAction({ applicationId: declined?.applicationId as string });
		await anil.questions.applyCorporateAction({ accountId: account, actionId: question.actionId });
		expect((await holding())?.quantity).toBe("250");
	});

	it("asks when the announcement cannot be read with certainty, and takes the ratio from the answer", async () => {
		announcements = [{ subject: "Bonus issue as approved by the Board", exDate: "03-Jun-2024" }];
		expect(await syncActions()).toEqual({ found: 1, applied: 0 });
		const [question] = await anil.questions.list({ accountId: account });
		expect(question).toMatchObject({ kind: "corporate_action", why: "unclear", quantityBefore: "100", quantityAfter: null });
		if (question?.kind !== "corporate_action") throw new Error("expected a corporate action question");
		expect((await anil.portfolio.directory()).accounts[0]?.questionsWaiting).toBe(1);

		await expect(
			anil.questions.applyCorporateAction({ accountId: account, actionId: question.actionId }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await anil.questions.applyCorporateAction({ accountId: account, actionId: question.actionId, oneBecomes: 1.5 });
		expect((await holding())?.quantity).toBe("200"); // 100 × 1.5, plus the 50
	});

	it("lets a viewer see the question, and only someone who can edit answer it", async () => {
		announcements = [{ subject: "Bonus issue as approved by the Board", exDate: "03-Jun-2024" }];
		await syncActions();
		const priya = await signUp();
		await anil.access.grant({ target: { accountId: account }, email: priya.email, level: "view" });
		const [question] = await priya.questions.list({ accountId: account });
		if (question?.kind !== "corporate_action") throw new Error("expected a corporate action question");
		expect(question.canAnswer).toBe(false);
		const answer = { accountId: account, actionId: question.actionId, oneBecomes: 2 };
		await expect(priya.questions.applyCorporateAction(answer)).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(priya.questions.declineCorporateAction(answer)).rejects.toMatchObject({ code: "FORBIDDEN" });

		const stranger = await signUp();
		await expect(stranger.questions.applyCorporateAction(answer)).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(stranger.questions.corporateActions({ accountId: account })).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("counts two actions on the same share one after the other", async () => {
		announcements = [
			{ subject: "Bonus 1:1", exDate: "03-Jun-2024" },
			{ subject: "Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 5/- Per Share", exDate: "02-Dec-2024" },
		];
		expect(await syncActions()).toEqual({ found: 2, applied: 2 });
		const applied = await anil.questions.corporateActions({ accountId: account });
		expect(applied.map((a) => [a.exDate, a.quantityBefore, a.quantityAfter])).toEqual([
			["2024-12-02", "250", "500"],
			["2024-06-03", "100", "200"],
		]);
		expect((await holding())?.quantity).toBe("500");

		// And two announced together, on one day, are both applied.
		announcements = [
			{ subject: "Bonus 1:1 And Face Value Split (Sub-Division) - From Rs 10/- Per Share To Rs 2/- Per Share", exDate: "01-Feb-2024" },
		];
		const second = (await anil.portfolio.createAccount({ personId: holder, broker: "manual", label: "Anil · Third" })).id;
		await anil.imports.apply(file(second, "tb.csv", tradebook([trade("T4", "2024-01-02", 10, 500)])));
		await syncActions();
		// 10 bought → ×2 ×5 on 1 Feb → then the two bonuses already known for this share.
		expect((await holding(anil, second))?.quantity).toBe("400");
		const secondApplied = await anil.questions.corporateActions({ accountId: second });
		expect(secondApplied.filter((a) => a.exDate === "2024-02-01").map((a) => a.actionType).sort()).toEqual(["bonus", "split"]);
	});

	it("catches what the feed missed, from the broker's own holdings statement", async () => {
		announcements = [];
		await syncActions();
		const HOLDINGS = [
			"Equity Holdings Statement as on 2024-12-31,,,,",
			"Symbol,ISIN,Sector,Quantity Available,Average Price",
			`ALPHAX,${ALPHAX},IT,250,300.00`,
			"GHOSTX,INE009Z01019,IT,10,50.00",
		].join("\n");
		await anil.imports.apply(file(account, "holdings.csv", HOLDINGS));

		const mismatches = (await anil.questions.list({ accountId: account })).filter((q) => q.kind === "holding_mismatch");
		expect(mismatches).toEqual([
			expect.objectContaining({ symbol: "ALPHAX", expected: "150", reported: "250", likelyFactor: null, instrumentId: alphax }),
			expect.objectContaining({ symbol: "GHOSTX", expected: "0", reported: "10", instrumentId: null }),
		]);

		// Anil knows why: a 1:1 bonus in June. He records it for this account.
		await anil.questions.recordCorporateAction({
			accountId: account,
			instrumentId: alphax,
			exDate: "2024-06-03",
			oneBecomes: 2,
			note: "Bonus 1:1, from the contract note",
		});
		expect((await holding())?.quantity).toBe("250");
		expect((await anil.questions.corporateActions({ accountId: account }))[0]).toMatchObject({
			announcement: "Bonus 1:1, from the contract note",
			source: "person",
			by: "person",
		});
		const left = (await anil.questions.list({ accountId: account })).filter((q) => q.kind === "holding_mismatch");
		expect(left.map((q) => q.kind === "holding_mismatch" && q.symbol)).toEqual(["GHOSTX"]);
		await anil.questions.dismissHoldingMismatch({ accountId: account, symbol: "GHOSTX", asOf: "2024-12-31" });
		expect(await anil.questions.list({ accountId: account })).toEqual([]);

		// What one family recorded says nothing about another family's holding of the same share.
		const other = await signUp();
		const theirs = (await other.portfolio.createPerson({ displayName: "Deepak" })).id;
		const theirAccount = (
			await other.portfolio.createAccount({ personId: theirs, broker: "zerodha", label: "Deepak · Zerodha" })
		).id;
		await other.imports.apply(file(theirAccount, "tb.csv", tradebook([trade("T5", "2024-01-02", 10, 500)])));
		await settleActions();
		expect((await holding(other, theirAccount))?.quantity).toBe("10");
		expect(await other.questions.list({ accountId: theirAccount })).toEqual([]);
	});

	it("suggests a split or bonus when the statement shows a clean multiple", async () => {
		announcements = [];
		await syncActions();
		const later = (await anil.portfolio.createAccount({ personId: holder, broker: "zerodha", label: "Anil · Old" })).id;
		await anil.imports.apply(file(later, "tb.csv", tradebook([trade("T6", "2024-01-02", 100, 500)])));
		await anil.imports.apply(
			file(
				later,
				"h.csv",
				["Equity Holdings Statement as on 2024-12-31,,,,", "Symbol,ISIN,Sector,Quantity Available,Average Price", `ALPHAX,${ALPHAX},IT,200,250`].join("\n"),
			),
		);
		const [mismatch] = await anil.questions.list({ accountId: later });
		expect(mismatch).toMatchObject({ kind: "holding_mismatch", expected: "100", reported: "200", likelyFactor: 2 });
	});
});
