import type { AccessMatrix } from "@connected-repo/zod-schemas/kosh/people.zod";
import { describe, expect, it } from "vitest";
import {
	accountsSeenBy,
	canEditSomething,
	cellsFor,
	columnNames,
	filterPeople,
	levelCounts,
	peopleOnAccount,
	removalPlan,
	shareChoices,
} from "./who.utils";

const account = (id: string, broker: "zerodha" | "groww" = "zerodha") => ({
	id,
	label: `${id} label`,
	broker,
	brokerName: null,
	value: null,
});

const matrix: AccessMatrix = {
	holders: [
		{
			id: "anil",
			displayName: "Anil Mehta",
			kind: "login",
			ownsHolder: true,
			accounts: [account("a-z"), account("a-g", "groww")],
		},
		{
			id: "sunita",
			displayName: "Sunita Mehta",
			kind: "login",
			ownsHolder: false,
			accounts: [account("s-z")],
		},
	],
	people: [
		{
			key: "me",
			userId: "me",
			name: "Anil Mehta",
			email: "anil@example.com",
			pending: false,
			isMe: true,
			holders: [{ personId: "anil", level: "owner", grantId: "g-me" }],
			accounts: [{ accountId: "s-z", level: "owner", grantId: "g-me-s" }],
		},
		{
			key: "ramesh",
			userId: "ramesh",
			name: "Ramesh Iyer",
			email: "ramesh@iyercapital.in",
			pending: false,
			isMe: false,
			holders: [
				{ personId: "anil", level: "view", grantId: "g-r-anil" },
				{ personId: "sunita", level: "view", grantId: "g-r-sunita" },
			],
			accounts: [{ accountId: "a-g", level: "edit", grantId: "g-r-ag" }],
		},
		{
			key: "vikram@example.com",
			userId: null,
			name: null,
			email: "vikram@example.com",
			pending: true,
			isMe: false,
			holders: [],
			accounts: [{ accountId: "a-g", level: "owner", grantId: "g-v" }],
		},
	],
};
const [me, ramesh, vikram] = matrix.people as [
	AccessMatrix["people"][number],
	AccessMatrix["people"][number],
	AccessMatrix["people"][number],
];

describe("who can see what", () => {
	it("shows a higher level on one account beside the holder-wide one", () => {
		const [onAnil] = cellsFor(ramesh, matrix.holders);
		expect(onAnil?.wide?.level).toBe("view");
		expect(onAnil?.accounts.map((a) => a?.level ?? null)).toEqual([null, "edit"]);
	});

	it("gives each account the level the person ends up with, and where it comes from", () => {
		expect(
			accountsSeenBy(ramesh, matrix.holders).map((s) => `${s.account.id}:${s.level}:${s.via}`),
		).toEqual(["a-z:view:holder", "a-g:edit:account", "s-z:view:holder"]);
		expect(levelCounts(accountsSeenBy(ramesh, matrix.holders))).toEqual([
			{ level: "edit", count: 1 },
			{ level: "view", count: 2 },
		]);
	});

	it("counts an Owner invite that is not confirmed yet as Can view", () => {
		const waiting = new Set(["g-v"]);
		expect(accountsSeenBy(vikram, matrix.holders, waiting)[0]?.level).toBe("view");
		expect(canEditSomething(vikram, waiting)).toBe(false);
		expect(canEditSomething(vikram)).toBe(true);
	});

	it("filters by level, by invite and by what is typed", () => {
		const keys = (list: AccessMatrix["people"]) => list.map((p) => p.key);
		expect(keys(filterPeople(matrix.people, "editors", ""))).toEqual(["me", "ramesh", "vikram@example.com"]);
		expect(keys(filterPeople(matrix.people, "invited", ""))).toEqual(["vikram@example.com"]);
		expect(keys(filterPeople(matrix.people, "everyone", "IYER"))).toEqual(["ramesh"]);
	});

	it("lists everyone on one account", () => {
		expect(peopleOnAccount(matrix, "a-g").map((p) => `${p.person.key}:${p.seen.level}`)).toEqual([
			"me:owner",
			"ramesh:edit",
			"vikram@example.com:owner",
		]);
	});

	it("removes only what the viewer may change", () => {
		const plan = removalPlan(ramesh, matrix.holders);
		expect(plan.grantIds).toEqual(["g-r-ag", "g-r-anil"]);
		expect(plan.stuck.map((s) => s.holder.id)).toEqual(["sunita"]);
		expect(removalPlan(me, matrix.holders).stuck).toEqual([]);
	});

	it("offers only what a person does not already have", () => {
		// Ramesh has all of Anil's and all of Sunita's: nothing more to give.
		expect(shareChoices(matrix.holders, ramesh)).toEqual([]);
		// Vikram is on one of Anil's accounts: the other, or all of Anil's — and
		// Sunita's one account, but not "all of Sunita's", which is not the viewer's to give.
		const choices = shareChoices(matrix.holders, vikram);
		expect(choices.map((c) => [c.holder.id, c.wide, c.accounts.map((a) => a.id)])).toEqual([
			["anil", true, ["a-z"]],
			["sunita", false, ["s-z"]],
		]);
	});

	it("names columns by broker, or by label when two share a broker", () => {
		expect(columnNames(matrix.holders[0] as AccessMatrix["holders"][number])).toEqual(["Zerodha", "Groww"]);
		expect(
			columnNames({
				...(matrix.holders[0] as AccessMatrix["holders"][number]),
				accounts: [account("one"), account("two")],
			}),
		).toEqual(["one label", "two label"]);
	});
});
