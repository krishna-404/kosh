import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { describe, expect, it } from "vitest";
import {
	absAmount,
	aheadParts,
	aheadPhrase,
	aheadSentence,
	aheadState,
	aheadTone,
	askName,
	benchmarkTone,
	cameFrom,
	canEditAccount,
	countFlows,
	formatQuantity,
	formatRatio,
	lastStatementWords,
	levelSentence,
	sameMoneyLine,
	tabFromParam,
	tabSearch,
	tabsFor,
	toggleMember,
	trailRows,
} from "./account.utils";

type Flow = Returns["trail"]["flows"][number];
type Benchmark = Returns["benchmarks"][number];

const flow = (date: string, amount: string, what: string, account: string | null = "Anil · Zerodha"): Flow => ({
	date,
	amount,
	what,
	account,
});

const benchmark = (slug: string, name: string, ahead: string | null): Benchmark => ({
	slug,
	name,
	proxy: "",
	value: ahead === null ? null : "100.00",
	xirr: ahead === null ? null : 0.1,
	ahead,
	availableFrom: null,
});

const sharer = { userId: "u1", name: "Anil Mehta", email: "anil@example.com" };

describe("which tabs a level sees", () => {
	it("hides Statements and questions from someone who can only view", () => {
		expect(tabsFor("view")).toEqual(["returns", "holdings", "cash", "worked-out"]);
	});

	it("shows every tab to someone who can edit, and to an owner", () => {
		expect(tabsFor("edit")).toEqual(["returns", "holdings", "cash", "statements", "worked-out"]);
		expect(tabsFor("owner")).toEqual(tabsFor("edit"));
	});

	it("reads the tab from the address, falling back to Returns", () => {
		expect(tabFromParam("holdings", "view")).toBe("holdings");
		expect(tabFromParam("worked-out", "owner")).toBe("worked-out");
		expect(tabFromParam(null, "owner")).toBe("returns");
		expect(tabFromParam("nonsense", "edit")).toBe("returns");
	});

	it("does not open a tab the level cannot see, even when the address names it", () => {
		expect(tabFromParam("statements", "view")).toBe("returns");
		expect(tabFromParam("statements", "edit")).toBe("statements");
	});

	it("builds a tab's address, keeping the period and dropping what belongs to another tab", () => {
		const at = (search: string) => new URLSearchParams(search);
		expect(tabSearch(at(""), "holdings")).toBe("?tab=holdings");
		expect(tabSearch(at("?tab=holdings"), "returns")).toBe("");
		expect(tabSearch(at("?over=1y&tab=cash&view=trades"), "worked-out")).toBe("?over=1y&tab=worked-out");
		expect(tabSearch(at("?over=3y"), "statements", { upload: "1" })).toBe("?over=3y&tab=statements&upload=1");
		expect(tabSearch(at("?tab=statements&upload=1"), "statements")).toBe("?tab=statements");
	});

	it("lets Can edit and Owner upload, not Can view", () => {
		expect(canEditAccount("view")).toBe(false);
		expect(canEditAccount("edit")).toBe(true);
		expect(canEditAccount("owner")).toBe(true);
	});
});

describe("the level sentence", () => {
	it("tells a viewer what they can see and who to ask", () => {
		expect(levelSentence("view", "Anil")).toBe(
			"You can see everything here and how it was worked out. To upload or change anything, ask Anil.",
		);
		expect(levelSentence("view", null)).toMatch(/ask an owner\.$/);
	});

	it("tells an editor what they can do, and that sharing is not theirs", () => {
		const sentence = levelSentence("edit", "Anil");
		expect(sentence).toMatch(/upload statements, undo your own uploads and answer questions/);
		expect(sentence).toMatch(/Sharing is up to Anil\.$/);
		expect(levelSentence("edit", null)).toMatch(/up to the owners\.$/);
	});

	it("tells an owner they decide who sees it, whoever shared it", () => {
		expect(levelSentence("owner", null)).toBe(levelSentence("owner", "Anil"));
		expect(levelSentence("owner", null)).toMatch(/decide who else sees this account/);
	});

	it("has a short line for the phone", () => {
		expect(levelSentence("view", "Anil", true)).toBe("Ask Anil to change anything");
		expect(levelSentence("edit", "Anil", true)).toBe("Sharing is up to Anil");
		expect(levelSentence("owner", null, true)).toBe("You decide who else sees it");
	});

	it("never uses the words the wording board rules out", () => {
		const all = (["view", "edit", "owner"] as const).flatMap((level) => [
			levelSentence(level, "Anil"),
			levelSentence(level, null),
			levelSentence(level, "Anil", true),
		]);
		for (const sentence of all)
			expect(sentence).not.toMatch(/\b(role|tenant|grant|permission|user|revoke|collaborator|entity)\b/i);
	});

	it("asks whoever shared the account, by first name", () => {
		expect(askName({ sharedBy: sharer })).toBe("Anil");
		expect(askName({ sharedBy: null })).toBeNull();
	});
});

