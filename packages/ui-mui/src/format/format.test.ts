import { describe, expect, it } from "vitest";
import { formatDate, formatDateShort, formatDayLabel, formatMonth } from "./date";
import { formatMoney, groupIndian } from "./money";
import { formatPercent } from "./percent";
import { initialsOf, stableIndex } from "./person";

describe("formatMoney", () => {
	it("groups the Indian way", () => {
		expect(groupIndian("999")).toBe("999");
		expect(groupIndian("1000")).toBe("1,000");
		expect(groupIndian("100000")).toBe("1,00,000");
		expect(formatMoney("20622000.00")).toBe("₹2,06,22,000");
		expect(formatMoney(13595000)).toBe("₹1,35,95,000");
	});

	it("rounds to rupees unless paise are asked for", () => {
		expect(formatMoney("3180.50")).toBe("₹3,181");
		expect(formatMoney("3180.5", { decimals: 2 })).toBe("₹3,180.50");
		expect(formatMoney("0.00", { decimals: 2 })).toBe("₹0.00");
	});

	it("writes losses with a real minus, and signs gains on request", () => {
		expect(formatMoney("-146000")).toBe("−₹1,46,000");
		expect(formatMoney(6810000, { sign: "always", spacedSign: true })).toBe("+ ₹68,10,000");
		expect(formatMoney(-2100000, { sign: "always", spacedSign: true })).toBe("− ₹21,00,000");
		expect(formatMoney(-2100000, { sign: "never" })).toBe("₹21,00,000");
	});

	it("never signs a value that rounds to zero", () => {
		expect(formatMoney(-0.2)).toBe("₹0");
		expect(formatMoney(0.2, { sign: "always" })).toBe("₹0");
	});

	it("compacts to lakh and crore", () => {
		expect(formatMoney(3910000, { notation: "compact" })).toBe("₹39.1 L");
		expect(formatMoney(1397000, { notation: "compact" })).toBe("₹13.97 L");
		expect(formatMoney(13595000, { notation: "compact" })).toBe("₹1.36 Cr");
		expect(formatMoney(20000000, { notation: "compact" })).toBe("₹2 Cr");
		expect(formatMoney(82000, { notation: "compact" })).toBe("₹82,000");
	});

	it("shows a dash for something that is not a number", () => {
		expect(formatMoney("n/a")).toBe("—");
	});
});

describe("formatPercent", () => {
	it("reads a fraction as a rate", () => {
		expect(formatPercent(0.142)).toBe("14.2%");
		expect(formatPercent("0.1284")).toBe("12.8%");
		expect(formatPercent(-0.089)).toBe("−8.9%");
	});

	it("writes differences as signed points", () => {
		expect(formatPercent(0.024, { sign: "always", suffix: " pts" })).toBe("+2.4 pts");
		expect(formatPercent(-0.032, { sign: "always", suffix: "" })).toBe("−3.2");
		expect(formatPercent(0.0001, { sign: "always" })).toBe("0.0%");
	});
});

describe("dates", () => {
	it("formats a calendar date as written, whatever the viewer's zone", () => {
		expect(formatDate("2026-11-13")).toBe("13 Nov 2026");
		expect(formatDateShort("2026-11-13")).toBe("13 Nov");
		expect(formatMonth("2021-03-09")).toBe("Mar 2021");
	});

	it("labels recent days by name", () => {
		const now = new Date(2026, 10, 15, 12, 0).getTime();
		expect(formatDayLabel(new Date(2026, 10, 15, 0, 5).getTime(), now)).toBe("Today");
		expect(formatDayLabel(new Date(2026, 10, 14, 23, 55).getTime(), now)).toBe("Yesterday");
		expect(formatDayLabel(new Date(2026, 10, 13, 9, 0).getTime(), now)).toBe("13 Nov");
		expect(formatDayLabel(new Date(2025, 10, 13, 9, 0).getTime(), now)).toBe("13 Nov 2025");
	});
});

describe("people", () => {
	it("takes initials from the first and last word", () => {
		expect(initialsOf("Anil Mehta")).toBe("AM");
		expect(initialsOf("Anil Mehta HUF")).toBe("AH");
		expect(initialsOf("riya")).toBe("R");
		expect(initialsOf("  ")).toBe("?");
	});

	it("gives a person the same colour slot every time", () => {
		expect(stableIndex("01JABC", 8)).toBe(stableIndex("01JABC", 8));
		expect(stableIndex("01JABC", 8)).toBeLessThan(8);
	});
});
