import { describe, expect, it } from "vitest";
import {
	countStandings,
	defaultSort,
	FIRST_ROWS,
	filterHoldings,
	heldInWords,
	isNotFound,
	largestGap,
	makeUp,
	nextSort,
	pointsOf,
	pointsWords,
	priceWords,
	quantityWords,
	shareWords,
	sortHoldings,
	standingFromParam,
	standingOf,
	tradeCounts,
	viewFromParams,
	visibleCount,
	withView,
} from "./holdings.utils";

interface Row {
	name: string;
	value: string;
	effect: string | null;
	xirr: number | null;
	benchmarkXirr: number | null;
	assetClass: "stocks" | "funds" | "gold" | "bonds" | "other";
}

const row = (name: string, value: number, effect: number | null, over: Partial<Row> = {}): Row => ({
	name,
	value: value.toFixed(2),
	effect: effect === null ? null : effect.toFixed(2),
	xirr: 0.1,
	benchmarkXirr: 0.08,
	assetClass: "stocks",
	...over,
});

const names = (rows: readonly Row[]) => rows.map((r) => r.name);

describe("ahead or behind NIFTY", () => {
	it("goes by the sign of the rupee effect, and level counts as ahead", () => {
		expect(standingOf({ effect: "264000.00" })).toBe("ahead");
		expect(standingOf({ effect: "-0.01" })).toBe("behind");
		expect(standingOf({ effect: "0.00" })).toBe("ahead");
	});

	it("puts a script that could not be compared in neither", () => {
		expect(standingOf({ effect: null })).toBeNull();
	});

	it("counts the rows on screen, with the uncompared ones only under All", () => {
		const rows = [row("A", 10, 5), row("B", 10, -5), row("C", 10, -1), row("D", 10, null), row("E", 10, 0)];
		expect(countStandings(rows)).toEqual({ all: 5, ahead: 2, behind: 2, notCompared: 1 });
		expect(countStandings([])).toEqual({ all: 0, ahead: 0, behind: 0, notCompared: 0 });
	});

	it("filters to one side, and to one kind of asset as well", () => {
		const rows = [
			row("A", 10, 5),
			row("B", 10, -5),
			row("C", 10, null),
			row("G", 10, 3, { assetClass: "gold" }),
			row("H", 10, -3, { assetClass: "gold" }),
		];
		expect(names(filterHoldings(rows, "all"))).toEqual(["A", "B", "C", "G", "H"]);
		expect(names(filterHoldings(rows, "ahead"))).toEqual(["A", "G"]);
		expect(names(filterHoldings(rows, "behind"))).toEqual(["B", "H"]);
		expect(names(filterHoldings(rows, "behind", "gold"))).toEqual(["H"]);
		expect(names(filterHoldings(rows, "all", "gold"))).toEqual(["G", "H"]);
		expect(filterHoldings(rows, "ahead", "bonds")).toEqual([]);
	});

	it("reads the filter from the address, and anything odd as All", () => {
		expect(standingFromParam("ahead")).toBe("ahead");
		expect(standingFromParam("behind")).toBe("behind");
		for (const raw of [null, "", "all", "Behind", "nonsense"]) expect(standingFromParam(raw)).toBe("all");
	});
});

describe("the list's view in the address", () => {
	it("reads the plain address as the plain list", () => {
		expect(viewFromParams(new URLSearchParams(""))).toEqual({ filter: "all", includeSold: false });
		expect(viewFromParams(new URLSearchParams("show=behind&sold=1"))).toEqual({ filter: "behind", includeSold: true });
		expect(viewFromParams(new URLSearchParams("show=x&sold=yes"))).toEqual({ filter: "all", includeSold: false });
	});

	it("writes both choices, keeps the scope, and leaves nothing behind for the plain list", () => {
		const scoped = new URLSearchParams("in=group:01H&over=1y");
		expect(withView(scoped, { filter: "behind", includeSold: true }).toString()).toBe(
			"in=group%3A01H&over=1y&show=behind&sold=1",
		);
		const back = withView(new URLSearchParams("in=group:01H&show=ahead&sold=1"), { filter: "all", includeSold: false });
		expect(back.toString()).toBe("in=group%3A01H");
		// The address handed in is not changed.
		expect(scoped.toString()).toBe("in=group%3A01H&over=1y");
	});

	it("round-trips", () => {
		for (const view of [
			{ filter: "all", includeSold: false },
			{ filter: "ahead", includeSold: true },
			{ filter: "behind", includeSold: false },
		] as const)
			expect(viewFromParams(withView(new URLSearchParams("in=account:1"), view))).toEqual(view);
	});
});

