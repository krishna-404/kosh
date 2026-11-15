import type {
	AccessEntry,
	AccessList,
	Directory,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { describe, expect, it } from "vitest";
import { checkEmail, existingEntry, refusalOf, wontSeeWords } from "./share.utils";

const entry = (over: Partial<AccessEntry>): AccessEntry => ({
	grantId: "g",
	level: "view",
	userId: "u",
	name: "Someone",
	email: "someone@example.com",
	pending: false,
	expired: false,
	expiresAt: null,
	isMe: false,
	addedHolder: false,
	needsConfirmation: false,
	grantedAt: 0,
	grantedByName: null,
	...over,
});

const me = entry({
	grantId: "me",
	level: "owner",
	name: "Anil Mehta",
	email: "anil@example.com",
	isMe: true,
});
const sunita = entry({
	grantId: "s",
	name: "Sunita Mehta",
	email: "sunita@example.com",
	level: "edit",
});
const ramesh = entry({
	grantId: "r",
	name: "Ramesh Iyer",
	email: "ramesh@iyercapital.in",
	level: "view",
});

const accountList: AccessList = {
	target: {
		kind: "account",
		id: "az",
		label: "Anil · Zerodha",
		holder: { id: "anil", displayName: "Anil Mehta", kind: "login" },
	},
	holderWide: [me, sunita],
	direct: [ramesh],
	onAccounts: [],
	ownsHolder: true,
};

const ask = (email: string, level: "view" | "edit" | "owner", keepAsTyped = false) =>
	checkEmail({ email, level, list: accountList, myEmail: "anil@example.com", keepAsTyped });

describe("checkEmail", () => {
	it("stops what is not an address, and the person's own", () => {
		expect(ask("priya at nair", "view")).toEqual({ kind: "invalid" });
		expect(ask("", "view")).toEqual({ kind: "invalid" });
		expect(ask("anil@example.com", "view")).toEqual({ kind: "self" });
	});

	it("says when the holder already covers them, but lets a raise through", () => {
		expect(ask("sunita@example.com", "view")).toEqual({
			kind: "covered",
			name: "Sunita",
			got: "edit",
		});
		expect(ask("sunita@example.com", "edit")).toEqual({
			kind: "covered",
			name: "Sunita",
			got: "edit",
		});
		expect(ask("sunita@example.com", "owner")).toBeNull();
	});

	it("says when they already have exactly this here, and lets a change through", () => {
		expect(ask("ramesh@iyercapital.in", "view")).toEqual({ kind: "same", name: "Ramesh" });
		expect(ask("ramesh@iyercapital.in", "edit")).toBeNull();
	});

	it("catches a typo once, and lets a kept address through", () => {
		expect(ask("vikram.sethi@gmial.com", "view")).toEqual({
			kind: "typo",
			typedDomain: "gmial.com",
			suggestion: "vikram.sethi@gmail.com",
			suggestedDomain: "gmail.com",
		});
		expect(ask("vikram.sethi@gmial.com", "view", true)).toBeNull();
		expect(ask("vikram.sethi@gmail.com", "view")).toBeNull();
	});
});

describe("existingEntry", () => {
	it("looks only at the target's own people, and skips an invite that ran out", () => {
		expect(existingEntry(accountList, "ramesh@iyercapital.in")).toBe(ramesh);
		expect(existingEntry(accountList, "sunita@example.com")).toBeUndefined();
		const lapsed = {
			...accountList,
			direct: [entry({ email: "old@example.com", pending: true, expired: true })],
		};
		expect(existingEntry(lapsed, "old@example.com")).toBeUndefined();
	});
});

describe("refusalOf", () => {
	it("reads the reason the server tags a refusal with, and nothing else", () => {
		expect(refusalOf({ status: 400, data: { code: "LAST_OWNER" } })).toBe("LAST_OWNER");
		expect(refusalOf({ status: 400, data: { code: "SELF" } })).toBe("SELF");
		expect(refusalOf({ status: 409, data: { code: "COVERED_BY_HOLDER" } })).toBe("COVERED_BY_HOLDER");
		// The sentence alone is not a reason: wording can change.
		expect(refusalOf({ status: 400, message: "This would leave no owner." })).toBeUndefined();
		expect(refusalOf({ status: 403, data: { domainCode: "FORBIDDEN" } })).toBeUndefined();
		expect(refusalOf(new TypeError("Failed to fetch"))).toBeUndefined();
	});
});

describe("wontSeeWords", () => {
	const account = (id: string, personId: string, label: string) =>
		({ id, personId, label }) as Directory["accounts"][number];
	const holder = (id: string, displayName: string) =>
		({ id, displayName }) as Directory["holders"][number];
	const directory = {
		me: { userId: "u", name: "Anil Mehta", email: "anil@example.com" },
		holders: [
			holder("anil", "Anil Mehta"),
			holder("kabir", "Kabir Mehta"),
			holder("huf", "Anil Mehta HUF"),
		],
		accounts: [
			account("az", "anil", "Anil · Zerodha"),
			account("ag", "anil", "Anil · Groww"),
			account("kz", "kabir", "Kabir · Zerodha"),
			account("hz", "huf", "Anil Mehta HUF · Zerodha"),
		],
	} as Directory;

	it("names the holder's other accounts, then other people's", () => {
		expect(wontSeeWords(directory, accountList.target)).toBe(
			"Anil · Groww, Kabir’s accounts, Anil Mehta HUF’s accounts, or any other account",
		);
	});

	it("leaves the whole holder out when the holder is shared", () => {
		expect(wontSeeWords(directory, { ...accountList.target, kind: "holder", id: "anil" })).toBe(
			"Kabir’s accounts, Anil Mehta HUF’s accounts, or any other account",
		);
	});

	it("says something true when there is nothing else", () => {
		expect(
			wontSeeWords(
				{ ...directory, accounts: [account("az", "anil", "Anil · Zerodha")] },
				accountList.target,
			),
		).toBe("Any other account");
		expect(wontSeeWords(undefined, accountList.target)).toBe("Any other account");
	});
});
