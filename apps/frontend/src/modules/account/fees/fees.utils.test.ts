import type { FeeArrangement } from "@connected-repo/zod-schemas/kosh/income.zod";
import { feeSetInputZod } from "@connected-repo/zod-schemas/kosh/income.zod";
import { describe, expect, it } from "vitest";
import {
	againstBenchmarkWords,
	amountWords,
	arrangementSentence,
	builtUpSince,
	chargeKind,
	datesWords,
	dayAfter,
	dayBefore,
	type FeeForm,
	feeEffectWords,
	feeFormFrom,
	feePointsTaken,
	feeSetInput,
	fractionToPercentText,
	howWorkedOut,
	isBillDay,
	isDay,
	newestFirst,
	parseAmount,
	paymentCounted,
	percentToFraction,
	pointsWords,
	rateWords,
	refusalWords,
	splitEarlier,
	stopDays,
	stopProblem,
	termsWords,
	todayInIndia,
	whatChanges,
	whatChangesWords,
} from "./fees.utils";

const TODAY = "2026-11-16";

const arrangement = (over: Partial<FeeArrangement> = {}): FeeArrangement => ({
	id: "a1",
	kind: "percent_of_assets",
	payee: "Ramesh Iyer",
	rate: 0.015,
	amountPerYear: null,
	hurdleRate: null,
	startsOn: "2024-04-01",
	endsOn: null,
	...over,
});

const percent = arrangement();
const fixed = arrangement({ id: "a2", kind: "fixed", rate: null, amountPerYear: "120000.00" });
const profit = arrangement({ id: "a3", kind: "profit_share", rate: 0.2, hurdleRate: 0.08 });
const invoiced = arrangement({ id: "a4", kind: "invoiced", rate: null });

describe("days", () => {
	it("takes today from India, whatever the clock here says", () => {
		// 20:00 UTC on the 15th is 01:30 on the 16th in India.
		expect(todayInIndia(new Date("2026-11-15T20:00:00Z"))).toBe("2026-11-16");
		expect(todayInIndia(new Date("2026-11-15T10:00:00Z"))).toBe("2026-11-15");
	});

	it("knows a whole calendar date from anything else", () => {
		expect(isDay("2024-02-29")).toBe(true);
		expect(isDay("2025-02-29")).toBe(false);
		expect(isDay("2024-4-1")).toBe(false);
		expect(isDay("")).toBe(false);
	});

	it("steps a day back and forward across months and years", () => {
		expect(dayBefore("2024-04-01")).toBe("2024-03-31");
		expect(dayBefore("2025-01-01")).toBe("2024-12-31");
		expect(dayAfter("2024-02-28")).toBe("2024-02-29");
		expect(dayAfter("2026-12-31")).toBe("2027-01-01");
	});
});

