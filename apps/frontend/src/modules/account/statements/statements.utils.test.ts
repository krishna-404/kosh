import { formatDate, formatDay } from "@connected-repo/ui-mui/format/date";
import {
	type AppliedAction,
	type History,
	LINE_ANSWERS,
	type Question,
	type StatementPreview,
	type Upload,
} from "@connected-repo/zod-schemas/kosh/statements.zod";
import {
	HISTORY,
	LINE_ANSWER_AS,
	LINE_ANSWER_EFFECT,
	LINE_ANSWER_LABEL,
	QUESTIONS,
	SPLITS,
	UPLOAD,
	UPLOADS,
} from "@frontend/copy/statements.copy";
import { describe, expect, it } from "vitest";
import {
	actionBy,
	actionLine,
	answersFor,
	brokerLabelOf,
	bytesToBase64,
	canUploadTo,
	cleanIsin,
	fileProblem,
	fileToBase64,
	formatQuantity,
	historyChecklist,
	historyIsEmpty,
	isIsin,
	isUsableDay,
	ledgerMoney,
	lineSide,
	listWords,
	MAX_FILE_BYTES,
	orderQuestions,
	parseRatio,
	previewFacts,
	previewHeadline,
	problemWords,
	quantityAfter,
	quantityChange,
	questionTitle,
	ratioMark,
	spanWords,
	timesWords,
	todayIso,
	tradeWords,
	uploadLine,
} from "./statements.utils";

const account = { id: "a1", label: "Anil · Zerodha" };

const QUESTION: { [K in Question["kind"]]: Extract<Question, { kind: K }> } = {
	ledger_line: {
		kind: "ledger_line",
		id: "line:1",
		account,
		canAnswer: true,
		lineId: "1",
		date: "2026-10-12",
		narration: "JV TRF 88213",
		amount: "-25000.00",
	},
	opening_balance: {
		kind: "opening_balance",
		id: "opening:a1",
		account,
		canAnswer: true,
		date: "2024-04-01",
		amount: "50000.00",
	},
	missing_isin: {
		kind: "missing_isin",
		id: "isin:1",
		account,
		canAnswer: true,
		rawTradeId: "t1",
		date: "2026-10-12",
		symbol: "SAHYADRI",
		side: "buy",
		quantity: "1200.000000",
		price: "250.500000",
	},
	transfer: {
		kind: "transfer",
		id: "transfer:1:2",
		account,
		canAnswer: true,
		out: { flowId: "1", account: { id: "a2", label: "Sunita · Zerodha" }, date: "2024-01-05", amount: "-200000.00" },
		in: { flowId: "2", account, date: "2024-01-08", amount: "200000.00" },
	},
	corporate_action: {
		kind: "corporate_action",
		id: "action:1:a1",
		account,
		canAnswer: true,
		actionId: "1",
		symbol: "SAHYADRI",
		actionType: "bonus",
		announcement: "Bonus 1:1",
		exDate: "2026-10-30",
		quantityBefore: "600",
		quantityAfter: "1200",
		why: "unclear",
	},
	holding_mismatch: {
		kind: "holding_mismatch",
		id: "mismatch:a1:KONKAN:2026-03-31",
		account,
		canAnswer: true,
		instrumentId: "i1",
		symbol: "KONKAN",
		asOf: "2026-03-31",
		expected: "120",
		reported: "240",
		likelyFactor: 2,
	},
};

const PREVIEW: StatementPreview = {
	fileName: "Tradebook Oct 2026.csv",
	detected: { broker: "zerodha", kind: "tradebook" },
	canApply: true,
	problem: null,
	summary: { total: 214, new: 200, duplicate: 14, error: 0, questions: 3 },
	span: { from: "2026-10-01", to: "2026-10-30" },
	errors: [],
	rows: [],
	moreRows: 0,
	previous: null,
};

const HISTORY_FULL: History = {
	ledger: { from: "2023-04-03", to: "2026-04-15", lines: 17, openingBalance: "0.00", openingExplained: true, gaps: [] },
	trades: { from: "2023-04-05", to: "2025-08-12", count: 10, missingMonths: [] },
	holdings: null,
	complete: true,
};

