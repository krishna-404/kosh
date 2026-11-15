import type { GroupsCompared, Holding, Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import type { Directory, DirectoryAccount, Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { describe, expect, it } from "vitest";
import {
	accountsInScope,
	aheadSentence,
	dayPart,
	firstToUpload,
	hasFigure,
	heldInLine,
	isMixed,
	largest,
	movedChart,
	peopleIn,
	pointsOf,
	primaryBenchmark,
	sentenceText,
	standingOf,
	standingTone,
	topGroups,
	topMovers,
} from "./overview.utils";

type Moved = Returns["moved"];
type Benchmark = Returns["benchmarks"][number];

const moved = (over: Partial<Moved> = {}): Moved => ({
	opening: "0.00",
	putIn: "2600000.00",
	takenOut: "325000.00",
	priceGains: "1034754.09",
	dividends: "0.00",
	interest: "0.00",
	fees: "4079.72",
	closing: "3305674.37",
	...over,
});

const benchmark = (over: Partial<Benchmark> = {}): Benchmark => ({
	slug: "nifty50",
	name: "NIFTY 50",
	proxy: "the NAV of a NIFTY 50 index fund",
	value: "3104537.64",
	xirr: 0.099,
	ahead: "201136.73",
	availableFrom: null,
	...over,
});
const gold = (over: Partial<Benchmark> = {}): Benchmark =>
	benchmark({ slug: "gold", name: "Gold", proxy: "the NAV of a gold fund", ...over });

const holding = (name: string, effect: string | null, over: Partial<Holding> = {}): Holding => ({
	instrumentId: `id-${name}`,
	symbol: name,
	name,
	isin: null,
	assetClass: "stocks",
	quantity: "10",
	price: "100",
	priceDate: "2026-11-13",
	value: "1000.00",
	weight: 0.1,
	invested: "900.00",
	gain: "100.00",
	xirr: 0.12,
	benchmarkXirr: 0.1,
	benchmarkValue: "950.00",
	effect,
	heldIn: [],
	sold: false,
	...over,
});

const groupRow = (
	name: string,
	aheadPoints: number | null,
	over: Partial<GroupsCompared["groups"][number]> = {},
): GroupsCompared["groups"][number] => ({
	groupId: `g-${name}`,
	name,
	kind: null,
	accounts: 1,
	value: "100000.00",
	xirr: 0.1,
	benchmarkXirr: 0.09,
	aheadPoints,
	aheadAmount: null,
	shortHistory: false,
	yearsAhead: 0,
	yearsCounted: 0,
	...over,
});

const account = (id: string, personId: string, myLevel: DirectoryAccount["myLevel"] = "owner"): DirectoryAccount => ({
	id,
	personId,
	label: id,
	broker: "zerodha",
	brokerName: null,
	baseCurrency: "INR",
	createdAt: 0,
	myLevel,
	via: "account",
	myGrantId: `grant-${id}`,
	sharedBy: null,
	isNew: false,
	access: null,
	value: null,
	xirr: null,
	benchmarkXirr: null,
	updated: null,
	questionsWaiting: 0,
});

const directory: Directory = {
	me: { userId: "u1", name: "Anil Mehta", email: "anil@example.com" },
	holders: [],
	accounts: [account("a1", "anil", "view"), account("a2", "anil"), account("a3", "kabir"), account("a4", "huf")],
};
const groups: Group[] = [{ id: "g1", name: "Kids", kind: "family", accountIds: ["a3", "a4", "gone"], createdAt: 0 }];

describe("the greeting", () => {
	it("follows the time of day", () => {
		expect([5, 11].map(dayPart)).toEqual(["morning", "morning"]);
		expect([12, 16].map(dayPart)).toEqual(["afternoon", "afternoon"]);
		expect([17, 23, 0, 4].map(dayPart)).toEqual(["evening", "evening", "evening", "evening"]);
	});
});

describe("which accounts a selection covers", () => {
	it("reads everything, a person, an account and a group from the directory", () => {
		expect(accountsInScope({ kind: "everything" }, directory, groups)?.map((a) => a.id)).toEqual(["a1", "a2", "a3", "a4"]);
		expect(accountsInScope({ kind: "holder", id: "anil" }, directory, groups)?.map((a) => a.id)).toEqual(["a1", "a2"]);
		expect(accountsInScope({ kind: "account", id: "a3" }, directory, groups)?.map((a) => a.id)).toEqual(["a3"]);
		// An account the group still names but the person can no longer see is not counted.
		expect(accountsInScope({ kind: "group", id: "g1" }, directory, groups)?.map((a) => a.id)).toEqual(["a3", "a4"]);
	});

	it("is unknown until the directory (and, for a group, the groups) are there", () => {
		expect(accountsInScope({ kind: "everything" }, undefined, groups)).toBeNull();
		expect(accountsInScope({ kind: "group", id: "g1" }, directory, undefined)).toBeNull();
		expect(accountsInScope({ kind: "group", id: "nope" }, directory, groups)).toBeNull();
	});

	it("counts the people the accounts belong to", () => {
		expect(peopleIn(directory.accounts)).toBe(3);
		expect(peopleIn(accountsInScope({ kind: "holder", id: "anil" }, directory, groups))).toBe(1);
		expect(peopleIn(null)).toBeNull();
	});

	it("offers the upload on the first account the person can edit", () => {
		expect(firstToUpload(directory.accounts)?.id).toBe("a2");
		expect(firstToUpload([account("v", "p", "view")])).toBeNull();
		expect(firstToUpload(null)).toBeNull();
	});
});

describe("how the money moved", () => {
	const keys = (m: Moved) => movedChart(m).rows.map((row) => row.key);

	it("from the very start: put in, what moved it, value today — nothing that came to zero", () => {
		expect(keys(moved())).toEqual(["putIn", "takenOut", "priceGains", "fees", "closing"]);
		expect(keys(moved({ dividends: "12000.00", interest: "350.10" }))).toEqual([
			"putIn",
			"takenOut",
			"priceGains",
			"dividends",
			"interest",
			"fees",
			"closing",
		]);
	});

	it("keeps Put in and Value today even at zero, and adds the opening value for a later start", () => {
		const oneYear = moved({
			opening: "3349885.09",
			putIn: "0.00",
			takenOut: "0.00",
			priceGains: "-43945.22",
			fees: "265.50",
		});
		expect(keys(oneYear)).toEqual(["opening", "putIn", "priceGains", "fees", "closing"]);
		expect(keys(moved({ putIn: "0.00", takenOut: "0.00", priceGains: "0.00", fees: "0.00", closing: "0.00" }))).toEqual([
			"putIn",
			"closing",
		]);
	});

	it("leaves out a step that would show as ₹0", () => {
		expect(keys(moved({ fees: "0.40" }))).not.toContain("fees");
		expect(keys(moved({ fees: "0.50" }))).toContain("fees");
	});

	it("signs each step by what it did to the value", () => {
		const { rows } = movedChart(moved({ opening: "100.00", putIn: "50.00", priceGains: "-20.00", closing: "0" }));
		expect(Object.fromEntries(rows.map((row) => [row.key, row.amount]))).toMatchObject({
			opening: 100,
			putIn: 50,
			takenOut: -325000,
			priceGains: -20,
			fees: -4079.72,
		});
	});

	it("stands levels on the ground and floats each step from where the last one ended", () => {
		const { rows, zero } = movedChart(
			moved({ putIn: "100.00", takenOut: "20.00", priceGains: "40.00", fees: "20.00", closing: "100.00" }),
		);
		// The tallest point is 120 (after the gains): that is the full height.
		const at = Object.fromEntries(rows.map((row) => [row.key, row]));
		expect(zero).toBe(0);
		expect(at.putIn).toMatchObject({ level: true, start: 0 });
		expect(at.putIn?.size).toBeCloseTo(100 / 120);
		expect(at.takenOut).toMatchObject({ level: false });
		expect(at.takenOut?.start).toBeCloseTo(80 / 120);
		expect(at.takenOut?.size).toBeCloseTo(20 / 120);
		expect(at.priceGains?.start).toBeCloseTo(80 / 120);
		expect(at.priceGains?.size).toBeCloseTo(40 / 120);
		expect(at.fees?.start).toBeCloseTo(100 / 120);
		expect(at.closing).toMatchObject({ level: true, start: 0 });
		expect(at.closing?.size).toBeCloseTo(100 / 120);
	});

	it("after an opening value, Put in is a step on top of it", () => {
		const { rows } = movedChart(moved({ opening: "100.00", putIn: "100.00", takenOut: "0", priceGains: "0", fees: "0", closing: "200.00" }));
		expect(rows.map((row) => [row.key, row.level, row.start, row.size])).toEqual([
			["opening", true, 0, 0.5],
			["putIn", false, 0.5, 0.5],
			["closing", true, 0, 1],
		]);
	});

	it("makes room below zero when more was taken out than put in", () => {
		const { rows, zero } = movedChart(
			moved({ putIn: "100.00", takenOut: "150.00", priceGains: "150.00", fees: "0", closing: "100.00" }),
		);
		expect(zero).toBeCloseTo(50 / 150);
		const takenOut = rows.find((row) => row.key === "takenOut");
		expect(takenOut?.start).toBe(0);
		expect(takenOut?.size).toBeCloseTo(1);
		for (const row of rows) expect(row.start + row.size).toBeLessThanOrEqual(1 + 1e-9);
	});
});

describe("ahead of or behind the same money elsewhere", () => {
	const say = (benchmarks: Benchmark[], pricesLoading = false) =>
		sentenceText(aheadSentence(benchmarks.map((b) => standingOf(b, pricesLoading))));
	const tone = (benchmarks: Benchmark[]) => standingTone(benchmarks.map((b) => standingOf(b, false)));

	it("ahead of both", () => {
		const both = [benchmark({ ahead: "762000.00" }), gold({ ahead: "512000.00" })];
		expect(say(both)).toBe(
			"₹7,62,000 ahead of NIFTY and ₹5,12,000 ahead of gold, on exactly the same deposits and withdrawals.",
		);
		expect(tone(both)).toBe("good");
	});

	it("ahead of one, behind the other — each said truthfully", () => {
		const mixed = [benchmark({ ahead: "201136.73" }), gold({ ahead: "-1497387.40" })];
		expect(say(mixed)).toBe(
			"₹2,01,137 ahead of NIFTY and ₹14,97,387 behind gold, on exactly the same deposits and withdrawals.",
		);
		expect(tone(mixed)).toBe("good");
		const other = [benchmark({ ahead: "-250639.11" }), gold({ ahead: "9000.00" })];
		expect(say(other)).toBe(
			"₹2,50,639 behind NIFTY and ₹9,000 ahead of gold, on exactly the same deposits and withdrawals.",
		);
		expect(tone(other)).toBe("bad");
	});

	it("behind both", () => {
		const both = [benchmark({ ahead: "-100.00" }), gold({ ahead: "-200.00" })];
		expect(say(both)).toBe("₹100 behind NIFTY and ₹200 behind gold, on exactly the same deposits and withdrawals.");
		expect(tone(both)).toBe("bad");
	});

	it("level is neither", () => {
		expect(say([benchmark({ ahead: "0.20" }), gold({ ahead: "-0.10" })])).toBe(
			"Level with NIFTY and level with gold, on exactly the same deposits and withdrawals.",
		);
		expect(tone([benchmark({ ahead: "0.00" })])).toBe("good");
	});

	it("a benchmark whose prices start later gets its reason, not a figure", () => {
		const lateGold = gold({ value: null, xirr: null, ahead: null, availableFrom: "2024-03-12" });
		expect(say([benchmark({ ahead: "762000.00" }), lateGold])).toBe(
			"₹7,62,000 ahead of NIFTY, on exactly the same deposits and withdrawals. No figure for gold: its prices only start on 12 Mar 2024, after this period begins.",
		);
		// Even if a figure came with it, a late start means it is not the same money.
		expect(hasFigure(gold({ availableFrom: "2024-03-12" }))).toBe(false);
		expect(say([gold({ availableFrom: "2024-03-12" })])).toBe(
			"No figure for gold: its prices only start on 12 Mar 2024, after this period begins.",
		);
	});

	it("a missing figure says prices are still coming in — or plainly that it cannot be worked out", () => {
		const none = [benchmark({ value: null, xirr: null, ahead: null }), gold({ value: null, xirr: null, ahead: null })];
		expect(say(none, true)).toBe(
			"No figure for NIFTY yet: its prices are still coming in. No figure for gold yet: its prices are still coming in.",
		);
		expect(say(none)).toBe(
			"No figure for NIFTY: it can’t be worked out from the prices Kosh has. No figure for gold: it can’t be worked out from the prices Kosh has.",
		);
		expect(tone(none)).toBe("warn");
	});

	it("takes its colour from the first benchmark that has a figure", () => {
		expect(tone([benchmark({ value: null, ahead: null }), gold({ ahead: "-5.00" })])).toBe("bad");
		expect(tone([benchmark({ value: null, ahead: null }), gold({ ahead: "5.00" })])).toBe("good");
	});

	it("knows a mixed result from a plain one", () => {
		const of = (benchmarks: Benchmark[]) => isMixed(benchmarks.map((b) => standingOf(b, false)));
		expect(of([benchmark({ ahead: "5.00" }), gold({ ahead: "-5.00" })])).toBe(true);
		expect(of([benchmark({ ahead: "5.00" }), gold({ ahead: "9.00" })])).toBe(false);
		expect(of([benchmark({ ahead: "-5.00" }), gold({ value: null, ahead: null })])).toBe(false);
	});

	it("only the figures are set in bold", () => {
		const segments = aheadSentence([standingOf(benchmark({ ahead: "762000.00" }), false)]);
		expect(segments.filter((s) => s.strong).map((s) => s.text)).toEqual(["₹7,62,000 ahead"]);
	});

	it("keeps a benchmark's own name when there is no short one, and leads with NIFTY", () => {
		const silver = benchmark({ slug: "silver", name: "Silver", ahead: "10.00" });
		expect(say([silver])).toBe("₹10 ahead of Silver, on exactly the same deposits and withdrawals.");
		expect(primaryBenchmark([gold(), benchmark()])?.slug).toBe("nifty50");
		expect(primaryBenchmark([gold()])?.slug).toBe("gold");
		expect(primaryBenchmark([])).toBeNull();
	});
});

describe("the scripts ahead of and behind NIFTY", () => {
	const list = [
		holding("A", "100.00"),
		holding("B", "-50.00"),
		holding("C", "900.00"),
		holding("D", null),
		holding("E", "-700.00"),
		holding("F", "300.00"),
		holding("G", "20.00"),
		holding("H", "-1.00"),
		holding("I", "-60.00"),
		holding("J", "0.00"),
	];

	it("picks the top three each way by rupee effect, furthest first", () => {
		const movers = topMovers(list);
		expect(movers.ahead.map((h) => h.name)).toEqual(["C", "F", "A"]);
		expect(movers.behind.map((h) => h.name)).toEqual(["E", "I", "B"]);
		expect(movers).toMatchObject({ aheadCount: 4, behindCount: 4, uncompared: 1, total: 10 });
	});

	it("puts a script with no comparison, or dead level, in neither list", () => {
		const movers = topMovers([holding("D", null), holding("J", "0.00")]);
		expect(movers.ahead).toEqual([]);
		expect(movers.behind).toEqual([]);
		expect(movers).toMatchObject({ uncompared: 1, total: 2 });
	});

	it("ranks by rupees, not by percentage points", () => {
		const big = holding("Big", "5000.00", { xirr: 0.11, benchmarkXirr: 0.1 });
		const sharp = holding("Sharp", "200.00", { xirr: 0.4, benchmarkXirr: 0.1 });
		expect(topMovers([sharp, big]).ahead.map((h) => h.name)).toEqual(["Big", "Sharp"]);
	});

	it("works out the points only when both returns are there", () => {
		expect(pointsOf({ xirr: 0.19, benchmarkXirr: 0.1 })).toBeCloseTo(0.09);
		expect(pointsOf({ xirr: null, benchmarkXirr: 0.1 })).toBeNull();
		expect(pointsOf({ xirr: 0.1, benchmarkXirr: null })).toBeNull();
		expect(largest([0.02, null, -0.09, 0.05])).toBeCloseTo(0.09);
		expect(largest([null])).toBe(0);
	});

	it("names the accounts while they fit, then counts them", () => {
		expect(heldInLine(["Anil · Zerodha"])).toBe("Anil · Zerodha");
		expect(heldInLine(["Anil · Zerodha", "HUF · Zerodha"])).toBe("Anil · Zerodha, HUF · Zerodha");
		expect(heldInLine(["a", "b", "c"])).toBe("3 accounts");
		expect(heldInLine(["a", "b"], 1)).toBe("2 accounts");
		expect(heldInLine([])).toBe("");
	});
});

describe("the groups shown on the Overview", () => {
	it("shows the three furthest ahead, best first", () => {
		const rows = [groupRow("Family", 0.021), groupRow("HUF and kids", 0.082), groupRow("Own", -0.063), groupRow("Kids", 0.03)];
		expect(topGroups(rows).map((g) => g.name)).toEqual(["HUF and kids", "Kids", "Family"]);
	});

	it("shows a group with too little history after the ranked ones", () => {
		const rows = [
			groupRow("New", 0.5, { shortHistory: true }),
			groupRow("Unknown", null),
			groupRow("Family", 0.021),
			groupRow("Own", -0.063),
		];
		expect(topGroups(rows).map((g) => g.name)).toEqual(["Family", "Own", "New"]);
		expect(topGroups(rows, 10).map((g) => g.name)).toEqual(["Family", "Own", "New", "Unknown"]);
	});
});