describe("the gap against NIFTY, in points", () => {
	it("is the script's yearly return minus NIFTY's on the same money", () => {
		expect(pointsOf({ xirr: 0.215, benchmarkXirr: 0.129 })).toBeCloseTo(0.086);
		expect(pointsOf({ xirr: 0.031, benchmarkXirr: 0.12 })).toBeCloseTo(-0.089);
	});

	it("is not worked out when either rate is missing", () => {
		expect(pointsOf({ xirr: null, benchmarkXirr: 0.1 })).toBeNull();
		expect(pointsOf({ xirr: 0.1, benchmarkXirr: null })).toBeNull();
	});

	it("scales the bars to the biggest gap either way", () => {
		expect(
			largestGap([
				{ xirr: 0.2, benchmarkXirr: 0.1 },
				{ xirr: 0.0, benchmarkXirr: 0.25 },
				{ xirr: null, benchmarkXirr: 0.9 },
			]),
		).toBeCloseTo(0.25);
		expect(largestGap([])).toBe(0);
	});

	it("is worded as on the board", () => {
		expect(pointsWords(0.086)).toBe("+8.6 ahead");
		expect(pointsWords(-0.046)).toBe("−4.6 behind");
		expect(pointsWords(0.0001)).toBe("Level");
		expect(pointsWords(-0.0004)).toBe("Level");
	});
});

describe("the order of the rows", () => {
	const rows = [
		row("Small ahead", 100, 20, { xirr: 0.3 }),
		row("Big behind", 900, -60, { xirr: 0.02 }),
		row("Big ahead", 800, 70, { xirr: 0.15 }),
		row("Not compared", 500, null, { xirr: null }),
		row("Small behind", 50, -5, { xirr: -0.1 }),
	];

	it("is by rupee effect to begin with: furthest ahead first", () => {
		expect(defaultSort("all")).toEqual({ key: "effect", dir: "desc" });
		expect(defaultSort("ahead")).toEqual({ key: "effect", dir: "desc" });
		expect(names(sortHoldings(rows, defaultSort("all")))).toEqual([
			"Big ahead",
			"Small ahead",
			"Small behind",
			"Big behind",
			"Not compared",
		]);
	});

	it("puts the furthest behind first when looking at what is behind", () => {
		expect(defaultSort("behind")).toEqual({ key: "effect", dir: "asc" });
		expect(names(sortHoldings(filterHoldings(rows, "behind"), defaultSort("behind")))).toEqual([
			"Big behind",
			"Small behind",
		]);
	});

	it("can go by value or by return", () => {
		expect(names(sortHoldings(rows, { key: "value", dir: "desc" }))).toEqual([
			"Big behind",
			"Big ahead",
			"Not compared",
			"Small ahead",
			"Small behind",
		]);
		expect(names(sortHoldings(rows, { key: "return", dir: "desc" }))).toEqual([
			"Small ahead",
			"Big ahead",
			"Big behind",
			"Small behind",
			"Not compared",
		]);
	});

	it("keeps rows with no figure last whichever way the order runs", () => {
		expect(names(sortHoldings(rows, { key: "effect", dir: "asc" })).at(-1)).toBe("Not compared");
		expect(names(sortHoldings(rows, { key: "return", dir: "asc" }))).toEqual([
			"Small behind",
			"Big behind",
			"Big ahead",
			"Small ahead",
			"Not compared",
		]);
	});

	it("breaks ties by value, then by name, and leaves the rows it was given alone", () => {
		const tied = [row("B", 10, 5), row("A", 10, 5), row("C", 99, 5)];
		expect(names(sortHoldings(tied, { key: "effect", dir: "desc" }))).toEqual(["C", "A", "B"]);
		expect(names(tied)).toEqual(["B", "A", "C"]);
	});

	it("turns a column round when it is chosen again, and starts a new one largest first", () => {
		expect(nextSort({ key: "effect", dir: "desc" }, "effect")).toEqual({ key: "effect", dir: "asc" });
		expect(nextSort({ key: "effect", dir: "asc" }, "effect")).toEqual({ key: "effect", dir: "desc" });
		expect(nextSort({ key: "effect", dir: "asc" }, "value")).toEqual({ key: "value", dir: "desc" });
	});
});