describe("a rate as a person types it ↔ the fraction the API takes", () => {
	it("turns a percentage into a fraction", () => {
		expect(percentToFraction("1.5")).toEqual({ ok: true, value: 0.015 });
		expect(percentToFraction("20")).toEqual({ ok: true, value: 0.2 });
		expect(percentToFraction("100")).toEqual({ ok: true, value: 1 });
		expect(percentToFraction(".75")).toEqual({ ok: true, value: 0.0075 });
		expect(percentToFraction("2.")).toEqual({ ok: true, value: 0.02 });
	});

	it("forgives a percent sign and spaces", () => {
		expect(percentToFraction(" 1.5 % ")).toEqual({ ok: true, value: 0.015 });
	});

	it("sends a clean fraction, not floating-point dust", () => {
		// 1.1 / 100 is 0.011000000000000001.
		expect(percentToFraction("1.1")).toEqual({ ok: true, value: 0.011 });
		expect(percentToFraction("0.07")).toEqual({ ok: true, value: 0.0007 });
		expect(percentToFraction("1.2345")).toEqual({ ok: true, value: 0.012345 });
	});

	it("says what is wrong instead of guessing", () => {
		expect(percentToFraction("")).toEqual({ ok: false, problem: "empty" });
		expect(percentToFraction("   ")).toEqual({ ok: false, problem: "empty" });
		expect(percentToFraction("abc")).toEqual({ ok: false, problem: "not_a_number" });
		expect(percentToFraction("1,5")).toEqual({ ok: false, problem: "not_a_number" });
		expect(percentToFraction("-2")).toEqual({ ok: false, problem: "not_a_number" });
		expect(percentToFraction("1e2")).toEqual({ ok: false, problem: "not_a_number" });
		expect(percentToFraction("0")).toEqual({ ok: false, problem: "zero" });
		expect(percentToFraction("0.0")).toEqual({ ok: false, problem: "zero" });
		expect(percentToFraction("100.01")).toEqual({ ok: false, problem: "too_big" });
		expect(percentToFraction("150")).toEqual({ ok: false, problem: "too_big" });
		expect(percentToFraction("1.23456")).toEqual({ ok: false, problem: "too_fine" });
	});

	it("lets a hurdle be zero", () => {
		expect(percentToFraction("0", { allowZero: true })).toEqual({ ok: true, value: 0 });
		expect(percentToFraction("8", { allowZero: true })).toEqual({ ok: true, value: 0.08 });
	});

	it("turns a fraction back into what a person would type", () => {
		expect(fractionToPercentText(0.015)).toBe("1.5");
		expect(fractionToPercentText(0.2)).toBe("20");
		expect(fractionToPercentText(0.0125)).toBe("1.25");
		expect(fractionToPercentText(0.011)).toBe("1.1");
		expect(fractionToPercentText(1)).toBe("100");
	});

	it("comes back the same after a round trip", () => {
		for (const typed of ["1.5", "20", "0.75", "1.25", "2.5", "12.345", "100", "0.0001"]) {
			const fraction = percentToFraction(typed);
			expect(fraction.ok && fractionToPercentText(fraction.value)).toBe(typed);
		}
	});

	it("writes a rate without rounding it away", () => {
		expect(rateWords(0.015)).toBe("1.5%");
		expect(rateWords(0.2)).toBe("20%");
		expect(rateWords(0.0125)).toBe("1.25%");
		expect(rateWords(0.012345)).toBe("1.2345%");
		expect(rateWords(1)).toBe("100%");
	});
});

describe("an amount as a person types it", () => {
	it("takes rupees with or without commas, the sign and paise", () => {
		expect(parseAmount("120000")).toEqual({ ok: true, value: "120000" });
		expect(parseAmount("1,20,000")).toEqual({ ok: true, value: "120000" });
		expect(parseAmount("₹ 6,420.50")).toEqual({ ok: true, value: "6420.50" });
		expect(parseAmount("6420.5")).toEqual({ ok: true, value: "6420.5" });
		expect(parseAmount("007")).toEqual({ ok: true, value: "7" });
		expect(parseAmount("0.50")).toEqual({ ok: true, value: "0.50" });
	});

	it("says what is wrong", () => {
		expect(parseAmount("")).toEqual({ ok: false, problem: "empty" });
		expect(parseAmount("lots")).toEqual({ ok: false, problem: "not_an_amount" });
		expect(parseAmount("12.345")).toEqual({ ok: false, problem: "not_an_amount" });
		expect(parseAmount("-5")).toEqual({ ok: false, problem: "not_an_amount" });
		expect(parseAmount("1234567890123456")).toEqual({ ok: false, problem: "not_an_amount" });
		expect(parseAmount("0")).toEqual({ ok: false, problem: "zero" });
		expect(parseAmount("0.00")).toEqual({ ok: false, problem: "zero" });
	});

	it("writes an amount with paise only when there are some", () => {
		expect(amountWords("120000.00")).toBe("₹1,20,000");
		expect(amountWords("27500.50")).toBe("₹27,500.50");
	});
});

