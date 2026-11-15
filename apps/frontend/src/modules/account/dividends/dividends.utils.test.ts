import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { describe, expect, it } from "vitest";
import {
	amountRefusal,
	amountWasChanged,
	countedTotal,
	dividendFacts,
	financialYearLabel,
	financialYearOf,
	fromPaise,
	groupByFinancialYear,
	isCounted,
	isDay,
	isRefusal,
	paiseShown,
	parseAmount,
	payingScripts,
	perShare,
	rupees,
	scriptName,
	shareCount,
	sharesTimesPrice,
	stateWords,
	todayIso,
	toPaise,
	typedAmount,
	workedOutAmount,
} from "./dividends.utils";

const dividend = (over: Partial<Dividend> = {}): Dividend => ({
	id: "d1",
	instrumentId: "i1",
	symbol: "KONKAN",
	name: "Konkan Foods",
	exDate: "2026-11-04",
	receivedOn: "2026-11-04",
	quantity: "1284",
	amountPerShare: "5",
	amount: "6420.00",
	state: "expected",
	source: "feed",
	announcement: "Dividend - Rs 5 Per Share",
	...over,
});

describe("amounts", () => {
	it("adds in whole paise", () => {
		expect(toPaise("910.00")).toBe(91000);
		expect(toPaise("2949.5")).toBe(294950);
		expect(toPaise("0.07")).toBe(7);
		expect(fromPaise(294950)).toBe("2949.50");
		expect(fromPaise(0)).toBe("0.00");
	});

	it("writes paise only when there are any", () => {
		expect(rupees("6420.00")).toBe("₹6,420");
		expect(rupees("1488.50")).toBe("₹1,488.50");
		expect(rupees("45654.90")).toBe("₹45,654.90");
		expect(rupees("0.00")).toBe("₹0");
	});

	it("starts a field from the amount as a person would type it", () => {
		expect(paiseShown("910.00")).toBe(0);
		expect(paiseShown("1488.50")).toBe(2);
		expect(typedAmount("910.00")).toBe("910");
		expect(typedAmount("1488.50")).toBe("1488.50");
	});

	it("writes what was announced per share to the paisa, or in full when finer", () => {
		expect(perShare("5")).toBe("₹5.00");
		expect(perShare("6.5")).toBe("₹6.50");
		expect(perShare("17.35")).toBe("₹17.35");
		expect(perShare("2.125")).toBe("₹2.125");
		expect(perShare("1250")).toBe("₹1,250.00");
	});

	it("groups a share count the Indian way and drops empty decimals", () => {
		expect(shareCount("1284")).toBe("1,284");
		expect(shareCount("125000")).toBe("1,25,000");
		expect(shareCount("12.500")).toBe("12.5");
		expect(shareCount("35")).toBe("35");
	});
});

describe("the working: N shares × ₹P", () => {
	it("reads as the board writes it", () => {
		expect(sharesTimesPrice(dividend())).toBe("1,284 shares × ₹5.00");
		expect(sharesTimesPrice(dividend({ quantity: "229", amountPerShare: "7.85" }))).toBe("229 shares × ₹7.85");
	});

	it("says one share, not one shares", () => {
		expect(sharesTimesPrice(dividend({ quantity: "1", amountPerShare: "26" }))).toBe("1 share × ₹26.00");
	});

	it("keeps part-shares", () => {
		expect(sharesTimesPrice(dividend({ quantity: "0.5", amountPerShare: "10" }))).toBe("0.5 shares × ₹10.00");
	});

	it("has nothing to say for one a person entered", () => {
		expect(sharesTimesPrice(dividend({ source: "person", quantity: "0", amountPerShare: "0" }))).toBeNull();
		expect(workedOutAmount(dividend({ source: "person", quantity: "0", amountPerShare: "0" }))).toBeNull();
	});

	it("multiplies out to what the server worked out, to the paisa", () => {
		expect(workedOutAmount(dividend())).toBe("6420.00");
		// 170 × 17.35 is 2949.4999… in floating point.
		expect(workedOutAmount(dividend({ quantity: "170", amountPerShare: "17.35" }))).toBe("2949.50");
		expect(workedOutAmount(dividend({ quantity: "229", amountPerShare: "6.25" }))).toBe("1431.25");
	});

	it("notices when a person said a different amount arrived", () => {
		expect(amountWasChanged(dividend({ state: "confirmed" }))).toBe(false);
		expect(amountWasChanged(dividend({ state: "confirmed", amount: "5778.00" }))).toBe(true);
		// Only an answer changes it; Kosh's own working is never "changed".
		expect(amountWasChanged(dividend({ state: "expected", amount: "5778.00" }))).toBe(false);
		expect(amountWasChanged(dividend({ state: "confirmed", source: "person", quantity: "0", amount: "500.00" }))).toBe(
			false,
		);
	});
});