describe("how many rows show at first", () => {
	it("is the first nine, then all of them once asked", () => {
		expect(visibleCount(41, false)).toBe(FIRST_ROWS);
		expect(visibleCount(41, true)).toBe(41);
		expect(visibleCount(4, false)).toBe(4);
		expect(visibleCount(0, false)).toBe(0);
	});

	it("does not hold back a single row", () => {
		expect(visibleCount(FIRST_ROWS, false)).toBe(FIRST_ROWS);
		expect(visibleCount(FIRST_ROWS + 1, false)).toBe(FIRST_ROWS + 1);
		expect(visibleCount(FIRST_ROWS + 2, false)).toBe(FIRST_ROWS);
		expect(visibleCount(12, false, 10)).toBe(10);
	});
});

describe("what the holdings are made of", () => {
	it("keeps the kinds in one fixed order, whatever order they arrive in", () => {
		const parts = makeUp([
			{ assetClass: "gold", value: "1040000.00", weight: 0.05 },
			{ assetClass: "funds", value: "5230000.00", weight: 0.254 },
			{ assetClass: "stocks", value: "13140000.00", weight: 0.637 },
			{ assetClass: "bonds", value: "1212000.00", weight: 0.059 },
		]);
		expect(parts.map((p) => p.assetClass)).toEqual(["stocks", "funds", "gold", "bonds"]);
		expect(parts[0]).toEqual({ assetClass: "stocks", value: "13140000.00", share: 0.637 });
		expect(parts.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1);
	});

	it("drops a kind with nothing in it, and is empty when nothing is held", () => {
		expect(
			makeUp([
				{ assetClass: "stocks", value: "100.00", weight: 1 },
				{ assetClass: "other", value: "0.00", weight: 0 },
			]).map((p) => p.assetClass),
		).toEqual(["stocks"]);
		expect(makeUp([])).toEqual([]);
	});

	it("writes a share as a whole percent, and a sliver as under 1% rather than 0%", () => {
		expect(shareWords(0.637)).toBe("64%");
		expect(shareWords(1)).toBe("100%");
		expect(shareWords(0.004)).toBe("under 1%");
		expect(shareWords(0)).toBe("0%");
	});
});

describe("held in", () => {
	const account = (accountId: string, label: string) => ({ accountId, label });
	const anil = account("a1", "Anil · Zerodha");
	const riya = account("a2", "Riya · Dhan");
	const huf = account("a3", "HUF · Zerodha");

	it("names the accounts while there are one or two", () => {
		expect(heldInWords([anil])).toBe("Anil · Zerodha");
		expect(heldInWords([anil, riya])).toBe("Anil · Zerodha, Riya · Dhan");
	});

	it("counts them when there are more", () => {
		expect(heldInWords([anil, riya, huf])).toBe("3 accounts");
	});

	it("says nothing for a script that is not held now", () => {
		expect(heldInWords([])).toBeNull();
	});

	it("can say whose it is instead, where there is room for one name only", () => {
		const first = (a: { accountId: string }) => ({ a1: "Anil", a2: "Riya" })[a.accountId] ?? "?";
		expect(heldInWords([anil], 1, first)).toBe("Anil");
		expect(heldInWords([anil, riya], 1, first)).toBe("2 accounts");
	});
});

describe("one script", () => {
	it("writes quantities with Indian grouping and up to three decimals", () => {
		expect(quantityWords("299")).toBe("299");
		expect(quantityWords("3778")).toBe("3,778");
		expect(quantityWords("1322.456")).toBe("1,322.456");
		expect(quantityWords("123456.5")).toBe("1,23,456.5");
		expect(quantityWords("abc")).toBe("—");
	});

	it("shows paise in a price only when the price has them", () => {
		expect(priceWords("2106")).toBe("₹2,106");
		expect(priceWords("111.91")).toBe("₹111.91");
		expect(priceWords(834.5)).toBe("₹834.50");
	});

	it("counts buys and sells", () => {
		expect(tradeCounts([{ side: "buy" }, { side: "sell" }, { side: "buy" }])).toEqual({ buys: 2, sells: 1 });
		expect(tradeCounts([])).toEqual({ buys: 0, sells: 0 });
	});

	it("knows the server's not-found from any other failure", () => {
		expect(isNotFound({ code: "NOT_FOUND", status: 404 })).toBe(true);
		expect(isNotFound({ status: 404 })).toBe(true);
		expect(isNotFound({ code: "INTERNAL_SERVER_ERROR", status: 500 })).toBe(false);
		expect(isNotFound(new TypeError("Failed to fetch"))).toBe(false);
		expect(isNotFound(null)).toBe(false);
	});
});