describe("reading a file to base64", () => {
	it("encodes bytes the way the server decodes them", () => {
		expect(bytesToBase64(new Uint8Array([]))).toBe("");
		expect(bytesToBase64(new TextEncoder().encode("symbol,isin\n"))).toBe("c3ltYm9sLGlzaW4K");
		// Bytes that are not text (a spreadsheet is a zip) survive untouched.
		const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80]);
		expect([...Buffer.from(bytesToBase64(bytes), "base64")]).toEqual([...bytes]);
	});

	it("handles a file bigger than one slice without overflowing the stack", () => {
		const big = new Uint8Array(200_000).map((_, i) => i % 251);
		const encoded = bytesToBase64(big);
		expect(encoded).toHaveLength(Math.ceil(big.length / 3) * 4);
		expect(Buffer.from(encoded, "base64").equals(Buffer.from(big))).toBe(true);
	});

	it("reads a picked file", async () => {
		const file = new Blob(["particulars,posting_date\nOpening Balance,\n"], { type: "text/csv" });
		expect(Buffer.from(await fileToBase64(file), "base64").toString("utf8")).toBe(
			"particulars,posting_date\nOpening Balance,\n",
		);
	});

	it("stops a file the server would refuse before it is sent", () => {
		expect(fileProblem({ size: 0 })).toBe("empty");
		expect(fileProblem({ size: 1 })).toBeNull();
		expect(fileProblem({ size: MAX_FILE_BYTES })).toBeNull();
		expect(fileProblem({ size: MAX_FILE_BYTES + 1 })).toBe("too_big");
		// 12 MB of file is exactly the 16,000,000 base64 characters the contract allows.
		expect(Math.ceil(MAX_FILE_BYTES / 3) * 4).toBe(16_000_000);
	});
});

describe("brokers", () => {
	it("takes uploads only where the server has a reader", () => {
		expect(canUploadTo("zerodha")).toBe(true);
		expect(canUploadTo("manual")).toBe(true);
		expect(canUploadTo("groww")).toBe(false);
		expect(canUploadTo("dhan")).toBe(false);
	});

	it("names a detected broker", () => {
		expect(brokerLabelOf("zerodha")).toBe("Zerodha");
		expect(brokerLabelOf("upstox")).toBe("Upstox");
	});
});

describe("amounts, quantities and dates", () => {
	it("writes a ledger amount without its sign, with paise only when there are some", () => {
		expect(ledgerMoney("-25000.00")).toBe("₹25,000");
		expect(ledgerMoney("23.60")).toBe("₹23.60");
		expect(ledgerMoney("200000.00")).toBe("₹2,00,000");
	});

	it("writes quantities the Indian way and drops empty decimals", () => {
		expect(formatQuantity("1200")).toBe("1,200");
		expect(formatQuantity("1200.000000")).toBe("1,200");
		expect(formatQuantity("12.500")).toBe("12.5");
		expect(formatQuantity(0.1 + 0.2)).toBe("0.3");
		expect(formatQuantity("125000")).toBe("1,25,000");
	});

	it("says what a split or bonus did to a holding", () => {
		expect(quantityChange("600", "1200")).toBe("600 became 1,200");
		expect(quantityAfter("600", 2)).toBe("1,200");
		expect(quantityAfter("75", 1.5)).toBe("112.5");
		expect(QUESTIONS.action.heldNow(formatQuantity("600"), formatQuantity("1200"))).toBe(
			"This account held 600, so it now holds 1,200.",
		);
	});

	it("takes only a ratio the server would", () => {
		expect(parseRatio("2")).toBe(2);
		expect(parseRatio(" 1.5 ")).toBe(1.5);
		for (const bad of ["", " ", "0", "-2", "abc", "1:1", "10001"]) expect(parseRatio(bad)).toBeNull();
	});

	it("reads the ratio out of the exchange's words", () => {
		expect(ratioMark("Bonus 1:1")).toBe("1:1");
		expect(ratioMark("Bonus issue 3 : 2")).toBe("3:2");
		expect(ratioMark("Face value split from Rs 10 to Rs 2")).toBeNull();
	});

	it("puts a multiple in words", () => {
		expect(timesWords(2)).toBe("twice");
		expect(timesWords(0.5)).toBe("half");
		expect(timesWords(5)).toBe("5 times");
		expect(timesWords(1.5)).toBe("1.5 times");
	});

	it("writes a stretch of days", () => {
		expect(spanWords({ from: "2026-10-01", to: "2026-10-30" })).toBe("1 Oct 2026 to 30 Oct 2026");
		expect(spanWords({ from: "2026-03-31", to: "2026-03-31" })).toBe("31 Mar 2026");
		expect(listWords([])).toBe("");
		expect(listWords(["Mar 2024"])).toBe("Mar 2024");
		expect(listWords(["a", "b", "c"])).toBe("a, b and c");
	});

	it("accepts a whole day that is not after the latest allowed", () => {
		expect(todayIso(new Date(2026, 10, 5))).toBe("2026-11-05");
		expect(isUsableDay("2026-03-31", "2026-03-31")).toBe(true);
		expect(isUsableDay("2026-04-01", "2026-03-31")).toBe(false);
		for (const bad of ["", "2026-3-1", "31/03/2026", "2026-13-40"]) expect(isUsableDay(bad, "2030-01-01")).toBe(false);
	});
});

