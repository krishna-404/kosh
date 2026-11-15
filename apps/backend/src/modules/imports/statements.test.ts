import { db } from "@backend/db/db";
import { activityRouter } from "@backend/modules/activity/activity.router";
import { importsRouter } from "@backend/modules/imports/imports.router";
import { ledgerRouter } from "@backend/modules/ledger/ledger.router";
import { accessRouter } from "@backend/modules/portfolio/access.router";
import { portfolioRouter } from "@backend/modules/portfolio/portfolio.router";
import { questionsRouter } from "@backend/modules/questions/questions.router";
import { defaultContext } from "@backend/test/setup";
import { createUserAndLogin } from "@backend/test/utils/user-auth.utils";
import { createRouterClient } from "@orpc/server";
import { zipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";

// Statements in, ledger out. These tests drive the real routers the way the
// account page does: drop a file, look at what it would do, put it in, answer
// what Kosh asks, undo.
//
// Fixtures are anonymized: the shape mirrors real Zerodha Console exports,
// the names and numbers are made up.

type Session = Awaited<ReturnType<typeof createUserAndLogin>>;
const as = (context: Session) => ({
	id: context.user.id,
	email: context.user.email as string,
	portfolio: createRouterClient(portfolioRouter, { context }),
	access: createRouterClient(accessRouter, { context }),
	imports: createRouterClient(importsRouter, { context }),
	questions: createRouterClient(questionsRouter, { context }),
	ledger: createRouterClient(ledgerRouter, { context }),
	activity: createRouterClient(activityRouter, { context }),
});
type Person = ReturnType<typeof as>;

async function signUp(): Promise<Person> {
	const session = await createUserAndLogin();
	await db.users.where({ id: session.user.id }).update({ emailVerified: true });
	return as(session);
}

const TRADEBOOK_HEADER =
	"symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time";
const TRADEBOOK = [
	TRADEBOOK_HEADER,
	"ALPHAX,INE001A01011,2025-09-04,NSE,EQ,EQ,buy,false,10.000000,100.000000,TB1,OB1,2025-09-04T10:00:00",
	"BETAX,INE002B01010,2025-09-04,BSE,EQ,A,buy,false,5.000000,200.000000,TB2,OB2,2025-09-04T11:00:00",
	// The broker left the ISIN blank (a fresh listing): Kosh will ask.
	"NEWLIST,,2025-09-08,BSE,EQ,B,buy,false,50.000000,10.000000,TB3,OB3,2025-09-08T12:00:00",
].join("\n");

const LEDGER_HEADER = "particulars,posting_date,cost_center,voucher_type,debit,credit,net_balance";
const ledgerFile = (opening: string, lines: string[], closing: string) =>
	[LEDGER_HEADER, `Opening Balance,,,,,,${opening}`, ...lines, `Closing Balance,,,,,,${closing}`].join("\n");

const SEPTEMBER = ledgerFile(
	"0.000000",
	[
		"Funds added using UPI ref1,2025-09-01,NSE-EQ - Z,Bank Receipts,0.000000,10000.000000,10000.000000",
		"Net settlement for Equity with settlement number: 2025100,2025-09-05,NSE-EQ - Z,Book Voucher,2001.500000,0.000000,7998.500000",
		"DP Charges for Sale of ALPHAX on 05/09/2025,2025-09-05,NSE-EQ - Z,Journal Entry,15.340000,0.000000,7983.160000",
		// Nothing Kosh recognises: it becomes a question.
		"Reversal of something unusual,2025-09-06,NSE-EQ - Z,Journal Entry,0.000000,1.000000,7984.160000",
	],
	"7984.160000",
);
const OCTOBER = ledgerFile(
	"7984.160000",
	[
		"Funds added using NEFT,2025-10-02,NSE-EQ - Z,Bank Receipts,0.000000,5000.000000,12984.160000",
		"\"Instant Payout of 4000.0/- to DEMO BANK LTD, 0000111122 A/C number as per withdrawal request made on 2025-10-20 with reference number abc\",2025-10-20,NSE-EQ - Z,Bank Payments,4000.000000,0.000000,8984.160000",
	],
	"8984.160000",
);

const HOLDINGS = [
	"Client ID,ZZ0000,,,",
	"Equity Holdings Statement as on 2025-10-31,,,,",
	"Symbol,ISIN,Sector,Quantity Available,Average Price",
	"ALPHAX,INE001A01011,IT,10,100.00",
	"BETAX,INE002B01010,FMCG,5,200.00",
].join("\n");

const file = (accountId: string, fileName: string, text: string) => ({
	accountId,
	fileName,
	contentBase64: Buffer.from(text).toString("base64"),
});

describe("Statements", () => {
	let anil: Person;
	let holderId: string;
	let zerodha: string;

	beforeEach(async () => {
		if (!defaultContext) throw new Error("defaultContext not initialized");
		await db.users.where({ id: defaultContext.user.id }).update({ emailVerified: true });
		anil = as(defaultContext);
		holderId = (await anil.portfolio.createPerson({ displayName: "Anil" })).id;
		zerodha = (
			await anil.portfolio.createAccount({ personId: holderId, broker: "zerodha", label: "Anil Zerodha" })
		).id;
	});

	const counts = async () => ({
		rawTrades: await db.rawTrades.where({ isLive: true }).count(),
		trades: await db.trades.where({ isLive: true }).count(),
		rawLines: await db.rawLedgerLines.where({ isLive: true }).count(),
		flows: await db.cashFlows.where({ isLive: true }).count(),
	});

	describe("an account at any other broker", () => {
		// Kosh's own layout: two plain tables anyone can fill in from their broker's statement.
		const TRADES = [
			"My Groww account — trades",
			"",
			"Date,Type,Symbol,ISIN,Quantity,Price",
			"02-04-2024,Buy,INFY,INE009A01021,10,\"1,480.50\"",
			"02-04-2024,Buy,INFY,INE009A01021,10,\"1,480.50\"",
			"17/09/2024,Sell,INFY,INE009A01021,4,1905",
			"5 Nov 2024,buy,SOMEFUND,,25.5,40",
		].join("\n");
		const CASH = [
			"date,description,money in,money out,balance,what",
			"2024-04-01,Transfer from my bank,50000,,50000.00,put in",
			"2024-04-03,Paid for shares bought on 2 April,,29640.00,20360.00,for trades",
			"2024-06-30,Account maintenance charge,,354.00,20006.00,charges",
			"2024-07-15,Something the statement did not explain,,6.00,20000.00,",
			"2024-09-20,Sent back to my bank,,10000,10000.00,taken out",
		].join("\n");
		let groww: string;
		beforeEach(async () => {
			groww = (await anil.portfolio.createAccount({ personId: holderId, broker: "groww", label: "Anil Groww" })).id;
		});

		it("takes trades in Kosh's own layout, on any account, through the same check-then-apply", async () => {
			const preview = await anil.imports.preview(file(groww, "trades.csv", TRADES));
			expect(preview.detected).toEqual({ broker: "template", kind: "tradebook" });
			expect(preview.summary).toEqual({ total: 4, new: 4, duplicate: 0, error: 0, questions: 1 }); // the fund has no ISIN
			expect(preview.span).toEqual({ from: "2024-04-02", to: "2024-11-05" });

			await anil.imports.apply(file(groww, "trades.csv", TRADES));
			// Two identical fills on one day are two trades; the one with no ISIN waits for an answer.
			expect(await db.trades.where({ accountId: groww, isLive: true }).count()).toBe(3);
			const questions = await anil.questions.list({ accountId: groww });
			expect(questions.map((q) => q.kind)).toEqual(["missing_isin"]);

			// The same table again — even saved as a different file — adds nothing.
			const again = await anil.imports.preview(file(groww, "trades copy.csv", `${TRADES}\n`));
			expect(again.summary).toMatchObject({ new: 0, duplicate: 4 });
			// It is not tied to a broker: the Zerodha account takes it too.
			expect((await anil.imports.preview(file(zerodha, "trades.csv", TRADES))).canApply).toBe(true);
		});

		it("takes the cash table, uses what each line is said to be, and asks about the rest", async () => {
			const preview = await anil.imports.preview(file(groww, "cash.csv", CASH));
			expect(preview.detected).toEqual({ broker: "template", kind: "ledger" });
			expect(preview.rows.map((r) => [r.amount, r.status])).toEqual([
				["50000.00", "new"],
				["-29640.00", "new"],
				["-354.00", "new"],
				["-6.00", "question"],
				["-10000.00", "new"],
			]);
			await anil.imports.apply(file(groww, "cash.csv", CASH));
			const flows = await db.cashFlows.where({ accountId: groww, isLive: true }).order({ flowDate: "ASC" }).select("classification", "amount");
			expect(flows.map((f) => [f.classification, f.amount])).toEqual([
				["external_deposit", "50000.00"],
				["trade_settlement", "-29640.00"],
				["charge", "-354.00"],
				["external_withdrawal", "-10000.00"],
			]);
			expect((await anil.questions.list({ accountId: groww })).map((q) => q.kind)).toEqual(["ledger_line"]);
			// Undo takes all of it back out, like any other upload.
			const [upload] = await anil.imports.list({ accountId: groww });
			await anil.imports.undo({ batchId: upload?.batchId as string });
			expect(await db.cashFlows.where({ accountId: groww, isLive: true }).count()).toBe(0);
		});

		it("hands out the layout as two example tables that it reads back itself", async () => {
			const { trades, cash } = await anil.imports.layouts();
			expect((await anil.imports.preview(file(groww, "layout-trades.csv", trades))).canApply).toBe(true);
			expect((await anil.imports.preview(file(groww, "layout-cash.csv", cash))).canApply).toBe(true);
		});

		it("refuses a table with a line it cannot read, saying which line and why", async () => {
			const broken = CASH.replace("2024-06-30,Account maintenance charge,,354.00,20006.00", "2024-06-30,Account maintenance charge,,354.00,19000.00");
			const preview = await anil.imports.preview(file(groww, "cash.csv", broken));
			expect(preview).toMatchObject({ canApply: false, problem: { code: "has_errors" } });
			expect(preview.problem?.message).toMatch(/fix the lines listed/);
			const bad = await anil.imports.preview(file(groww, "trades.csv", TRADES.replace("17/09/2024", "someday")));
			expect(bad.errors).toEqual([expect.objectContaining({ row: 3, message: expect.stringContaining("Can’t read the date") })]);
			expect(bad.canApply).toBe(false);
		});
	});

	describe("files that are not what a statement looks like", () => {
		const trades = (date: string) =>
			[TRADEBOOK_HEADER, `ALPHAX,INE001A01011,${date},NSE,EQ,EQ,buy,false,1,100,TX1,OX1,${date}T10:00:00`].join("\n");

		it("refuses a date centuries off, or one that has not come — nothing is worked out from then", async () => {
			const ancient = await anil.imports.preview(file(zerodha, "old.csv", trades("0100-01-01")));
			expect(ancient).toMatchObject({ canApply: false, problem: { code: "has_errors" } });
			expect(ancient.problem?.message).toMatch(/from 1990 onwards/);
			await expect(anil.imports.apply(file(zerodha, "old.csv", trades("0100-01-01")))).rejects.toThrow();

			const future = await anil.imports.preview(file(zerodha, "future.csv", trades("2999-01-01")));
			expect(future.problem?.message).toMatch(/hasn’t come yet/);
			expect(await db.instruments.where({ isin: "INE001A01011" }).count()).toBe(0);
		});

		it("refuses a file far larger than any statement, before reading it", async () => {
			const endless = await anil.imports.preview(file(zerodha, "huge.csv", `${TRADEBOOK_HEADER}\n${"\n".repeat(200_001)}`));
			expect(endless).toMatchObject({ canApply: false, problem: { code: "unreadable" } });
			expect(endless.problem?.message).toMatch(/far larger than any statement/);

			// A spreadsheet is a zip: one with thousands of entries is turned away from its directory alone.
			const entries: Record<string, Uint8Array> = {};
			for (let i = 0; i < 2100; i++) entries[`xl/worksheets/sheet${i}.xml`] = new Uint8Array(1);
			const packed = await anil.imports.preview({
				accountId: zerodha,
				fileName: "packed.xlsx",
				contentBase64: Buffer.from(zipSync(entries)).toString("base64"),
			});
			expect(packed.problem?.message).toMatch(/far larger than any statement/);
		});
	});

	describe("recognising a file", () => {
		it("works out what a file is without being told", async () => {
			const kinds = [];
			for (const [name, text] of [
				["tradebook.csv", TRADEBOOK],
				["ledger.csv", SEPTEMBER],
				["holdings.csv", HOLDINGS],
			] as const) {
				const preview = await anil.imports.preview(file(zerodha, name, text));
				kinds.push([preview.detected?.broker, preview.detected?.kind, preview.canApply]);
			}
			expect(kinds).toEqual([
				["zerodha", "tradebook", true],
				["zerodha", "ledger", true],
				["zerodha", "holdings", true],
			]);
		});

		it("says plainly why a file cannot go in", async () => {
			const groww = (
				await anil.portfolio.createAccount({ personId: holderId, broker: "groww", label: "Anil Groww" })
			).id;
			const problem = async (accountId: string, name: string, text: string) =>
				(await anil.imports.preview(file(accountId, name, text))).problem?.code;

			expect(await problem(zerodha, "notes.csv", "name,amount\nx,1")).toBe("unrecognised");
			expect(await problem(zerodha, "contract.pdf", "%PDF-1.7 …")).toBe("unreadable");
			expect(await problem(groww, "tradebook.csv", TRADEBOOK)).toBe("wrong_broker");
			expect(
				await problem(
					zerodha,
					"dividends.csv",
					"Symbol,ISIN,Ex-Date,Quantity,Dividend Per Share,Net Dividend Amount\nALPHAX,INE001A01011,2025-08-01,10,2,20",
				),
			).toBe("unsupported");
			// Nothing was written by looking.
			expect(await counts()).toEqual({ rawTrades: 0, trades: 0, rawLines: 0, flows: 0 });
			await expect(anil.imports.apply(file(groww, "tradebook.csv", TRADEBOOK))).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		});

		it("refuses a ledger whose balances do not add up — all of it", async () => {
			const broken = SEPTEMBER.replace("7983.160000", "7000.000000");
			const preview = await anil.imports.preview(file(zerodha, "ledger.csv", broken));
			expect(preview).toMatchObject({ canApply: false, problem: { code: "has_errors" } });
			expect(preview.errors.length).toBeGreaterThan(0);
			await expect(anil.imports.apply(file(zerodha, "ledger.csv", broken))).rejects.toThrow();
			expect(await counts()).toEqual({ rawTrades: 0, trades: 0, rawLines: 0, flows: 0 });
		});
	});

	describe("putting a file in", () => {
		it("shows each line and what will happen to it, then does exactly that", async () => {
			const preview = await anil.imports.preview(file(zerodha, "ledger.csv", SEPTEMBER));
			expect(preview.summary).toEqual({ total: 4, new: 4, duplicate: 0, error: 0, questions: 1 });
			expect(preview.span).toEqual({ from: "2025-09-01", to: "2025-09-06" });
			expect(preview.rows.map((r) => [r.amount, r.status])).toEqual([
				["10000.00", "new"],
				["-2001.50", "new"],
				["-15.34", "new"],
				["1.00", "question"],
			]);

			const applied = await anil.imports.apply(file(zerodha, "ledger.csv", SEPTEMBER));
			expect(applied).toMatchObject({ added: 4, duplicates: 0, questions: 1 });
			expect(await counts()).toMatchObject({ rawLines: 4, flows: 3 });

			// The file itself is kept, byte for byte, with its batch.
			const stored = await db.importFiles.select("fileName", "sizeBytes", "content").take();
			expect(stored.fileName).toBe("ledger.csv");
			expect(Buffer.from(stored.content).toString("utf8")).toBe(SEPTEMBER);
		});

		it("adds nothing when the same file, or the same lines, come in again", async () => {
			await anil.imports.apply(file(zerodha, "ledger.csv", SEPTEMBER));
			const before = await counts();

			const again = await anil.imports.preview(file(zerodha, "ledger (1).csv", SEPTEMBER));
			expect(again).toMatchObject({
				canApply: false,
				problem: { code: "already_uploaded" },
				previous: { fileName: "ledger.csv" },
			});

			// A different file covering the same days: every line is recognised.
			const reExported = `${SEPTEMBER}\n`;
			const overlap = await anil.imports.preview(file(zerodha, "ledger-again.csv", reExported));
			expect(overlap.summary).toMatchObject({ new: 0, duplicate: 4 });
			expect(overlap.problem?.code).toBe("nothing_new");
			await expect(anil.imports.apply(file(zerodha, "ledger-again.csv", reExported))).rejects.toThrow();
			expect(await counts()).toEqual(before);
		});

		it("takes only the new lines from a file that overlaps an earlier one", async () => {
			await anil.imports.apply(file(zerodha, "sep.csv", SEPTEMBER));
			const both = ledgerFile(
				"0.000000",
				[...SEPTEMBER.split("\n").slice(2, -1), ...OCTOBER.split("\n").slice(2, -1)],
				"8984.160000",
			);
			const applied = await anil.imports.apply(file(zerodha, "sep-oct.csv", both));
			expect(applied).toMatchObject({ added: 2, duplicates: 4 });
			expect(await counts()).toMatchObject({ rawLines: 6 });
		});

		it("reads trades, and asks about the one with no ISIN", async () => {
			const applied = await anil.imports.apply(file(zerodha, "tradebook.csv", TRADEBOOK));
			expect(applied).toMatchObject({ added: 3, questions: 1 });
			expect(await counts()).toMatchObject({ rawTrades: 3, trades: 2 });

			const page = await anil.ledger.trades({ accountId: zerodha });
			expect(page.total).toBe(2);
			// Both were bought on the same day; their order within it is not fixed.
			expect(page.rows.map((t) => [t.symbol, t.side, t.value]).sort()).toEqual([
				["ALPHAX", "buy", "1000.00"],
				["BETAX", "buy", "1000.00"],
			]);

			const again = await anil.imports.preview(file(zerodha, "tradebook-copy.csv", `${TRADEBOOK}\n`));
			expect(again.summary).toMatchObject({ new: 0, duplicate: 3 });
		});

		it("keeps a holdings statement for its day, replacing an earlier one for that day", async () => {
			await anil.imports.apply(file(zerodha, "holdings.csv", HOLDINGS));
			await anil.imports.apply(
				file(zerodha, "holdings-fixed.csv", HOLDINGS.replace("ALPHAX,INE001A01011,IT,10", "ALPHAX,INE001A01011,IT,12")),
			);
			const live = await db.rawHoldingsSnapshots
				.where({ accountId: zerodha, isLive: true })
				.order({ brokerSymbol: "ASC" })
				.select("brokerSymbol", "quantity", "asOf");
			expect(live.map((h) => [h.brokerSymbol, Number(h.quantity), h.asOf])).toEqual([
				["ALPHAX", 12, "2025-10-31"],
				["BETAX", 5, "2025-10-31"],
			]);

			const undated = HOLDINGS.replace("Equity Holdings Statement as on 2025-10-31", "Equity Holdings");
			expect((await anil.imports.preview(file(zerodha, "h.csv", undated))).problem?.code).toBe("needs_date");
			expect(
				(await anil.imports.preview({ ...file(zerodha, "h.csv", undated), asOf: "2025-11-30" })).canApply,
			).toBe(true);
		});
	});

	describe("undoing an upload", () => {
		it("takes everything it produced back out, and lets the file go in again", async () => {
			const applied = await anil.imports.apply(file(zerodha, "ledger.csv", SEPTEMBER));
			await anil.imports.undo({ batchId: applied.batchId });

			expect(await counts()).toEqual({ rawTrades: 0, trades: 0, rawLines: 0, flows: 0 });
			// Nothing was deleted: the rows are still there, marked not live.
			expect(await db.rawLedgerLines.count()).toBe(4);
			const [upload] = await anil.imports.list({ accountId: zerodha });
			expect(upload).toMatchObject({ status: "retracted", canUndo: false });

			const again = await anil.imports.apply(file(zerodha, "ledger.csv", SEPTEMBER));
			expect(again.added).toBe(4);
			expect(await counts()).toMatchObject({ rawLines: 4, flows: 3 });
		});

		it("is for owners, and for editors only on their own uploads", async () => {
			const ramesh = await signUp();
			const priya = await signUp();
			await anil.access.grant({ target: { accountId: zerodha }, email: ramesh.email, level: "edit" });
			await anil.access.grant({ target: { accountId: zerodha }, email: priya.email, level: "view" });

			const anils = await anil.imports.apply(file(zerodha, "sep.csv", SEPTEMBER));
			const rameshs = await ramesh.imports.apply(file(zerodha, "tradebook.csv", TRADEBOOK));

			await expect(ramesh.imports.undo({ batchId: anils.batchId })).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(priya.imports.undo({ batchId: rameshs.batchId })).rejects.toMatchObject({ code: "FORBIDDEN" });
			const seenByRamesh = await ramesh.imports.list({ accountId: zerodha });
			expect(seenByRamesh.map((u) => [u.fileName, u.canUndo, u.undoBlocked !== null])).toEqual([
				["tradebook.csv", true, false],
				["sep.csv", false, true],
			]);
			expect((await priya.imports.list({ accountId: zerodha })).every((u) => !u.canUndo)).toBe(true);

			await ramesh.imports.undo({ batchId: rameshs.batchId });
			await anil.imports.undo({ batchId: anils.batchId });
			expect(await counts()).toEqual({ rawTrades: 0, trades: 0, rawLines: 0, flows: 0 });
		});
	});

	describe("questions", () => {
		beforeEach(async () => {
			await anil.imports.apply(file(zerodha, "sep.csv", SEPTEMBER));
			await anil.imports.apply(file(zerodha, "tradebook.csv", TRADEBOOK));
		});

		it("are what Kosh could not work out, and go away when answered", async () => {
			const asked = await anil.questions.list({ accountId: zerodha });
			expect(asked.map((q) => q.kind).sort()).toEqual(["ledger_line", "missing_isin"]);
			expect((await anil.portfolio.directory()).accounts[0]?.questionsWaiting).toBe(2);

			const line = asked.find((q) => q.kind === "ledger_line");
			if (line?.kind !== "ledger_line") throw new Error("expected a ledger line question");
			expect(line).toMatchObject({ narration: "Reversal of something unusual", amount: "1.00", canAnswer: true });
			// ₹1 came in, so it cannot be money taken out.
			await expect(
				anil.questions.answerLedgerLine({ lineId: line.lineId, answer: "external_withdrawal" }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await anil.questions.answerLedgerLine({ lineId: line.lineId, answer: "interest" });

			const trade = asked.find((q) => q.kind === "missing_isin");
			if (trade?.kind !== "missing_isin") throw new Error("expected a missing-ISIN question");
			await expect(
				anil.questions.giveIsin({ rawTradeId: trade.rawTradeId, isin: "not-an-isin" }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await anil.questions.giveIsin({ rawTradeId: trade.rawTradeId, isin: "ine003c01019" });

			expect(await anil.questions.list({ accountId: zerodha })).toEqual([]);
			expect(await counts()).toMatchObject({ trades: 3, flows: 4 });
			expect((await anil.portfolio.directory()).accounts[0]?.questionsWaiting).toBe(0);
		});

		it("can be seen by a viewer, answered only by someone who can edit", async () => {
			const priya = await signUp();
			await anil.access.grant({ target: { accountId: zerodha }, email: priya.email, level: "view" });

			const [line] = (await priya.questions.list({ accountId: zerodha })).filter((q) => q.kind === "ledger_line");
			if (line?.kind !== "ledger_line") throw new Error("expected a ledger line question");
			expect(line.canAnswer).toBe(false);
			await expect(
				priya.questions.answerLedgerLine({ lineId: line.lineId, answer: "interest" }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			// A count of questions is for people who could answer them.
			expect((await priya.portfolio.directory()).accounts[0]?.questionsWaiting).toBe(0);

			const stranger = await signUp();
			expect(await stranger.questions.list({})).toEqual([]);
			await expect(stranger.questions.list({ accountId: zerodha })).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				stranger.questions.answerLedgerLine({ lineId: line.lineId, answer: "interest" }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("come back when an answer is taken back, and an answer can be changed", async () => {
			const [line] = (await anil.questions.list({ accountId: zerodha })).filter((q) => q.kind === "ledger_line");
			if (line?.kind !== "ledger_line") throw new Error("expected a ledger line question");
			const { cashFlowId } = await anil.questions.answerLedgerLine({ lineId: line.lineId, answer: "interest" });

			const changed = await anil.questions.changeLedgerLine({ cashFlowId, answer: "external_deposit" });
			const flows = await anil.ledger.cashFlows({ accountId: zerodha, show: "external" });
			expect(flows.rows.map((r) => [r.amount, r.classification, r.source])).toEqual([
				["1.00", "external_deposit", "answer"],
				["10000.00", "external_deposit", "rule"],
			]);
			expect(flows.totals).toEqual({ in: "10001.00", out: "0.00" });

			await anil.questions.changeLedgerLine({ cashFlowId: changed.cashFlowId as string });
			expect((await anil.questions.list({ accountId: zerodha })).some((q) => q.kind === "ledger_line")).toBe(true);
			expect((await anil.ledger.cashFlows({ accountId: zerodha })).totals.in).toBe("10000.00");
		});

		it("are undone with the upload they were about", async () => {
			const [line] = (await anil.questions.list({ accountId: zerodha })).filter((q) => q.kind === "ledger_line");
			if (line?.kind !== "ledger_line") throw new Error("expected a ledger line question");
			await anil.questions.answerLedgerLine({ lineId: line.lineId, answer: "interest" });

			const uploads = await anil.imports.list({ accountId: zerodha });
			const sep = uploads.find((u) => u.fileName === "sep.csv");
			await anil.imports.undo({ batchId: sep?.batchId as string });
			expect(await counts()).toMatchObject({ rawLines: 0, flows: 0 });
		});
	});

	describe("how complete the history is", () => {
		it("is complete when the ledger starts from nothing and nothing is missing", async () => {
			await anil.imports.apply(file(zerodha, "sep.csv", SEPTEMBER));
			await anil.imports.apply(file(zerodha, "tradebook.csv", TRADEBOOK));
			await anil.imports.apply(file(zerodha, "oct.csv", OCTOBER));

			const history = await anil.imports.history({ accountId: zerodha });
			expect(history.ledger).toMatchObject({
				from: "2025-09-01",
				to: "2025-10-20",
				lines: 6,
				openingBalance: "0.00",
				openingExplained: true,
				gaps: [],
			});
			expect(history.trades).toMatchObject({ count: 3, missingMonths: [] });
			expect(history.complete).toBe(true);
		});

		it("notices a missing stretch, a missing tradebook and an unexplained start", async () => {
			// October only: it opens with ₹7,984.16 already in the account.
			await anil.imports.apply(file(zerodha, "oct.csv", OCTOBER));
			let history = await anil.imports.history({ accountId: zerodha });
			expect(history.ledger).toMatchObject({ openingBalance: "7984.16", openingExplained: false });
			expect(history.complete).toBe(false);

			const [opening] = (await anil.questions.list({ accountId: zerodha })).filter(
				(q) => q.kind === "opening_balance",
			);
			expect(opening).toMatchObject({ amount: "7984.16", date: "2025-10-02" });
			await anil.questions.explainOpening({ accountId: zerodha });
			history = await anil.imports.history({ accountId: zerodha });
			expect(history.ledger?.openingExplained).toBe(true);
			const flows = await anil.ledger.cashFlows({ accountId: zerodha });
			expect(flows.rows.find((r) => r.source === "opening_balance")).toMatchObject({
				amount: "7984.16",
				date: "2025-10-02",
				classification: "external_deposit",
			});

			// A ledger with a hole: the balance jumps between two lines.
			const other = (
				await anil.portfolio.createAccount({ personId: holderId, broker: "zerodha", label: "Anil Second" })
			).id;
			const holed = ledgerFile(
				"0.000000",
				[
					"Funds added using UPI ref9,2025-04-01,NSE-EQ - Z,Bank Receipts,0.000000,1000.000000,1000.000000",
					"Net settlement for Equity with settlement number: 77,2025-04-10,NSE-EQ - Z,Book Voucher,400.000000,0.000000,600.000000",
				],
				"600.000000",
			);
			const later = ledgerFile(
				"900.000000",
				["Funds added using UPI ref10,2025-08-01,NSE-EQ - Z,Bank Receipts,0.000000,100.000000,1000.000000"],
				"1000.000000",
			);
			await anil.imports.apply(file(other, "apr.csv", holed));
			await anil.imports.apply(file(other, "aug.csv", later));
			const second = await anil.imports.history({ accountId: other });
			expect(second.ledger?.gaps).toEqual([{ after: "2025-04-10", before: "2025-08-01", missing: "300.00" }]);
			// Trades settled in April, but no tradebook covers it.
			expect(second.trades?.missingMonths).toEqual(["2025-04"]);
			expect(second.complete).toBe(false);
		});
	});

	describe("the same money in two accounts", () => {
		it("is suggested as a transfer, and paired or refused by someone who can edit both", async () => {
			const sunita = await signUp();
			const hers = (await sunita.portfolio.createPerson({ displayName: "Sunita" })).id;
			const sunitaZerodha = (
				await sunita.portfolio.createAccount({ personId: hers, broker: "zerodha", label: "Sunita Zerodha" })
			).id;
			await sunita.access.grant({ target: { accountId: sunitaZerodha }, email: anil.email, level: "edit" });

			await anil.imports.apply(file(zerodha, "sep.csv", SEPTEMBER));
			await anil.imports.apply(file(zerodha, "oct.csv", OCTOBER));
			// ₹4,000 leaves Anil's account on the 20th and arrives in Sunita's on the 21st.
			await sunita.imports.apply(
				file(
					sunitaZerodha,
					"sunita.csv",
					ledgerFile(
						"0.000000",
						["Funds added using NEFT,2025-10-21,NSE-EQ - Z,Bank Receipts,0.000000,4000.000000,4000.000000"],
						"4000.000000",
					),
				),
			);

			const [suggested] = (await anil.questions.list({})).filter((q) => q.kind === "transfer");
			if (suggested?.kind !== "transfer") throw new Error("expected a transfer suggestion");
			expect(suggested).toMatchObject({
				canAnswer: true,
				out: { account: { id: zerodha }, amount: "-4000.00", date: "2025-10-20" },
				in: { account: { id: sunitaZerodha }, amount: "4000.00", date: "2025-10-21" },
			});
			// Sunita sees only her own account, so there is no pair for her to be asked about.
			expect((await sunita.questions.list({})).filter((q) => q.kind === "transfer")).toEqual([]);
			await expect(
				sunita.questions.transfer({ outFlowId: suggested.out.flowId, inFlowId: suggested.in.flowId, same: true }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			const { linkId } = await anil.questions.transfer({
				outFlowId: suggested.out.flowId,
				inFlowId: suggested.in.flowId,
				same: true,
			});
			expect((await anil.questions.list({})).filter((q) => q.kind === "transfer")).toEqual([]);

			// Each side shows the pairing; the other account is named only to someone who can see it.
			const anilsRow = (await anil.ledger.cashFlows({ accountId: zerodha })).rows.find((r) => r.amount === "-4000.00");
			expect(anilsRow?.transfer).toEqual({ linkId, otherAccount: { id: sunitaZerodha, label: "Sunita Zerodha" } });
			const sunitasRow = (await sunita.ledger.cashFlows({ accountId: sunitaZerodha })).rows[0];
			expect(sunitasRow?.transfer).toEqual({ linkId, otherAccount: null });

			// Sunita can edit her own side only. Changing her line would undo a pairing that
			// also belongs to Anil's account — which she cannot edit — so it is refused.
			await expect(
				sunita.questions.changeLedgerLine({ cashFlowId: suggested.in.flowId, answer: "external_deposit" }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			expect((await anil.ledger.cashFlows({ accountId: zerodha })).rows.find((r) => r.amount === "-4000.00")?.transfer?.linkId).toBe(linkId);

			// Taken back, the question returns; refused, it stays away.
			await anil.questions.undoTransfer({ linkId });
			expect((await anil.questions.list({})).filter((q) => q.kind === "transfer")).toHaveLength(1);
			await anil.questions.transfer({ outFlowId: suggested.out.flowId, inFlowId: suggested.in.flowId, same: false });
			expect((await anil.questions.list({})).filter((q) => q.kind === "transfer")).toEqual([]);
		});
	});

	describe("the activity record", () => {
		it("shows uploads, undos and answers to anyone who can see the account", async () => {
			const priya = await signUp();
			await anil.access.grant({ target: { accountId: zerodha }, email: priya.email, level: "view" });

			const applied = await anil.imports.apply(file(zerodha, "sep.csv", SEPTEMBER));
			const [line] = (await anil.questions.list({ accountId: zerodha })).filter((q) => q.kind === "ledger_line");
			if (line?.kind !== "ledger_line") throw new Error("expected a ledger line question");
			await anil.questions.answerLedgerLine({ lineId: line.lineId, answer: "interest" });
			await anil.imports.undo({ batchId: applied.batchId });

			const seen = await priya.activity.list({ filter: "uploads" });
			expect(seen.items.map((i) => [i.kind, i.detail, i.actor?.isMe])).toEqual([
				["undo", "sep.csv", false],
				["upload", "sep.csv — 4 lines — 1 question raised", false],
			]);
			const answers = await priya.activity.list({ filter: "answers" });
			expect(answers.items.map((i) => [i.kind, i.detail])).toEqual([
				["answer", "said a ledger line was interest"],
			]);
			// The directory says who last brought the account up to date — nobody, once undone.
			expect((await anil.portfolio.directory()).accounts[0]?.updated).toBeNull();
		});
	});
});
