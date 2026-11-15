import { addDays } from "@backend/modules/metrics/services/dates.metrics";

// What a fund manager's arrangement comes to, day by day — pure arithmetic,
// no database. The charges are counted against the return as money the
// holder paid from outside the account.
//
// The rules, chosen to be the ones a person can check by hand:
//  - percent of assets: the yearly rate on each day's closing value, ÷ 365,
//    billed at each calendar quarter end (31 Mar, 30 Jun, 30 Sep, 31 Dec)
//  - fixed: the yearly amount ÷ 365 for each day, billed the same way
//  - profit share: at each 31 March, the share of that financial year's
//    profit above the hurdle. Profit is value at the end − value at the start
//    − money put in + money taken out (dividends count as taken out). The
//    hurdle is the hurdle rate on the average daily value, for the days
//    covered. No carry-forward of a bad year (no high-water mark).
//  - invoiced: exactly the payments entered.
// What has built up since the last bill is counted too, marked `accrued`, so
// a return is never flattered by a bill that has not arrived yet.

export interface FeeTerms {
	kind: "percent_of_assets" | "fixed" | "profit_share" | "invoiced";
	rate: number | null;
	amountPerYear: number | null;
	hurdleRate: number | null;
	startsOn: string;
	endsOn: string | null;
}

export interface FeeCharge {
	date: string;
	amount: number;
	accrued: boolean;
}

export interface FeeInput {
	terms: readonly FeeTerms[];
	/** Payments entered, for invoiced arrangements. */
	payments: readonly { date: string; amount: number }[];
	/** The account's first day, and today. */
	start: string;
	today: string;
	/** The account's value at the end of a day (0 before it starts). */
	valueOn: (date: string) => number;
	/** Money in (+) and out (−) of the account, for the profit share. */
	flows: readonly { date: string; amount: number }[];
}

const isQuarterEnd = (date: string): boolean => ["03-31", "06-30", "09-30", "12-31"].includes(date.slice(5));
const isYearEnd = (date: string): boolean => date.slice(5) === "03-31";
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function feeCharges(input: FeeInput): FeeCharge[] {
	const charges: FeeCharge[] = [];
	for (const terms of input.terms) {
		const from = terms.startsOn > input.start ? terms.startsOn : input.start;
		const until = terms.endsOn !== null && terms.endsOn < input.today ? terms.endsOn : input.today;
		if (from > until) continue;
		// Still running on its last day: what has built up is not billed yet.
		const open = terms.endsOn === null || terms.endsOn > input.today;

		if (terms.kind === "invoiced") {
			for (const p of input.payments)
				if (p.date >= terms.startsOn && p.date <= until) charges.push({ date: p.date, amount: round2(p.amount), accrued: false });
			continue;
		}

		if (terms.kind === "percent_of_assets" || terms.kind === "fixed") {
			let built = 0;
			for (let day = from; day <= until; day = addDays(day, 1)) {
				built +=
					terms.kind === "percent_of_assets"
						? (Math.max(0, input.valueOn(day)) * (terms.rate ?? 0)) / 365
						: (terms.amountPerYear ?? 0) / 365;
				const billed = isQuarterEnd(day);
				if (billed || day === until) {
					if (round2(built) > 0) charges.push({ date: day, amount: round2(built), accrued: !billed && open });
					built = 0;
				}
			}
			continue;
		}

		// Profit share, one financial year at a time.
		let segmentStart = from;
		let sum = 0;
		let days = 0;
		for (let day = from; day <= until; day = addDays(day, 1)) {
			sum += Math.max(0, input.valueOn(day));
			days++;
			const billed = isYearEnd(day);
			if (!billed && day !== until) continue;
			const opening = input.valueOn(addDays(segmentStart, -1));
			const closing = input.valueOn(day);
			const net = input.flows.reduce((total, f) => (f.date >= segmentStart && f.date <= day ? total + f.amount : total), 0);
			const profit = closing - opening - net;
			const hurdle = (terms.hurdleRate ?? 0) * (sum / days) * (days / 365);
			const fee = round2((terms.rate ?? 0) * Math.max(0, profit - hurdle));
			if (fee > 0) charges.push({ date: day, amount: fee, accrued: !billed && open });
			segmentStart = addDays(day, 1);
			sum = 0;
			days = 0;
		}
	}
	return charges.sort((a, b) => a.date.localeCompare(b.date));
}
