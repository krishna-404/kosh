import { GROUPS } from "@frontend/copy/groups.copy";
import { describe, expect, it } from "vitest";
import {
	accountsByHolder,
	anyValue,
	groupNamed,
	kindCounts,
	membersOf,
	sameAccounts,
	totalValue,
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