describe("the form → what the API is sent", () => {
	const form = (over: Partial<FeeForm> = {}): FeeForm => ({
		kind: "percent_of_assets",
		rate: "1.5",
		amount: "",
		share: "",
		hurdle: "",
		payee: " Ramesh Iyer ",
		startsOn: "2024-04-01",
		...over,
	});

	it("sends a percentage of assets as a fraction, with only its own fields", () => {
		expect(feeSetInput("acc", form())).toEqual({
			ok: true,
			input: {
				accountId: "acc",
				kind: "percent_of_assets",
				rate: 0.015,
				payee: "Ramesh Iyer",
				startsOn: "2024-04-01",
			},
		});
	});

	it("sends a fixed amount, and nothing left over from another kind", () => {
		const built = feeSetInput("acc", form({ kind: "fixed", amount: "1,20,000", rate: "1.5", share: "20" }));
		expect(built).toEqual({
			ok: true,
			input: { accountId: "acc", kind: "fixed", amountPerYear: "120000", payee: "Ramesh Iyer", startsOn: "2024-04-01" },
		});
	});

	it("sends a profit share with its hurdle, and no hurdle typed means none", () => {
		expect(feeSetInput("acc", form({ kind: "profit_share", share: "20", hurdle: "8", payee: "" }))).toEqual({
			ok: true,
			input: { accountId: "acc", kind: "profit_share", rate: 0.2, hurdleRate: 0.08, startsOn: "2024-04-01" },
		});
		const none = feeSetInput("acc", form({ kind: "profit_share", share: "20", hurdle: " " }));
		expect(none.ok && none.input.hurdleRate).toBe(0);
	});

	it("sends an invoice arrangement with no figures at all", () => {
		expect(feeSetInput("acc", form({ kind: "invoiced", rate: "1.5", payee: "" }))).toEqual({
			ok: true,
			input: { accountId: "acc", kind: "invoiced", startsOn: "2024-04-01" },
		});
	});

	it("puts the reason under each field that cannot be sent", () => {
		const built = feeSetInput("acc", form({ rate: "", startsOn: "" }));
		expect(built).toEqual({
			ok: false,
			problems: { rate: "Give the yearly rate, like 1.5.", startsOn: "Choose the day it starts." },
		});
		const share = feeSetInput("acc", form({ kind: "profit_share", share: "", hurdle: "200" }));
		expect(share).toEqual({
			ok: false,
			problems: { share: "Give the share of the profit, like 20.", hurdle: "It can’t be more than 100%." },
		});
		const amount = feeSetInput("acc", form({ kind: "fixed", amount: "0" }));
		expect(amount).toEqual({ ok: false, problems: { amount: "The amount has to be more than zero." } });
	});

	it("builds only what the server's own contract accepts", () => {
		const forms = [
			form(),
			form({ kind: "fixed", amount: "₹1,20,000.50" }),
			form({ kind: "profit_share", share: "20", hurdle: "" }),
			form({ kind: "profit_share", share: "12.5", hurdle: "0" }),
			form({ kind: "invoiced", payee: "" }),
		];
		for (const each of forms) {
			const built = feeSetInput("acc", each);
			expect(built.ok && feeSetInputZod.safeParse(built.input).success).toBe(true);
		}
	});

	it("starts a change from the arrangement that is there, from today", () => {
		expect(feeFormFrom(null, TODAY)).toEqual({
			kind: "percent_of_assets",
			rate: "",
			amount: "",
			share: "",
			hurdle: "",
			payee: "",
			startsOn: TODAY,
		});
		expect(feeFormFrom(percent, TODAY)).toMatchObject({ kind: "percent_of_assets", rate: "1.5", payee: "Ramesh Iyer" });
		expect(feeFormFrom(fixed, TODAY)).toMatchObject({ kind: "fixed", amount: "120000", rate: "" });
		expect(feeFormFrom(profit, TODAY)).toMatchObject({ kind: "profit_share", share: "20", hurdle: "8" });
		expect(feeFormFrom(arrangement({ kind: "profit_share", rate: 0.2, hurdleRate: 0 }), TODAY).hurdle).toBe("");
		expect(feeFormFrom(arrangement({ ...invoiced, payee: null }), TODAY)).toMatchObject({ kind: "invoiced", payee: "" });
	});
});