describe("where the page was reached from", () => {
	it("goes back to Shared with me when someone shared it", () => {
		expect(cameFrom({ sharedBy: sharer }, { displayName: "Anil Mehta" })).toEqual({
			to: "/shared",
			parent: "Shared with me",
			here: "From Anil Mehta",
		});
	});

	it("goes back to Accounts and people otherwise, under the holder's name", () => {
		expect(cameFrom({ sharedBy: null }, { displayName: "Kabir Mehta" })).toEqual({
			to: "/accounts",
			parent: "Accounts and people",
			here: "Kabir Mehta",
		});
	});
});

describe("the last statement", () => {
	const now = new Date(2026, 10, 15, 12).getTime();

	it("says when and by whom", () => {
		expect(lastStatementWords({ at: now - 60_000, byName: "Anil Mehta", byMe: true }, now)).toBe("Today, by you");
		expect(
			lastStatementWords({ at: new Date(2026, 10, 3, 9).getTime(), byName: "Ramesh Iyer", byMe: false }, now),
		).toBe("3 Nov, by Ramesh");
	});

	it("says so when there is none", () => {
		expect(lastStatementWords(null, now)).toBe("None yet");
	});
});

describe("counting deposits and withdrawals", () => {
	const sinceTheStart = [
		flow("2023-04-03", "-700000.00", "Put in"),
		flow("2023-10-03", "-200000.00", "Put in"),
		flow("2024-01-05", "200000.00", "Taken out"),
		flow("2024-07-01", "-300000.00", "Put in"),
		flow("2025-03-10", "50000.00", "Taken out"),
		flow("2025-08-11", "-150000.00", "Put in"),
		flow("2026-11-16", "1237075.15", "Value today", null),
	];

	it("counts money put in as deposits and money taken out as withdrawals", () => {
		expect(countFlows(sinceTheStart, "0.00")).toEqual({
			deposits: 4,
			withdrawals: 2,
			hasOpening: false,
			capped: false,
		});
	});

	it("never counts today's value as a withdrawal", () => {
		const onlyValue = [flow("2026-11-16", "1237075.15", "Value today", null)];
		expect(countFlows(onlyValue, "0.00")).toMatchObject({ deposits: 0, withdrawals: 0 });
	});

	it("does not count the value at the start of a window as a deposit", () => {
		const threeYears = [
			flow("2023-11-16", "-901203.34", "Value at the start of the window", null),
			flow("2024-01-05", "200000.00", "Taken out"),
			flow("2024-07-01", "-300000.00", "Put in"),
			flow("2026-11-16", "1237075.15", "Value today", null),
		];
		expect(countFlows(threeYears, "901203.34")).toEqual({
			deposits: 1,
			withdrawals: 1,
			hasOpening: true,
			capped: false,
		});

		const oneYear = [
			flow("2025-11-16", "-1335902.47", "Value at the start of the window", null),
			flow("2026-11-16", "1237075.15", "Value today", null),
		];
		expect(countFlows(oneYear, "1335902.47")).toMatchObject({ deposits: 0, withdrawals: 0, hasOpening: true });
	});

	it("counts money already in the account when its ledger starts as a deposit", () => {
		const flows = [
			flow("2023-04-01", "-50000.00", "Already in the account when its ledger starts"),
			flow("2026-11-16", "61000.00", "Value today", null),
		];
		expect(countFlows(flows, "0.00")).toMatchObject({ deposits: 1, withdrawals: 0 });
	});

	it("copes with an empty trail", () => {
		expect(countFlows([], "0.00")).toEqual({ deposits: 0, withdrawals: 0, hasOpening: false, capped: false });
	});

	it("says when the list is cut short, so no count is stated", () => {
		const many = [
			...Array.from({ length: 500 }, (_, i) => flow("2024-01-01", i % 2 ? "100.00" : "-100.00", "x")),
			flow("2026-11-16", "1.00", "Value today", null),
		];
		expect(countFlows(many, "0.00").capped).toBe(true);
		expect(sameMoneyLine(countFlows(many, "0.00"))).toBe(
			"Same deposits and withdrawals, on the same dates. Only where the money went changes.",
		);
	});

	it("words what is held the same", () => {
		const base = { hasOpening: false, capped: false };
		expect(sameMoneyLine({ ...base, deposits: 41, withdrawals: 3 })).toBe(
			"Same 44 deposits and withdrawals, on the same dates. Only where the money went changes.",
		);
		expect(sameMoneyLine({ ...base, deposits: 1, withdrawals: 0 })).toBe(
			"Same 1 deposit, on the same dates. Only where the money went changes.",
		);
		expect(sameMoneyLine({ ...base, deposits: 0, withdrawals: 2 })).toMatch(/^Same 2 withdrawals,/);
		expect(sameMoneyLine({ deposits: 1, withdrawals: 1, hasOpening: true, capped: false })).toBe(
			"The same value at the start, then the same 2 deposits and withdrawals, on the same dates. Only where the money went changes.",
		);
		expect(sameMoneyLine({ deposits: 0, withdrawals: 0, hasOpening: true, capped: false })).toMatch(
			/nothing put in or taken out since/,
		);
	});

	it("lays the trail out as put in and taken out, with today's value apart", () => {
		const { rows, closing } = trailRows(sinceTheStart);
		expect(rows).toHaveLength(6);
		expect(rows[0]).toMatchObject({ date: "2023-04-03", what: "Put in", putIn: "700000.00", takenOut: null });
		expect(rows[2]).toMatchObject({ what: "Taken out", putIn: null, takenOut: "200000.00" });
		expect(closing).toMatchObject({ what: "Value today", amount: "1237075.15" });
		expect(trailRows([])).toEqual({ rows: [], closing: null });
		expect(absAmount("-88.50")).toBe("88.50");
		expect(absAmount("88.50")).toBe("88.50");
	});
});

