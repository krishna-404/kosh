import { GROUPS } from "@frontend/copy/groups.copy";
import { describe, expect, it } from "vitest";
import {
	accountsByHolder,
	anyValue,
	fullYears,
	groupNamed,
	kindCounts,
	leaningOf,
	membersOf,
	ofKind,
	rankGroups,
	sameAccounts,
	sharedExample,
	sharingWith,
	smallButAhead,
	standingOf,
	totalValue,
	whatIfLines,
	widestGap,
	yearCells,
	yearGrid,
} from "./groups.utils";

const holder = (id: string, displayName: string, isMe = false) => ({ id, displayName, isMe });

const account = (id: string, personId: string, label: string, value: string | null = null) => ({
	id,
	personId,
	label,
	value,
});

describe("money in groups", () => {
	it("is shown only once some account has a value", () => {
		expect(anyValue([account("a", "h", "A"), account("b", "h", "B")])).toBe(false);
		expect(anyValue([account("a", "h", "A"), account("b", "h", "B", "10")])).toBe(true);
	});

	it("adds up the values that exist, and is null when there are none", () => {
		expect(totalValue([account("a", "h", "A"), account("b", "h", "B")])).toBeNull();
		expect(totalValue([])).toBeNull();
		expect(
			totalValue([
				account("a", "h", "A", "8420000"),
				account("b", "h", "B", "1265000.50"),
				account("c", "h", "C"),
			]),
		).toBe(9685000.5);
	});
});

describe("the account picker", () => {
	const holders = [holder("h1", "Sunita Mehta"), holder("h2", "Anil Mehta", true), holder("h3", "Nobody")];
	const accounts = [
		account("a1", "h1", "Sunita · Zerodha"),
		account("a2", "h2", "Anil · Zerodha"),
		account("a3", "h2", "Anil · Groww"),
		account("a4", "gone", "Stray"),
	];

	it("lists accounts under their holder, the viewer's own first, others last", () => {
		const sections = accountsByHolder(holders, accounts);
		expect(
			sections.map((s) => [s.holder?.displayName ?? null, s.accounts.map((a) => a.label)]),
		).toEqual([
			["Anil Mehta", ["Anil · Zerodha", "Anil · Groww"]],
			["Sunita Mehta", ["Sunita · Zerodha"]],
			[null, ["Stray"]],
		]);
	});

	it("resolves a group's members, skipping accounts no longer visible", () => {
		expect(membersOf({ accountIds: ["a3", "zzz", "a1"] }, accounts).map((a) => a.label)).toEqual([
			"Anil · Groww",
			"Sunita · Zerodha",
		]);
	});
});

describe("group names and kinds", () => {
	const groups = [
		{ id: "g1", name: "Parents", kind: "family" as const },
		{ id: "g2", name: "Kids", kind: "family" as const },
		{ id: "g3", name: "Ramesh", kind: "fund_manager" as const },
		{ id: "g4", name: "For later", kind: null },
	];

	it("notices a name already in use, whatever the case, except its own", () => {
		expect(groupNamed("  kids ", groups)?.name).toBe("Kids");
		expect(groupNamed("Kids", groups, "g2")).toBeUndefined();
		expect(groupNamed("", groups)).toBeUndefined();
		expect(groupNamed("Friends", groups)).toBeUndefined();
	});

	it("counts the kinds in use, in the board's order", () => {
		expect(kindCounts(groups, ["family", "fund_manager", "personal", "friends"])).toEqual([
			{ kind: "family", count: 2 },
			{ kind: "fund_manager", count: 1 },
		]);
	});

	it("filters by kind, leaving groups with no kind under All only", () => {
		expect(ofKind(groups, "all").map((g) => g.name)).toEqual(["Parents", "Kids", "Ramesh", "For later"]);
		expect(ofKind(groups, "family").map((g) => g.name)).toEqual(["Parents", "Kids"]);
		expect(ofKind(groups, "personal")).toEqual([]);
		// The chips' counts and what each chip shows agree.
		for (const { kind, count } of kindCounts(groups, ["family", "fund_manager", "personal", "friends"]))
			expect(ofKind(groups, kind)).toHaveLength(count);
	});

	it("compares selections as sets", () => {
		expect(sameAccounts(["a", "b"], ["b", "a"])).toBe(true);
		expect(sameAccounts(["a", "b"], ["a"])).toBe(false);
		expect(sameAccounts([], [])).toBe(true);
	});
});