describe("the arrangement as a sentence", () => {
	it("has one form for each kind", () => {
		expect(arrangementSentence(percent, TODAY)).toBe(
			"1.5% of the account’s value a year, paid to Ramesh Iyer, since 1 Apr 2024",
		);
		expect(arrangementSentence(fixed, TODAY)).toBe("₹1,20,000 a year, paid to Ramesh Iyer, since 1 Apr 2024");
		expect(arrangementSentence(profit, TODAY)).toBe(
			"20% of each year’s profit above a hurdle of 8%, paid to Ramesh Iyer, since 1 Apr 2024",
		);
		expect(arrangementSentence(invoiced, TODAY)).toBe("Paid by invoice to Ramesh Iyer, since 1 Apr 2024");
	});

	it("leaves out who is paid when no name was given", () => {
		expect(termsWords(arrangement({ payee: null }))).toBe("1.5% of the account’s value a year");
		expect(termsWords(arrangement({ ...invoiced, payee: null }))).toBe("Paid by invoice");
	});

	it("leaves out a hurdle of nothing", () => {
		expect(termsWords(arrangement({ kind: "profit_share", rate: 0.2, hurdleRate: 0, payee: null }))).toBe(
			"20% of each year’s profit",
		);
		expect(termsWords(arrangement({ kind: "profit_share", rate: 0.2, hurdleRate: null, payee: null }))).toBe(
			"20% of each year’s profit",
		);
	});

	it("keeps a rate or an amount exactly as it was set", () => {
		expect(termsWords(arrangement({ rate: 0.0125, payee: null }))).toBe("1.25% of the account’s value a year");
		expect(termsWords(arrangement({ ...fixed, amountPerYear: "6420.50", payee: null }))).toBe("₹6,420.50 a year");
	});

	it("says when it runs", () => {
		const dates = (startsOn: string, endsOn: string | null) => datesWords({ startsOn, endsOn }, TODAY);
		expect(dates("2024-04-01", null)).toBe("since 1 Apr 2024");
		expect(dates(TODAY, null)).toBe("since 16 Nov 2026");
		expect(dates("2024-04-01", "2026-12-31")).toBe("since 1 Apr 2024, until 31 Dec 2026");
		expect(dates("2024-04-01", TODAY)).toBe("since 1 Apr 2024, ending today");
		// Over: its dates, from and to.
		expect(dates("2024-04-01", "2025-09-30")).toBe("from 1 Apr 2024 to 30 Sept 2025");
		expect(dates("2024-04-01", "2024-04-01")).toBe("on 1 Apr 2024 only");
		// Not started yet.
		expect(dates("2027-01-01", null)).toBe("from 1 Jan 2027");
		expect(dates("2027-01-01", "2027-03-31")).toBe("from 1 Jan 2027 to 31 Mar 2027");
	});
});

describe("how each kind is worked out", () => {
	it("says the quarter ends for a percentage and for a fixed amount, and that what has built up counts", () => {
		const words = howWorkedOut(percent);
		expect(words[0]).toContain("a 365th of the yearly rate");
		expect(words[0]).toContain("31 Mar, 30 Jun, 30 Sept and 31 Dec");
		expect(words[1]).toContain("built up since the last bill");
		expect(howWorkedOut(fixed)[0]).toContain("31 Mar, 30 Jun, 30 Sept and 31 Dec");
	});

	it("says a profit share is settled each 31 March with no carry-forward, and its hurdle when it has one", () => {
		const words = howWorkedOut(profit);
		expect(words[0]).toContain("Settled each 31 Mar");
		expect(words[0]).toContain("not carried forward");
		expect(words[1]).toBe("The hurdle is 8% a year on the account’s average daily value, in proportion for a part year.");
		expect(howWorkedOut({ kind: "profit_share", hurdleRate: 0 })).toHaveLength(2);
	});

	it("says an invoice arrangement works nothing out", () => {
		expect(howWorkedOut(invoiced)).toEqual([
			"Nothing is worked out. Exactly the payments entered are counted, each on the day it was paid.",
		]);
	});
});