describe("ahead and behind", () => {
	it("reads the sign: positive is ahead, negative behind, under half a rupee level", () => {
		expect(aheadState("510000.00")).toBe("ahead");
		expect(aheadState("-250639.11")).toBe("behind");
		expect(aheadState("0.30")).toBe("level");
		expect(aheadState("-0.49")).toBe("level");
	});

	it("words each benchmark for what it really is", () => {
		const parts = aheadParts([
			benchmark("nifty50", "NIFTY 50", "510000.00"),
			benchmark("gold", "Gold", "-260000.40"),
		]);
		expect(parts.map(aheadPhrase)).toEqual(["₹5,10,000 ahead of NIFTY 50", "₹2,60,000 behind Gold"]);
		expect(aheadSentence(parts)).toBe(
			"On the same money, this account is ₹5,10,000 ahead of NIFTY 50 and ₹2,60,000 behind Gold.",
		);
	});

	it("is good news only when ahead of everything", () => {
		const both = aheadParts([benchmark("nifty50", "NIFTY 50", "5.00"), benchmark("gold", "Gold", "9.00")]);
		const mixed = aheadParts([benchmark("nifty50", "NIFTY 50", "5.00"), benchmark("gold", "Gold", "-9.00")]);
		const behind = aheadParts([benchmark("nifty50", "NIFTY 50", "-5.00"), benchmark("gold", "Gold", "-9.00")]);
		expect(aheadTone(both)).toBe("good");
		expect(aheadTone(mixed)).toBe("info");
		expect(aheadTone(behind)).toBe("info");
		expect(aheadSentence(behind)).toBe(
			"On the same money, this account is ₹5 behind NIFTY 50 and ₹9 behind Gold.",
		);
	});

	it("leaves out a benchmark that has no value today instead of guessing", () => {
		const parts = aheadParts([benchmark("nifty50", "NIFTY 50", "-12.00"), benchmark("gold", "Gold", null)]);
		expect(parts).toHaveLength(1);
		expect(aheadSentence(parts)).toBe("On the same money, this account is ₹12 behind NIFTY 50.");
		expect(aheadSentence([])).toBe("");
		expect(aheadTone([])).toBe("info");
	});

	it("says level rather than ahead by nothing", () => {
		const [part] = aheadParts([benchmark("gold", "Gold", "0.00")]);
		expect(part && aheadPhrase(part)).toBe("level with Gold");
	});
});

describe("small formats", () => {
	it("gives each benchmark its fixed colour", () => {
		expect(benchmarkTone("nifty50")).toBe("nifty");
		expect(benchmarkTone("gold")).toBe("gold");
		expect(benchmarkTone("sensex")).toBe("alt");
	});

	it("writes quantities the Indian way, without trailing zeros", () => {
		expect(formatQuantity("2456")).toBe("2,456");
		expect(formatQuantity("170.00000000")).toBe("170");
		expect(formatQuantity("12.3456")).toBe("12.346");
		expect(formatQuantity("123456.5")).toBe("1,23,456.5");
		expect(formatQuantity("n/a")).toBe("n/a");
	});

	it("writes ratios to two places with a real minus", () => {
		expect(formatRatio(-0.2023)).toBe("−0.20");
		expect(formatRatio(1.234)).toBe("1.23");
		expect(formatRatio(-0.001)).toBe("0.00");
	});

	it("adds an account to a group, or takes it out", () => {
		expect(toggleMember(["a", "b"], "c")).toEqual(["a", "b", "c"]);
		expect(toggleMember(["a", "b"], "a")).toEqual(["b"]);
	});
});