describe("group wording", () => {
	it("lists the first three accounts, then how many more", () => {
		expect(GROUPS.membersLine(["A", "B"])).toBe("A, B");
		expect(GROUPS.membersLine(["A", "B", "C"])).toBe("A, B, C");
		expect(GROUPS.membersLine(["A", "B", "C", "D", "E"])).toBe("A, B, C +2 more");
		expect(GROUPS.accountsCount(1)).toBe("1 account");
		expect(GROUPS.accountsCount(4)).toBe("4 accounts");
	});

	it("names one shared account and the groups it is in", () => {
		expect(GROUPS.overlapNote({ account: "Anil · Zerodha", groups: ["Family", "My own trading"] })).toBe(
			"Groups can share accounts — Anil · Zerodha is in both Family and My own trading. Compare them freely, but don’t add them up; that’s why there’s no total row.",
		);
		expect(GROUPS.overlapNote({ account: "A", groups: ["X", "Y", "Z"] })).toContain("A is in X, Y and Z.");
		expect(GROUPS.overlapNote(null)).toBe(
			"Groups can share accounts. Compare them freely, but don’t add them up; that’s why there’s no total row.",
		);
	});

	it("says which groups “What if” leaves out, and why", () => {
		expect(GROUPS.whatIf.leftOut(["Family"], "HUF and kids")).toBe(
			"Family shares accounts with HUF and kids, so it is left out.",
		);
		expect(GROUPS.whatIf.leftOut(["Family", "HUF and kids"], "Kids")).toBe(
			"Family and HUF and kids share accounts with Kids, so they are left out.",
		);
	});

	it("counts years ahead in words", () => {
		expect(GROUPS.yearsOf(2, 3)).toBe("2 of 3");
		expect(GROUPS.yearsOfShort(1, 1)).toBe("1 of 1 year ahead");
		expect(GROUPS.yearsOfShort(5, 7)).toBe("5 of 7 years ahead");
	});

	it("says who could take an account out of the group", () => {
		expect(GROUPS.noteShared(["Sunita"], "Sunita · Zerodha", true)).toBe(
			"If Sunita stops sharing Sunita · Zerodha with you, it leaves this group and the total changes.",
		);
		expect(GROUPS.noteShared(["Sunita", "Riya"], null, false)).toBe(
			"If Sunita or Riya stops sharing an account with you, it leaves this group.",
		);
		expect(GROUPS.noteShared(["A", "B", "C", "D"], null, false)).toBe(
			"If someone stops sharing an account with you, it leaves this group.",
		);
	});
});

describe("the comparison's order", () => {
	const figures = (aheadPoints: number | null, shortHistory = false) => ({ aheadPoints, shortHistory });

	it("tells where a group stands", () => {
		expect(standingOf(figures(0.021), true)).toBe("ranked");
		expect(standingOf(figures(null), true)).toBe("unranked");
		expect(standingOf(figures(0.19, true), true)).toBe("short");
		// Nothing uploaded: the zeros the comparison sends back are not figures.
		expect(standingOf(figures(null, true), false)).toBe("none");
		expect(standingOf(undefined, false)).toBe("none");
		expect(standingOf(undefined, true)).toBe("pending");
	});

	it("ranks by how far ahead, then lists what cannot be ranked", () => {
		const rows = [
			{ name: "New this year", standing: "short" as const, aheadPoints: 0.4 },
			{ name: "Family", standing: "ranked" as const, aheadPoints: 0.021 },
			{ name: "Empty", standing: "none" as const, aheadPoints: null },
			{ name: "My own trading", standing: "ranked" as const, aheadPoints: -0.063 },
			{ name: "One way only", standing: "unranked" as const, aheadPoints: null },
			{ name: "HUF and kids", standing: "ranked" as const, aheadPoints: 0.082 },
			{ name: "Also empty", standing: "none" as const, aheadPoints: null },
		];
		expect(rankGroups(rows).map((row) => row.name)).toEqual([
			"HUF and kids",
			"Family",
			"My own trading",
			"One way only",
			"New this year",
			"Also empty",
			"Empty",
		]);
		// The list it was given is left as it was.
		expect(rows[0]?.name).toBe("New this year");
	});

	it("calls a gap that shows as 0.0 level, not ahead or behind", () => {
		expect(leaningOf(0.021)).toBe("ahead");
		expect(leaningOf(-0.005)).toBe("behind");
		expect(leaningOf(0.0002)).toBe("level");
		expect(leaningOf(-0.0004)).toBe("level");
		expect(leaningOf(0)).toBe("level");
	});

	it("scales the bars to the widest gap", () => {
		expect(widestGap([0.021, -0.063, null, 0.04])).toBe(0.063);
		expect(widestGap([])).toBe(0);
	});
});