describe("the answers to “what was this ledger line?”", () => {
	it("has plain words for every answer the contract allows", () => {
		expect(LINE_ANSWERS.map((answer) => LINE_ANSWER_LABEL[answer])).toEqual([
			"Money put in from the bank",
			"Money taken out to the bank",
			"Charges or fees",
			"Interest",
			"Payment for a trade",
			"Something else inside the account",
		]);
		for (const answer of LINE_ANSWERS) {
			expect(LINE_ANSWER_AS[answer]).toBe(LINE_ANSWER_LABEL[answer].toLowerCase());
			expect(LINE_ANSWER_EFFECT[answer]).toMatch(/^(Counted as|Stays inside)/);
		}
	});

	it("says which answers change the return and which do not", () => {
		for (const answer of ["external_deposit", "external_withdrawal"] as const)
			expect(LINE_ANSWER_EFFECT[answer]).toContain("the return is worked out again");
		for (const answer of ["charge", "interest", "trade_settlement", "other_internal"] as const)
			expect(LINE_ANSWER_EFFECT[answer]).toContain("not");
	});

	it("offers only the answers that can be true of the line", () => {
		expect(lineSide("-25000.00")).toBe("debit");
		expect(lineSide("23.60")).toBe("credit");
		expect(answersFor("-25000.00")).toEqual([
			"external_withdrawal",
			"charge",
			"interest",
			"trade_settlement",
			"other_internal",
		]);
		expect(answersFor("23.60")).not.toContain("external_withdrawal");
		expect(answersFor("23.60")).toContain("external_deposit");
	});

	it("says what was saved", () => {
		expect(QUESTIONS.ledgerLine.done("₹25,000", "12 Oct 2026", "external_withdrawal")).toBe(
			"Saved — ₹25,000 on 12 Oct 2026 now counts as money taken out to the bank",
		);
	});
});