describe("what is there already", () => {
	const earlier = arrangement({ id: "old", startsOn: "2023-10-01", endsOn: "2024-03-31" });
	const next = arrangement({ id: "next", startsOn: "2027-01-01" });
	const running = arrangement({ endsOn: "2026-12-31" });

	it("keeps a change entered for a later day apart from what came before", () => {
		expect(splitEarlier([next, earlier], TODAY)).toEqual({ upcoming: [next], past: [earlier] });
		expect(splitEarlier([], TODAY)).toEqual({ upcoming: [], past: [] });
	});

	it("follows the server's rule for what a new arrangement does to the others", () => {
		const all = [next, running, earlier];
		// From today: the running one is cut short, the later one replaced, the old one untouched.
		expect(whatChanges(all, TODAY)).toEqual({ cutShort: [running], replaced: [next] });
		// From the day the running one started (or before): it is replaced outright.
		expect(whatChanges(all, "2024-04-01")).toEqual({ cutShort: [], replaced: [next, running] });
		expect(whatChanges(all, "2024-01-01")).toEqual({ cutShort: [earlier], replaced: [next, running] });
		// A day on which nothing runs, after everything: nothing is touched.
		expect(whatChanges([earlier], "2025-01-01")).toEqual({ cutShort: [], replaced: [] });
	});

	it("says it before saving", () => {
		expect(whatChangesWords([], TODAY)).toBeNull();
		expect(whatChangesWords([percent], "not a day")).toBeNull();
		expect(whatChangesWords([percent], TODAY)).toBe(
			"Up to 15 Nov 2026 nothing changes: it stays 1.5% of the account’s value a year, paid to Ramesh Iyer. This takes over the day after.",
		);
		expect(whatChangesWords([invoiced], TODAY)).toContain("it stays paid by invoice to Ramesh Iyer.");
		expect(whatChangesWords([percent], "2024-04-01")).toBe(
			"The arrangement starting on or after 1 Apr 2024 is replaced by this one, and the fee from that day is worked out again.",
		);
		expect(whatChangesWords([next, running], "2024-01-01")).toBe(
			"The 2 arrangements starting on or after 1 Jan 2024 are replaced by this one, and the fee from that day is worked out again.",
		);
		expect(whatChangesWords([earlier], "2025-01-01")).toBe("Earlier arrangements stay as they are.");
	});

	it("counts a payment only while an invoice arrangement runs", () => {
		const invoice = arrangement({ ...invoiced, startsOn: "2026-04-01", endsOn: "2026-11-15" });
		const all = [invoice, arrangement({ endsOn: "2026-03-31" })];
		expect(paymentCounted({ paidOn: "2026-04-01" }, all)).toBe(true);
		expect(paymentCounted({ paidOn: "2026-11-15" }, all)).toBe(true);
		expect(paymentCounted({ paidOn: "2026-03-31" }, all)).toBe(false);
		expect(paymentCounted({ paidOn: "2026-11-16" }, all)).toBe(false);
		expect(paymentCounted({ paidOn: "2026-07-05" }, [])).toBe(false);
	});

	it("offers today as the last day, kept inside the arrangement's own dates", () => {
		expect(stopDays({ startsOn: "2024-04-01", endsOn: null }, TODAY)).toEqual({
			earliest: "2024-04-01",
			latest: null,
			offered: TODAY,
		});
		expect(stopDays({ startsOn: "2027-01-01", endsOn: null }, TODAY).offered).toBe("2027-01-01");
		expect(stopDays({ startsOn: "2024-04-01", endsOn: "2026-06-30" }, TODAY).offered).toBe("2026-06-30");
	});

	it("says why a day cannot be the last day", () => {
		const running = { startsOn: "2026-04-01", endsOn: "2026-11-16" };
		expect(stopProblem("2026-11-15", running)).toBeNull();
		expect(stopProblem("2026-04-01", running)).toBeNull();
		expect(stopProblem("", running)).toBe("Choose the last day it is charged.");
		expect(stopProblem("2026-03-01", running)).toBe("It started on 1 Apr 2026, so it can’t stop before then.");
		expect(stopProblem("2026-12-01", running)).toBe(
			"It already stops after 16 Nov 2026. Choose that day or an earlier one.",
		);
		expect(stopProblem("2030-01-01", { startsOn: "2026-04-01", endsOn: null })).toBeNull();
	});
});

