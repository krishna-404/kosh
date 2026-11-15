import { describe, expect, it } from "vitest";
import { type FeeInput, feeCharges } from "./fee_charges";

// Every figure here can be checked with a calculator.
const flat = (value: number, over: Partial<FeeInput> = {}): FeeInput => ({
	terms: [],
	payments: [],
	start: "2024-01-01",
	today: "2024-12-31",
	valueOn: (date) => (date < "2024-01-01" ? 0 : value),
	flows: [{ date: "2024-01-01", amount: value }],
	...over,
});
const terms = (over: Partial<FeeInput["terms"][number]>) => ({
	kind: "percent_of_assets" as const,
	rate: null,
	amountPerYear: null,
	hurdleRate: null,
	startsOn: "2024-01-01",
	endsOn: null,
	...over,
});

describe("what a fee arrangement comes to", () => {
	it("percent of assets: the rate on each day's value, billed each quarter", () => {
		// ₹36,50,000 at 1% a year is ₹100 a day; 2024 has 91 + 91 + 92 + 92 days.
		const charges = feeCharges(flat(3_650_000, { terms: [terms({ rate: 0.01 })] }));
		expect(charges).toEqual([
			{ date: "2024-03-31", amount: 9100, accrued: false },
			{ date: "2024-06-30", amount: 9100, accrued: false },
			{ date: "2024-09-30", amount: 9200, accrued: false },
			{ date: "2024-12-31", amount: 9200, accrued: false },
		]);
	});

	it("counts what has built up since the last bill, marked as not billed yet", () => {
		const charges = feeCharges(flat(3_650_000, { today: "2024-05-10", terms: [terms({ rate: 0.01 })] }));
		expect(charges).toEqual([
			{ date: "2024-03-31", amount: 9100, accrued: false },
			{ date: "2024-05-10", amount: 4000, accrued: true }, // 30 days of April + 10 of May
		]);
	});

	it("starts and stops with the arrangement; the last part-quarter is a final bill", () => {
		const charges = feeCharges(flat(3_650_000, { terms: [terms({ rate: 0.01, startsOn: "2024-03-22", endsOn: "2024-04-10" })] }));
		expect(charges).toEqual([
			{ date: "2024-03-31", amount: 1000, accrued: false },
			{ date: "2024-04-10", amount: 1000, accrued: false },
		]);
	});

	it("fixed: the yearly amount spread over the days", () => {
		const charges = feeCharges(flat(1, { today: "2024-03-31", terms: [terms({ kind: "fixed", amountPerYear: 36_500 })] }));
		expect(charges).toEqual([{ date: "2024-03-31", amount: 9100, accrued: false }]);
	});

	it("profit share: a share of the year's profit above the hurdle, each 31 March", () => {
		// ₹10,00,000 put in on 1 Apr 2023, worth ₹12,00,000 on 31 Mar 2024 (366 days, 2024 being a leap year).
		// Average value: taken as ₹10,00,000 all year except the last day, for a hand-checkable hurdle.
		const input: FeeInput = {
			terms: [terms({ kind: "profit_share", rate: 0.2, hurdleRate: 0.1, startsOn: "2023-04-01" })],
			payments: [],
			start: "2023-04-01",
			today: "2024-03-31",
			valueOn: (date) => (date < "2023-04-01" ? 0 : date === "2024-03-31" ? 1_200_000 : 1_000_000),
			flows: [{ date: "2023-04-01", amount: 1_000_000 }],
		};
		const average = (1_000_000 * 365 + 1_200_000) / 366;
		const hurdle = 0.1 * average * (366 / 365);
		const [charge] = feeCharges(input);
		expect(charge).toEqual({ date: "2024-03-31", amount: Math.round(0.2 * (200_000 - hurdle) * 100) / 100, accrued: false });
		// No profit above the hurdle, no fee.
		expect(feeCharges({ ...input, valueOn: (date) => (date < "2023-04-01" ? 0 : 1_050_000) })).toEqual([]);
		// Money put in is not profit.
		expect(
			feeCharges({
				...input,
				terms: [terms({ kind: "profit_share", rate: 0.2, hurdleRate: 0, startsOn: "2023-04-01" })],
				valueOn: (date) => (date < "2023-04-01" ? 0 : date < "2023-10-01" ? 1_000_000 : 1_500_000),
				flows: [
					{ date: "2023-04-01", amount: 1_000_000 },
					{ date: "2023-10-01", amount: 500_000 },
				],
			}),
		).toEqual([]);
	});

	it("invoiced: exactly what was paid, while the arrangement runs", () => {
		const charges = feeCharges(
			flat(5_000_000, {
				terms: [terms({ kind: "invoiced", startsOn: "2024-02-01" })],
				payments: [
					{ date: "2024-01-15", amount: 999 }, // before it started
					{ date: "2024-04-05", amount: 12_500 },
					{ date: "2024-10-05", amount: 13_000.5 },
				],
			}),
		);
		expect(charges).toEqual([
			{ date: "2024-04-05", amount: 12_500, accrued: false },
			{ date: "2024-10-05", amount: 13_000.5, accrued: false },
		]);
	});

	it("charges nothing before the account has anything in it", () => {
		expect(feeCharges(flat(0, { terms: [terms({ rate: 0.02 })] }))).toEqual([]);
	});
});