describe("the words for each kind of question", () => {
	it("has a heading for every kind in the contract", () => {
		expect(questionTitle(QUESTION.ledger_line)).toBe("What was this ledger line?");
		expect(questionTitle(QUESTION.opening_balance)).toBe("Where did the opening balance come from?");
		expect(questionTitle(QUESTION.missing_isin)).toBe("Which share is this?");
		expect(questionTitle(QUESTION.transfer)).toBe("Is this the same money?");
		expect(questionTitle(QUESTION.corporate_action)).toBe("Apply a bonus issue?");
		expect(questionTitle(QUESTION.holding_mismatch)).toBe("The holdings statement and Kosh disagree on KONKAN");
	});

	it("names a split, a bonus and anything else", () => {
		const split = { ...QUESTION.corporate_action, actionType: "split" };
		const other = { ...QUESTION.corporate_action, actionType: "other" };
		expect(questionTitle(split)).toBe("Apply a share split?");
		expect(questionTitle(other)).toBe("Apply this change to the shares?");
		expect(QUESTIONS.action.apply("bonus")).toBe("Apply bonus");
		expect(QUESTIONS.action.apply("split")).toBe("Apply split");
		expect(QUESTIONS.action.apply("other")).toBe("Apply");
		expect(QUESTIONS.action.applied("bonus", "SAHYADRI", "600", "1,200")).toBe(
			"Bonus applied — SAHYADRI went from 600 to 1,200",
		);
	});

	it("describes a trade listed without an ISIN, and checks the ISIN typed for it", () => {
		expect(tradeWords(QUESTION.missing_isin)).toBe("bought 1,200 SAHYADRI at ₹250.50");
		expect(tradeWords({ ...QUESTION.missing_isin, side: "sell" })).toBe("sold 1,200 SAHYADRI at ₹250.50");
		expect(cleanIsin(" ine009a01021 ")).toBe("INE009A01021");
		expect(isIsin("ine009a01021")).toBe(true);
		expect(isIsin("INF204KB17I5")).toBe(true);
		for (const bad of ["", "INE009A0102", "INE009A010211", "12E009A01021", "INE009A0102X"]) expect(isIsin(bad)).toBe(false);
	});

	it("says both sides of a transfer", () => {
		const { out, in: into } = QUESTION.transfer;
		expect(QUESTIONS.transfer.left(ledgerMoney(out.amount), out.account.label, formatDate(out.date))).toBe(
			"₹2,00,000 left Sunita · Zerodha on 5 Jan 2024",
		);
		expect(QUESTIONS.transfer.arrived(ledgerMoney(into.amount), into.account.label, formatDate(into.date))).toBe(
			"₹2,00,000 arrived in Anil · Zerodha on 8 Jan 2024",
		);
	});

	it("keeps the order asked, with skipped questions at the end in the order they were skipped", () => {
		const asked = [{ id: "a" }, { id: "b" }, { id: "c" }];
		expect(orderQuestions(asked, [])).toEqual(asked);
		expect(orderQuestions(asked, ["a"]).map((q) => q.id)).toEqual(["b", "c", "a"]);
		expect(orderQuestions(asked, ["b", "a"]).map((q) => q.id)).toEqual(["c", "b", "a"]);
		// A skipped question that has since been answered is simply gone.
		expect(orderQuestions(asked, ["gone", "c"]).map((q) => q.id)).toEqual(["a", "b", "c"]);
	});
});