describe("charges", () => {
	it("lists the newest first without touching what the server sent", () => {
		const charges = [
			{ date: "2024-06-30", amount: "812.77", accrued: false },
			{ date: "2026-11-16", amount: "674.93", accrued: true },
			{ date: "2024-09-30", amount: "867.63", accrued: false },
		];
		expect(newestFirst(charges).map((c) => c.date)).toEqual(["2026-11-16", "2024-09-30", "2024-06-30"]);
		expect(charges[0]?.date).toBe("2024-06-30");
	});

	it("knows the days a kind bills on anyway", () => {
		expect(isBillDay("2025-03-31", "fixed")).toBe(true);
		expect(isBillDay("2025-09-30", "percent_of_assets")).toBe(true);
		expect(isBillDay("2025-09-30", "profit_share")).toBe(false);
		expect(isBillDay("2025-03-31", "profit_share")).toBe(true);
		expect(isBillDay("2025-03-31", "invoiced")).toBe(false);
		expect(isBillDay("2025-11-16", "fixed")).toBe(false);
	});

	it("says from which day the unbilled part has built up", () => {
		// The day after the last quarter end…
		expect(builtUpSince("2026-11-16", percent)).toBe("2026-10-01");
		expect(builtUpSince("2026-02-10", fixed)).toBe("2026-01-01");
		// …or the day it started, if that is later.
		expect(builtUpSince("2026-11-16", arrangement({ startsOn: "2026-11-01" }))).toBe("2026-11-01");
		// A profit share builds up from 1 April.
		expect(builtUpSince("2026-11-16", profit)).toBe("2026-04-01");
		expect(builtUpSince("2026-02-10", profit)).toBe("2025-04-01");
		// On a bill day itself, the period is the one that ends that day.
		expect(builtUpSince("2026-09-30", percent)).toBe("2026-07-01");
		expect(builtUpSince("2026-11-16", invoiced)).toBeNull();
	});

	it("reads what a charge is off the arrangements and payments beside it", () => {
		const old = arrangement({ ...fixed, startsOn: "2023-10-01", endsOn: "2025-05-15" });
		const invoice = arrangement({ ...invoiced, startsOn: "2026-04-01" });
		const payments = [{ paidOn: "2026-10-06", amount: "27500.50" }];
		const kind = (date: string, amount: string, accrued = false) =>
			chargeKind({ date, amount, accrued }, [invoice, old], payments);

		expect(kind("2024-12-31", "30246.58")).toEqual({ what: "bill" });
		expect(kind("2025-05-15", "14794.52")).toEqual({ what: "last_of_arrangement" });
		expect(kind("2026-10-06", "27500.50")).toEqual({ what: "payment" });
		// The same day but another amount is not that payment — and with a payment that day, nothing is guessed.
		expect(kind("2026-10-06", "100.00")).toEqual({ what: "bill" });

		expect(chargeKind({ date: "2026-11-16", amount: "674.93", accrued: true }, [percent], [])).toEqual({
			what: "built_up",
			since: "2026-10-01",
		});
		expect(chargeKind({ date: "2026-11-16", amount: "674.93", accrued: true }, [], [])).toEqual({
			what: "built_up",
			since: null,
		});
	});

	it("does not call an ordinary quarter end the last charge of an arrangement that ended on it", () => {
		const old = arrangement({ ...fixed, startsOn: "2023-10-01", endsOn: "2025-03-31" });
		expect(chargeKind({ date: "2025-03-31", amount: "29589.04", accrued: false }, [old], [])).toEqual({ what: "bill" });
	});
});