describe("groups that share accounts", () => {
	const groups = [
		{ id: "g1", name: "Family", accountIds: ["a1", "a2", "a3"] },
		{ id: "g2", name: "HUF and kids", accountIds: ["a2", "a3"] },
		{ id: "g3", name: "My own trading", accountIds: ["a1"] },
		{ id: "g4", name: "Friends", accountIds: ["a9"] },
	];
	const group = (id: string) => groups.find((g) => g.id === id) as (typeof groups)[number];

	it("finds the groups a group overlaps", () => {
		expect(sharingWith(group("g1"), groups).map((g) => g.name)).toEqual(["HUF and kids", "My own trading"]);
		expect(sharingWith(group("g3"), groups).map((g) => g.name)).toEqual(["Family"]);
		expect(sharingWith(group("g4"), groups)).toEqual([]);
	});

	it("gives one shared account as the example", () => {
		const accounts = [
			{ id: "a9", label: "Vikram · Groww" },
			{ id: "a1", label: "Anil · Zerodha" },
			{ id: "a2", label: "Kabir · Zerodha" },
		];
		expect(sharedExample(groups, accounts)).toEqual({
			account: "Anil · Zerodha",
			groups: ["Family", "My own trading"],
		});
		expect(sharedExample([group("g2"), group("g3")], accounts)).toBeNull();
	});
});

describe("what if", () => {
	const whatIf = {
		value: "2068599.22",
		rows: [
			{ id: "gold", name: "Gold", kind: "benchmark" as const, value: "2570144.81" },
			{ id: "g2", name: "HUF and kids", kind: "self" as const, value: "2068599.22" },
			{ id: "g5", name: "Not started then", kind: "group" as const, value: null },
			{ id: "g1", name: "Family", kind: "group" as const, value: "1764383.90" },
			{ id: "nifty50", name: "NIFTY 50", kind: "benchmark" as const, value: "1616823.38" },
			{ id: "g3", name: "My own trading", kind: "group" as const, value: "1352950.89" },
		],
	};

	it("gives each row its difference from what really happened", () => {
		const lines = whatIfLines(whatIf);
		expect(lines.map((line) => [line.name, line.difference === null ? null : Math.round(line.difference)])).toEqual([
			["Gold", 501546],
			["HUF and kids", null],
			["Family", -304215],
			["NIFTY 50", -451776],
			["My own trading", -715648],
			["Not started then", null],
		]);
	});

	it("sizes each bar against the longest and lists rows with no value last", () => {
		const lines = whatIfLines(whatIf);
		expect(lines[0]?.share).toBe(1);
		expect(lines[1]?.share).toBeCloseTo(2068599.22 / 2570144.81, 6);
		expect(lines.at(-1)).toMatchObject({ name: "Not started then", value: null, share: 0 });
	});

	it("leaves out the groups that share accounts, never the group itself or a benchmark", () => {
		const lines = whatIfLines(whatIf, new Set(["g1", "g2", "gold"]));
		expect(lines.map((line) => line.name)).toEqual([
			"Gold",
			"HUF and kids",
			"NIFTY 50",
			"My own trading",
			"Not started then",
		]);
	});

	it("still works when only the benchmarks are left", () => {
		const alone = whatIfLines({ value: "100", rows: [{ id: "g", name: "Solo", kind: "self", value: "100" }] });
		expect(alone).toEqual([{ id: "g", name: "Solo", kind: "self", value: 100, difference: null, share: 1 }]);
		const empty = whatIfLines({ value: "0.00", rows: [{ id: "nifty50", name: "NIFTY 50", kind: "benchmark", value: null }] });
		expect(empty[0]).toMatchObject({ value: null, difference: null, share: 0 });
	});

	it("points out a much smaller group that came out ahead", () => {
		const lines = whatIfLines({
			value: "14050000",
			rows: [
				{ id: "small", name: "Sunita’s own", kind: "group", value: "14780000" },
				{ id: "self", name: "Ramesh", kind: "self", value: "14050000" },
				{ id: "tiny", name: "Kids", kind: "group", value: "13790000" },
				{ id: "big", name: "Parents", kind: "group", value: "15000000" },
				{ id: "gold", name: "Gold", kind: "benchmark", value: "16000000" },
			],
		});
		const worth = new Map([
			["small", 3_910_000],
			["tiny", 1_397_000],
			["big", 13_595_000],
		]);
		// Parents is ahead but nearly as large; Kids is small but behind.
		expect(smallButAhead(lines, 14_050_000, worth)?.name).toBe("Sunita’s own");
		expect(smallButAhead(lines, 5_000_000, worth)).toBeNull();
		expect(smallButAhead(lines, 14_050_000, new Map())).toBeNull();
	});
});