describe("what Kosh read from a file", () => {
	it("says what kind of statement it is and the dates it covers", () => {
		expect(previewHeadline(PREVIEW)).toBe("A Zerodha tradebook, 1 Oct 2026 to 30 Oct 2026.");
		expect(
			previewHeadline({
				...PREVIEW,
				detected: { broker: "zerodha", kind: "holdings" },
				span: { from: "2026-03-31", to: "2026-03-31" },
			}),
		).toBe("A Zerodha holdings statement for 31 Mar 2026.");
		expect(previewHeadline({ ...PREVIEW, detected: { broker: "zerodha", kind: "ledger" }, span: null })).toBe(
			"A Zerodha ledger.",
		);
		expect(previewHeadline({ ...PREVIEW, detected: null })).toBeNull();
	});

	it("does not call Kosh's own layout a broker", () => {
		expect(previewHeadline({ ...PREVIEW, detected: { broker: "template", kind: "tradebook" } })).toBe(
			"A tradebook in Kosh’s own layout, 1 Oct 2026 to 30 Oct 2026.",
		);
		expect(previewHeadline({ ...PREVIEW, detected: { broker: "template", kind: "ledger" }, span: null })).toBe(
			"A ledger in Kosh’s own layout.",
		);
	});

	it("says how many lines are new, already in, to be asked about and unreadable", () => {
		expect(previewFacts(PREVIEW.summary, "tradebook").map((fact) => fact.text)).toEqual([
			"200 lines are new and will be added",
			"14 lines are already in — they are skipped, not added twice",
			"Kosh will ask you about 3 of them once they are in",
		]);
		expect(previewFacts({ total: 2, new: 1, duplicate: 1, error: 1, questions: 1 }, "ledger")).toEqual([
			{ key: "new", text: "1 line is new and will be added", tone: "plain" },
			{ key: "duplicate", text: "1 line is already in — it is skipped, not added twice", tone: "plain" },
			{ key: "questions", text: "Kosh will ask you about 1 of them once it is in", tone: "ask" },
			{ key: "error", text: "1 line couldn’t be read", tone: "bad" },
		]);
	});

	it("says so when there will be nothing to ask — but never promises that of a holdings statement", () => {
		const summary = { total: 4, new: 4, duplicate: 0, error: 0, questions: 0 };
		expect(previewFacts(summary, "tradebook")[1]?.text).toBe(UPLOAD.facts.noQuestions);
		expect(previewFacts(summary, "holdings")[1]?.text).toBe(UPLOAD.facts.holdingsCheck);
		expect(previewFacts({ total: 0, new: 0, duplicate: 0, error: 0, questions: 0 })).toEqual([]);
	});

	it("words the button and the snackbar", () => {
		expect(UPLOAD.add(214)).toBe("Add 214 lines");
		expect(UPLOAD.add(1)).toBe("Add 1 line");
		expect(UPLOAD.add(1214)).toBe("Add 1,214 lines");
		expect(UPLOAD.added("Tradebook Oct 2026.csv", 214, 0)).toBe("Tradebook Oct 2026.csv added — 214 lines");
		expect(UPLOAD.added("Ledger.csv", 96, 3)).toBe("Ledger.csv added — 96 lines, 3 questions to answer");
	});

	it("is silent about a file that can go in", () => {
		expect(problemWords(PREVIEW, "Zerodha")).toBeNull();
	});

	it("explains a duplicate in the wording board's words", () => {
		const at = Date.UTC(2026, 10, 3, 10, 0);
		const same = problemWords(
			{
				...PREVIEW,
				canApply: false,
				problem: { code: "already_uploaded", message: "This file is already in. Nothing was added." },
				previous: { fileName: "Tradebook Oct 2026.csv", at },
			},
			"Zerodha",
		);
		expect(same?.title).toBe("Already uploaded");
		expect(same?.body).toBe(`This file came in as Tradebook Oct 2026.csv on ${formatDay(at)}. Nothing was added.`);

		const lines = problemWords(
			{
				...PREVIEW,
				canApply: false,
				problem: { code: "nothing_new", message: "All 88 lines in this file are already in. Nothing was added." },
				summary: { total: 88, new: 0, duplicate: 88, error: 0, questions: 0 },
			},
			"Zerodha",
		);
		expect(lines).toEqual({
			title: "Already uploaded",
			body: "These 88 lines are already in from earlier uploads. Nothing was added.",
			tryThis: null,
		});
	});

	it("gives a file it cannot read the server's reason and what to try", () => {
		const unreadable = problemWords(
			{
				...PREVIEW,
				detected: null,
				canApply: false,
				problem: { code: "unreadable", message: "This is a PDF. Download the statement as CSV or Excel." },
			},
			"Zerodha",
		);
		expect(unreadable?.title).toBe("Kosh can’t open this file");
		expect(unreadable?.body).toBe("This is a PDF. Download the statement as CSV or Excel.");
		expect(unreadable?.tryThis).toContain("from Zerodha as CSV or XLSX");

		const unknown = problemWords(
			{ ...PREVIEW, detected: null, canApply: false, problem: { code: "unrecognised", message: "Not known." } },
			null,
		);
		expect(unknown?.tryThis).toContain("from your broker");

		const broken = problemWords(
			{ ...PREVIEW, canApply: false, problem: { code: "has_errors", message: "Some lines can’t be read." } },
			"Zerodha",
		);
		expect(broken).toEqual({ title: "Some lines can’t be read", body: "Some lines can’t be read.", tryThis: null });
	});

	it("names the broker a statement looks like", () => {
		const wrong = problemWords(
			{ ...PREVIEW, canApply: false, problem: { code: "wrong_broker", message: "Upload it to the Zerodha account." } },
			"Groww",
		);
		expect(wrong?.title).toBe("This looks like a Zerodha statement");
	});
});