describe("before and after fees", () => {
	it("writes a difference in percentage points", () => {
		expect(pointsWords(0.0165)).toBe("1.7 pts");
		expect(pointsWords(-0.058)).toBe("5.8 pts");
		expect(feePointsTaken(0.141, 0.125)).toBeCloseTo(0.016);
		expect(feePointsTaken(null, 0.125)).toBeNull();
		expect(feePointsTaken(0.141, null)).toBeNull();
	});

	it("says what fees have taken off the yearly return", () => {
		expect(feeEffectWords(0.14123863455162755, 0.1246911918432463)).toBe("Fees have taken 1.7 pts a year off the return.");
		expect(feeEffectWords(0.199, 0.106)).toBe("Fees have taken 9.3 pts a year off the return.");
	});

	it("does not print a difference of 0.0", () => {
		expect(feeEffectWords(0.1412, 0.1409)).toBe("So far fees have made no difference you can see in the yearly return.");
		expect(feeEffectWords(0.1, 0.1)).toBe("So far fees have made no difference you can see in the yearly return.");
	});

	it("says so when a return cannot be worked out, never a zero", () => {
		const unknown =
			"A yearly return can’t be worked out for this account yet, so neither can the difference fees make.";
		expect(feeEffectWords(null, 0.12)).toBe(unknown);
		expect(feeEffectWords(0.14, null)).toBe(unknown);
	});

	it("still reads right if the return came out higher after fees", () => {
		expect(feeEffectWords(0.1, 0.105)).toBe("The return is 0.5 pts a year higher after fees.");
	});

	it("says what it does to the lead over NIFTY, ahead or behind", () => {
		expect(againstBenchmarkWords(0.0788, 0.0622, "NIFTY 50")).toBe(
			"Before fees this account was 7.9 pts a year ahead of NIFTY 50; after, 6.2 pts ahead.",
		);
		expect(againstBenchmarkWords(0.005, -0.012, "NIFTY 50")).toBe(
			"Before fees this account was 0.5 pts a year ahead of NIFTY 50; after, 1.2 pts behind.",
		);
		expect(againstBenchmarkWords(-0.02, -0.035, "NIFTY 50")).toBe(
			"Before fees this account was 2.0 pts a year behind NIFTY 50; after, 3.5 pts behind.",
		);
		expect(againstBenchmarkWords(0.0001, -0.01, "NIFTY 50")).toBe(
			"Before fees this account was level with NIFTY 50; after, 1.0 pts behind.",
		);
		expect(againstBenchmarkWords(null, 0.06, "NIFTY 50")).toBeNull();
		expect(againstBenchmarkWords(0.07, null, "NIFTY 50")).toBeNull();
	});
});

describe("a refusal, in the server's own words", () => {
	it("uses the server's message for a refusal it explains", () => {
		const refusal = { code: "BAD_REQUEST", status: 400, message: "There is no arrangement running on that day." };
		expect(refusalWords(refusal, "fallback")).toBe("There is no arrangement running on that day.");
	});

	it("reads the reason under a field when the message is only “Validation failed”", () => {
		const refusal = {
			code: "BAD_REQUEST",
			status: 400,
			message: "Validation failed",
			data: { fieldErrors: { endsOn: ["It can’t end before it starts."] }, formErrors: [] },
		};
		expect(refusalWords(refusal, "fallback")).toBe("It can’t end before it starts.");
	});

	it("falls back to a plain line for anything else", () => {
		expect(refusalWords({ code: "INTERNAL_SERVER_ERROR", status: 500, message: "boom" }, "Couldn’t save the fee.")).toBe(
			"Couldn’t save the fee.",
		);
		expect(refusalWords(new TypeError("Failed to fetch"), "fallback")).toBe(
			"Couldn’t reach Kosh. Check your connection and try again.",
		);
	});
});
