import type { Directory, DirectoryAccount } from "@connected-repo/zod-schemas/kosh/people.zod";
import { describe, expect, it } from "vitest";
import {
	arrivalSections,
	arrivedAccountIds,
	byGroup,
	bySharer,
	namesOf,
	sharedAccounts,
	sharedLastName,
	totalValue,
} from "./shared.utils";

const anil = { userId: "u-anil", name: "Anil Mehta", email: "anil@example.com" };
const sunita = { userId: "u-sunita", name: "Sunita Mehta", email: "sunita@example.com" };

const account = (over: Partial<DirectoryAccount> & Pick<DirectoryAccount, "id" | "personId">): DirectoryAccount => ({
	label: over.id,
	broker: "zerodha",
	brokerName: null,
	baseCurrency: "INR",
	createdAt: 0,
	myLevel: "view",
	via: "account",
	myGrantId: `grant-${over.id}`,
	sharedBy: null,
	isNew: false,
	access: null,
	value: null,
	xirr: null,
	benchmarkXirr: null,
	updated: null,
	questionsWaiting: 0,
	...over,
});

const directory: Directory = {
	me: { userId: "me", name: "Ramesh Iyer", email: "ramesh@iyercapital.in" },
	holders: [
		{ id: "h-anil", displayName: "Anil Mehta", kind: "login", isMe: false, myLevel: null, createdAt: 0 },
		{ id: "h-huf", displayName: "Anil Mehta HUF", kind: "huf", isMe: false, myLevel: "edit", createdAt: 0 },
		{ id: "h-me", displayName: "Ramesh Iyer", kind: "login", isMe: true, myLevel: "owner", createdAt: 0 },
	],
	accounts: [
		account({ id: "anil-z", personId: "h-anil", sharedBy: anil, myLevel: "edit" }),
		account({ id: "huf-z", personId: "h-huf", sharedBy: anil, myLevel: "edit", via: "holder" }),
		account({ id: "huf-g", personId: "h-huf", sharedBy: anil, myLevel: "edit", via: "holder" }),
		account({ id: "sunita-z", personId: "h-anil", sharedBy: sunita }),
		account({ id: "mine", personId: "h-me", myLevel: "owner" }),
	],
};

describe("shared with me", () => {
	it("lists only what someone else shared, grouped by who shared it", () => {
		const shared = sharedAccounts(directory);
		expect(shared.map((s) => s.account.id)).toEqual(["anil-z", "huf-z", "huf-g", "sunita-z"]);
		expect(bySharer(shared).map((s) => [s.sharer?.name, s.rows.length])).toEqual([
			["Anil Mehta", 3],
			["Sunita Mehta", 1],
		]);
	});

	it("groups by the person's own groups, with the rest left over", () => {
		const shared = sharedAccounts(directory);
		const { sections, ungrouped } = byGroup(shared, [
			{ id: "g1", name: "Mehta household", kind: "family", accountIds: ["anil-z", "sunita-z", "mine"], createdAt: 0 },
			{ id: "g2", name: "Only mine", kind: null, accountIds: ["mine"], createdAt: 0 },
		]);
		expect(sections.map((s) => [s.group?.name, s.rows.map((r) => r.account.id)])).toEqual([
			["Mehta household", ["anil-z", "sunita-z"]],
		]);
		expect(ungrouped.map((r) => r.account.id)).toEqual(["huf-z", "huf-g"]);
	});

	it("adds up amounts only when there are any", () => {
		expect(totalValue(directory.accounts)).toBeNull();
		expect(totalValue([{ value: "8420000.00" }, { value: null }, { value: "1265000" }])).toBe(9685000);
	});

	it("suggests a household only for one family", () => {
		expect(sharedLastName(["Anil Mehta", "Sunita Mehta"])).toBe("Mehta");
		expect(sharedLastName(["Anil Mehta", "Deepak Kapoor"])).toBeNull();
		expect(sharedLastName(["Anil"])).toBeNull();
		expect(namesOf(["Anil Mehta", "Sunita Mehta"])).toBe("Anil and Sunita Mehta");
		expect(namesOf(["Anil Mehta", "Deepak Kapoor", "Priya Nair"])).toBe(
			"Anil Mehta, Deepak Kapoor and Priya Nair",
		);
	});

	it("turns what arrived into one line per account, under whoever shared it", () => {
		const sections = arrivalSections(
			[
				{ grantId: "n2", sharedBy: sunita, target: { kind: "account", id: "sunita-z", label: "sunita-z" }, level: "view", at: 2 },
				{ grantId: "n1", sharedBy: anil, target: { kind: "holder", id: "h-huf", label: "Anil Mehta HUF" }, level: "edit", at: 1 },
				{ grantId: "n3", sharedBy: anil, target: { kind: "holder", id: "h-none", label: "Kabir" }, level: "view", at: 3 },
			],
			directory,
		);
		expect(sections.map((s) => s.sharer.name)).toEqual(["Anil Mehta", "Sunita Mehta"]);
		expect(sections[0]?.rows.map((r) => [r.label, r.wide, r.account?.id ?? null])).toEqual([
			["huf-z", true, "huf-z"],
			["huf-g", true, "huf-g"],
			["Kabir", true, null],
		]);
		expect(arrivedAccountIds(sections)).toEqual(["huf-z", "huf-g", "sunita-z"]);
	});

	it("says when an Owner share still waits for the sharer's confirm", () => {
		const [section] = arrivalSections(
			[{ grantId: "n1", sharedBy: anil, target: { kind: "account", id: "anil-z", label: "anil-z" }, level: "owner", at: 1 }],
			directory,
		);
		expect(section?.rows[0]?.awaitingOwner).toBe(true);
		expect(section?.rows[0]?.level).toBe("edit");
	});
});