describe("year by year", () => {
	const row = (groupId: string, yearsCounted: number) => ({ groupId, yearsCounted });
	const year = (y: number, a: number | null, b: number | null, c: number | null) => ({
		year: y,
		cells: [
			{ groupId: "a", points: a },
			{ groupId: "b", points: b },
			{ groupId: "c", points: c },
		],
	});
	// As the server sends it: newest year first. `a` began mid-2023, `b` on 1 Jan 2024, `c` has nothing.
	const compared = {
		groups: [row("a", 2), row("b", 2), row("c", 0)],
		years: [
			year(2026, 0.0002, 0.054, null),
			year(2025, 0.055, -0.01, null),
			year(2024, 0.061, 0.1, null),
			year(2023, -0.087, null, null),
		],
	};
	const cells = yearCells(compared, 2026);

	it("lays each group's years out oldest first", () => {
		expect(cells.get("a")?.map((cell) => [cell.year, cell.points])).toEqual([
			[2023, -0.087],
			[2024, 0.061],
			[2025, 0.055],
			[2026, 0.0002],
		]);
	});

	it("marks the year a group started in, and the year still running, as part-years", () => {
		expect(cells.get("a")?.filter((cell) => cell.partYear).map((cell) => cell.year)).toEqual([2023, 2026]);
		// `b` has exactly as many past years as full years: only this year is partial.
		expect(cells.get("b")?.filter((cell) => cell.partYear).map((cell) => cell.year)).toEqual([2026]);
		expect(cells.get("c")?.some((cell) => cell.partYear)).toBe(false);
	});

	it("counts the same full years the comparison does", () => {
		expect(fullYears(cells.get("a") ?? [])).toEqual([
			{ year: 2024, ahead: true },
			{ year: 2025, ahead: true },
		]);
		expect(fullYears(cells.get("b") ?? [])).toEqual([
			{ year: 2024, ahead: true },
			{ year: 2025, ahead: false },
		]);
		expect(fullYears(cells.get("c") ?? [])).toEqual([]);
	});

	it("drops groups with no year and the years before the listed groups began", () => {
		const all = yearGrid(cells, ["b", "a", "c"]);
		expect(all.years).toEqual([2023, 2024, 2025, 2026]);
		expect(all.rows.map((r) => r.groupId)).toEqual(["b", "a"]);
		expect(all.rows[0]?.cells[0]).toEqual({ year: 2023, points: null, partYear: false });

		const onlyB = yearGrid(cells, ["b"]);
		expect(onlyB.years).toEqual([2024, 2025, 2026]);
		expect(onlyB.rows[0]?.cells.map((cell) => cell.points)).toEqual([0.1, -0.01, 0.054]);

		expect(yearGrid(cells, ["c"])).toEqual({ years: [], rows: [] });
		expect(yearGrid(cells, [])).toEqual({ years: [], rows: [] });
	});
});