describe("uploads", () => {
	const upload: Upload = {
		batchId: "b1",
		fileName: "Tradebook Oct 2026.csv",
		kind: "tradebook",
		broker: "zerodha",
		status: "applied",
		at: new Date(2026, 10, 15, 10, 42).getTime(),
		byName: "Ramesh Iyer",
		byMe: true,
		added: 214,
		span: null,
		canUndo: true,
		undoBlocked: null,
	};
	const now = new Date(2026, 10, 15, 18, 0).getTime();

	it("says when, by whom and how many lines", () => {
		expect(uploadLine(upload, now)).toBe("Today 10:42 · you · 214 lines");
		expect(uploadLine({ ...upload, byMe: false, added: 1 }, now)).toBe("Today 10:42 · Ramesh Iyer · 1 line");
	});

	it("keeps an undone upload, and says its lines came out", () => {
		expect(uploadLine({ ...upload, status: "retracted" }, now)).toBe("Today 10:42 · you · 214 lines, taken out again");
	});

	it("says what undoing will remove, and that it can be uploaded again", () => {
		expect(UPLOADS.confirmTitle("Tradebook Oct 2026.csv")).toBe("Undo Tradebook Oct 2026.csv?");
		expect(UPLOADS.confirmBody(214)).toContain("Its 214 lines come out and returns are worked out again.");
		expect(UPLOADS.confirmBody(214)).toContain("You can upload it again later.");
	});
});

describe("how complete the history is", () => {
	const states = (history: History) => historyChecklist(history).map((item) => `${item.key}:${item.state}`);

	it("ticks everything for a whole history, and marks the holdings statement as optional", () => {
		const items = historyChecklist(HISTORY_FULL);
		expect(states(HISTORY_FULL)).toEqual(["ledger:ok", "opening:ok", "gaps:ok", "trades:ok", "holdings:optional"]);
		expect(items[0]?.title).toBe("Ledger: 3 Apr 2023 to 15 Apr 2026 · 17 lines");
		expect(items[1]?.title).toBe(HISTORY.startsFromZero);
		expect(items[3]?.title).toBe("Trades: 5 Apr 2023 to 12 Aug 2025 · 10 trades");
		expect(historyIsEmpty(HISTORY_FULL)).toBe(false);
	});

	it("asks for a ledger and a tradebook when nothing is in", () => {
		const nothing: History = { ledger: null, trades: null, holdings: null, complete: false };
		expect(states(nothing)).toEqual(["ledger:missing", "trades:missing", "holdings:optional"]);
		expect(historyChecklist(nothing)[0]?.detail).toBe(HISTORY.noLedgerFix);
		expect(historyIsEmpty(nothing)).toBe(true);
	});

	it("says deposits are worked out from trades while there is no ledger", () => {
		const tradesOnly: History = { ...HISTORY_FULL, ledger: null, complete: false };
		expect(historyChecklist(tradesOnly)[0]?.detail).toContain(HISTORY.noLedgerButTrades);
	});

	it("flags an opening balance nobody has explained, and accepts one that has been", () => {
		const ledger = { ...(HISTORY_FULL.ledger as NonNullable<History["ledger"]>), openingBalance: "50000.00" };
		const open = historyChecklist({ ...HISTORY_FULL, ledger: { ...ledger, openingExplained: false }, complete: false });
		expect(open[1]).toEqual({
			key: "opening",
			state: "missing",
			title: "It starts on 3 Apr 2023 with ₹50,000 already in, and nobody has said where from",
			detail: HISTORY.openingFix,
		});
		const explained = historyChecklist({ ...HISTORY_FULL, ledger: { ...ledger, openingExplained: true } });
		expect(explained[1]?.state).toBe("ok");
		expect(explained[1]?.title).toBe("It starts with ₹50,000 already in, counted as money put in on 3 Apr 2023");
		const short = historyChecklist({
			...HISTORY_FULL,
			ledger: { ...ledger, openingBalance: "-1200.50", openingExplained: false },
			complete: false,
		});
		expect(short[1]?.title).toBe("It starts on 3 Apr 2023 already ₹1,200.50 short, so earlier lines are missing");
	});

	it("lists each gap with what to upload", () => {
		const gapped: History = {
			...HISTORY_FULL,
			ledger: {
				...(HISTORY_FULL.ledger as NonNullable<History["ledger"]>),
				gaps: [{ after: "2024-03-28", before: "2024-07-02", missing: "-15000.00" }],
			},
			complete: false,
		};
		const gap = historyChecklist(gapped).find((item) => item.key.startsWith("gap:"));
		expect(gap).toMatchObject({
			state: "missing",
			title: "Lines are missing between 28 Mar 2024 and 2 Jul 2024 — the balance jumps by ₹15,000",
			detail: HISTORY.gapFix,
		});
		expect(states(gapped)).not.toContain("gaps:ok");
	});

	it("names the months trades were paid for with no tradebook", () => {
		const missing: History = {
			...HISTORY_FULL,
			trades: { from: "2023-04-05", to: "2025-08-12", count: 10, missingMonths: ["2024-03", "2024-04"] },
			complete: false,
		};
		expect(historyChecklist(missing).find((item) => item.key === "months")?.title).toBe(
			"The ledger shows trades being paid for in Mar 2024 and Apr 2024, but no tradebook covers them",
		);
		// No tradebook at all, yet the ledger shows trades settling.
		const none: History = { ...HISTORY_FULL, trades: { from: "", to: "", count: 0, missingMonths: ["2024-03"] }, complete: false };
		expect(states(none)).toContain("trades:missing");
		expect(historyChecklist(none).find((item) => item.key === "months")?.title).toContain("no tradebook covers it");
	});

	it("does not call a tradebook missing when the ledger shows no trade", () => {
		const cashOnly: History = { ...HISTORY_FULL, trades: null };
		expect(historyChecklist(cashOnly).find((item) => item.key === "trades")).toEqual({
			key: "trades",
			state: "optional",
			title: HISTORY.noTrades,
			detail: HISTORY.noTradesNeeded,
		});
	});

	it("shows a holdings statement that is in", () => {
		const held: History = { ...HISTORY_FULL, holdings: { asOf: "2026-03-31", lines: 23 } };
		expect(historyChecklist(held).at(-1)).toMatchObject({
			state: "ok",
			title: "Holdings statement for 31 Mar 2026 · 23 lines",
		});
	});
});