describe("totals", () => {
	it("counts expected and confirmed, and leaves out what never arrived", () => {
		expect(isCounted({ state: "expected" })).toBe(true);
		expect(isCounted({ state: "confirmed" })).toBe(true);
		expect(isCounted({ state: "not_received" })).toBe(false);
		expect(
			countedTotal([
				{ amount: "910.00", state: "expected" },
				{ amount: "1488.50", state: "confirmed" },
				{ amount: "5000.00", state: "not_received" },
			]),
		).toBe("2398.50");
	});

	it("does not drift over many small amounts", () => {
		const many = Array.from({ length: 300 }, () => ({ amount: "0.10", state: "expected" as const }));
		expect(countedTotal(many)).toBe("30.00");
	});

	it("is zero for none", () => {
		expect(countedTotal([])).toBe("0.00");
	});
});

describe("financial years (April to March)", () => {
	it("puts a day in the year that starts the April before it", () => {
		expect(financialYearOf("2026-04-01")).toBe(2026);
		expect(financialYearOf("2026-11-04")).toBe(2026);
		expect(financialYearOf("2027-03-31")).toBe(2026);
		expect(financialYearOf("2026-03-31")).toBe(2025);
		expect(financialYearOf("2026-01-01")).toBe(2025);
	});

	it("names a year by both the years it touches", () => {
		expect(financialYearLabel(2026)).toBe("2026–27");
		expect(financialYearLabel(2009)).toBe("2009–10");
		expect(financialYearLabel(1999)).toBe("1999–00");
	});

	it("groups newest year first, newest dividend first, with each year's total and counts", () => {
		const years = groupByFinancialYear([
			dividend({ id: "a", exDate: "2026-11-03", receivedOn: "2026-11-03", amount: "910.00" }),
			dividend({ id: "b", exDate: "2026-05-15", receivedOn: "2026-05-15", amount: "2949.50", state: "confirmed" }),
			dividend({ id: "c", exDate: "2026-02-04", receivedOn: "2026-02-04", amount: "1488.50" }),
			dividend({ id: "d", exDate: "2025-05-28", receivedOn: "2025-05-28", amount: "1797.65", state: "not_received" }),
			dividend({ id: "e", exDate: "2024-06-04", receivedOn: "2024-06-04", amount: "1717.50", state: "confirmed" }),
		]);
		expect(years.map((y) => y.label)).toEqual(["2026–27", "2025–26", "2024–25"]);
		expect(years.map((y) => y.startYear)).toEqual([2026, 2025, 2024]);
		expect(years.map((y) => y.dividends.map((d) => d.id))).toEqual([["a", "b"], ["c", "d"], ["e"]]);
		expect(years.map((y) => y.total)).toEqual(["3859.50", "1488.50", "1717.50"]);
		expect(years.map((y) => y.toConfirm)).toEqual([1, 1, 0]);
		expect(years.map((y) => y.notReceived)).toEqual([0, 1, 0]);
	});

	it("files a dividend under the day it is counted on, not its ex-date", () => {
		// Ex-date in March, arrived in April: it is the next year's income.
		const years = groupByFinancialYear([
			dividend({ id: "late", exDate: "2026-03-27", receivedOn: "2026-04-09", state: "confirmed" }),
			dividend({ id: "march", exDate: "2026-03-20", receivedOn: "2026-03-20" }),
		]);
		expect(years.map((y) => [y.label, y.dividends.map((d) => d.id)])).toEqual([
			["2026–27", ["late"]],
			["2025–26", ["march"]],
		]);
	});

	it("orders within a year by the day counted, then the ex-date, and otherwise as the server sent them", () => {
		const years = groupByFinancialYear([
			dividend({ id: "first", exDate: "2026-06-05", receivedOn: "2026-06-05" }),
			dividend({ id: "second", exDate: "2026-06-05", receivedOn: "2026-06-05" }),
			dividend({ id: "arrived-late", exDate: "2026-05-01", receivedOn: "2026-07-01", state: "confirmed" }),
			dividend({ id: "older-ex", exDate: "2026-05-20", receivedOn: "2026-06-05", state: "confirmed" }),
		]);
		expect(years[0]?.dividends.map((d) => d.id)).toEqual(["arrived-late", "first", "second", "older-ex"]);
	});

	it("has no years for no dividends", () => {
		expect(groupByFinancialYear([])).toEqual([]);
	});
});

describe("the state, in words", () => {
	it("to confirm", () => {
		expect(stateWords(dividend())).toEqual({ tag: "To confirm", note: null });
	});

	it("confirmed as worked out says no more", () => {
		expect(stateWords(dividend({ state: "confirmed" }))).toEqual({ tag: "Confirmed", note: null });
	});

	it("confirmed, with the day it arrived when that is not the ex-date", () => {
		expect(stateWords(dividend({ state: "confirmed", receivedOn: "2026-11-20" }))).toEqual({
			tag: "Confirmed",
			note: "arrived 20 Nov 2026",
		});
	});

	it("not received, and so not counted", () => {
		expect(stateWords(dividend({ state: "not_received" }))).toEqual({ tag: "Not received", note: "not counted" });
		// Even when a day had been given before it was struck out.
		expect(stateWords(dividend({ state: "not_received", receivedOn: "2026-11-20" }))).toEqual({
			tag: "Not received",
			note: "not counted",
		});
	});

	it("one added by hand is confirmed; its day is its own line, not a note", () => {
		expect(stateWords(dividend({ state: "confirmed", source: "person", receivedOn: "2026-11-05" }))).toEqual({
			tag: "Confirmed",
			note: null,
		});
	});

	it("has a label for every state", () => {
		expect(D.state).toEqual({ expected: "To confirm", confirmed: "Confirmed", not_received: "Not received" });
	});
});