describe("splits and bonuses applied", () => {
	const applied: AppliedAction = {
		applicationId: "ap1",
		actionId: "ca1",
		symbol: "RELIANCE",
		actionType: "bonus",
		announcement: "Bonus 1:1",
		exDate: "2024-10-28",
		state: "applied",
		quantityBefore: "51",
		quantityAfter: "102",
		by: "kosh",
		byName: null,
		source: "exchange",
		canUndo: true,
	};

	it("says the day and what it did to the quantity", () => {
		expect(actionLine(applied)).toBe("28 Oct 2024 · 51 became 102");
		expect(actionLine({ ...applied, state: "declined" })).toBe("28 Oct 2024 · not applied to this account");
	});

	it("says who stands behind it", () => {
		expect(actionBy(applied)).toBe(SPLITS.byKosh);
		expect(actionBy({ ...applied, by: "person", byName: "Ramesh Iyer" })).toBe("Applied by Ramesh Iyer");
		expect(actionBy({ ...applied, by: "person", byName: "Ramesh Iyer", source: "person" })).toBe("Recorded by Ramesh Iyer");
		expect(actionBy({ ...applied, state: "declined", by: "person", byName: "Anil Mehta" })).toBe(
			"Anil Mehta said it isn’t for this account",
		);
	});

	it("says what undoing puts back", () => {
		expect(SPLITS.confirmTitle("RELIANCE", "bonus")).toBe("Undo the RELIANCE bonus?");
		expect(SPLITS.confirmBody("51", "28 Oct 2024")).toContain("This account goes back to 51 from 28 Oct 2024");
	});
});