describe("the line under a script's name", () => {
	it("gives the ex-date and the working", () => {
		expect(dividendFacts(dividend())).toEqual(["Ex-date 4 Nov 2026", "1,284 shares × ₹5.00"]);
	});

	it("adds the day it arrived only when a person gave a different one", () => {
		expect(dividendFacts(dividend({ state: "confirmed" }))).toEqual(["Ex-date 4 Nov 2026", "1,284 shares × ₹5.00"]);
		expect(dividendFacts(dividend({ state: "confirmed", receivedOn: "2026-11-20" }))).toEqual([
			"Ex-date 4 Nov 2026",
			"1,284 shares × ₹5.00",
			"arrived 20 Nov 2026",
		]);
	});

	it("says what the working came to when a person said a different amount arrived", () => {
		expect(dividendFacts(dividend({ state: "confirmed", amount: "5778.00", receivedOn: "2026-11-20" }))).toEqual([
			"Ex-date 4 Nov 2026",
			"1,284 shares × ₹5.00 = ₹6,420",
			"arrived 20 Nov 2026",
		]);
	});

	it("keeps the working, and adds nothing, for one that never arrived", () => {
		expect(dividendFacts(dividend({ state: "not_received" }))).toEqual(["Ex-date 4 Nov 2026", "1,284 shares × ₹5.00"]);
	});

	it("has only the day it arrived for one a person entered", () => {
		expect(
			dividendFacts(
				dividend({ source: "person", state: "confirmed", quantity: "0", amountPerShare: "0", receivedOn: "2026-11-05" }),
			),
		).toEqual(["Arrived 5 Nov 2026"]);
	});
});

describe("what a person types", () => {
	it("takes an amount the way people write one", () => {
		expect(parseAmount("6420")).toBe("6420");
		expect(parseAmount("6,420.50")).toBe("6420.50");
		expect(parseAmount("₹ 6,420.5")).toBe("6420.5");
		expect(parseAmount(" 0 ")).toBe("0");
	});

	it("refuses what is not rupees and paise", () => {
		expect(parseAmount("")).toBeNull();
		expect(parseAmount("abc")).toBeNull();
		expect(parseAmount("-50")).toBeNull();
		expect(parseAmount("12.345")).toBeNull();
		expect(parseAmount("1e5")).toBeNull();
		expect(parseAmount(".5")).toBeNull();
	});

	it("knows a whole calendar date", () => {
		expect(isDay("2026-11-04")).toBe(true);
		expect(isDay("")).toBe(false);
		expect(isDay("2026-11")).toBe(false);
		expect(isDay("2026-13-40")).toBe(false);
	});

	it("gives today as a calendar date where the reader is", () => {
		expect(todayIso(new Date(2026, 10, 4, 23, 30))).toBe("2026-11-04");
		expect(todayIso(new Date(2026, 0, 9))).toBe("2026-01-09");
	});

	it("finds the server's words about the amount", () => {
		expect(amountRefusal({ data: { fieldErrors: { amount: ["An amount in rupees, like 6420 or 6420.50"] } } })).toBe(
			"An amount in rupees, like 6420 or 6420.50",
		);
		expect(amountRefusal({ message: "That date hasn’t come yet." })).toBeUndefined();
		expect(amountRefusal(null)).toBeUndefined();
	});

	it("tells a refusal from a failure", () => {
		expect(isRefusal({ status: 400, message: "That date hasn’t come yet." })).toBe(true);
		expect(isRefusal({ status: 500 })).toBe(false);
		expect(isRefusal(new TypeError("Failed to fetch"))).toBe(false);
		expect(isRefusal(null)).toBe(false);
	});
});

describe("scripts a dividend could have come from", () => {
	it("calls a script by its name, or its symbol when it has none", () => {
		expect(scriptName({ name: "Konkan Foods", symbol: "KONKAN" })).toBe("Konkan Foods");
		expect(scriptName({ name: " ", symbol: "KONKAN" })).toBe("KONKAN");
	});

	it("lists what is held first, then what was sold, each by name", () => {
		const scripts = payingScripts([
			{ instrumentId: "1", name: "Wipro", symbol: "WIPRO", sold: false },
			{ instrumentId: "2", name: "Asian Paints", symbol: "ASIANPAINT", sold: true },
			{ instrumentId: "3", name: "Infosys", symbol: "INFY", sold: false },
			{ instrumentId: "4", name: "", symbol: "ABB", sold: true },
		]);
		expect(scripts.map((s) => s.instrumentId)).toEqual(["3", "1", "4", "2"]);
	});
});
