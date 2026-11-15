import type { ActivityItem } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ACTIVITY_SENTENCE, type SentencePart } from "@frontend/copy/activity.copy";
import { describe, expect, it } from "vitest";
import { actorsIn, groupByDay, uniqueById, waitingInvites } from "./activity.utils";

const LEVEL = { view: "[Can view]", edit: "[Can edit]", owner: "[Owner]" } as const;

/** A sentence as plain words, the way it reads on screen. */
const words = (parts: readonly SentencePart[]): string =>
	parts
		.map((part) => {
			if (typeof part === "string") return part;
			if ("strong" in part) return part.strong;
			if ("account" in part) return part.account.label;
			if ("holder" in part)
				return part.form === "name" ? part.holder.label : `all of ${part.holder.label}'s accounts`;
			if ("level" in part) return `${part.lead ?? ""}${LEVEL[part.level]}`;
			return "[Not signed in yet]";
		})
		.join("");

const me = { key: "u:anil", name: "Anil Mehta", isMe: true };
const ramesh = { key: "u:ramesh", name: "Ramesh Iyer", isMe: false };
const account = { kind: "account", id: "a1", label: "Anil · Zerodha" } as const;
const holder = { kind: "holder", id: "h1", label: "Anil Mehta" } as const;

let nextId = 0;
const entry = (kind: ActivityItem["kind"], over: Partial<ActivityItem> = {}): ActivityItem => ({
	id: `e${nextId++}`,
	at: 0,
	kind,
	actor: null,
	subject: null,
	level: null,
	fromLevel: null,
	target: null,
	detail: null,
	inviteOpen: false,
	...over,
});

const say = (item: ActivityItem, waiting = false) =>
	words(ACTIVITY_SENTENCE[item.kind](item, { waiting }).parts);

describe("activity sentences", () => {
	it("says “You” for the viewer and “you” when it happened to them", () => {
		expect(
			say(
				entry("level_changed", {
					actor: me,
					subject: { ...ramesh, pending: false },
					level: "edit",
					fromLevel: "view",
				}),
			),
		).toBe("You changed Ramesh Iyer from [Can view] to [Can edit]");
		expect(
			say(
				entry("level_changed", {
					actor: ramesh,
					subject: { ...me, pending: false },
					level: "edit",
					fromLevel: "view",
				}),
			),
		).toBe("Ramesh Iyer changed you from [Can view] to [Can edit]");
		expect(say(entry("removed", { actor: ramesh, subject: { ...me, pending: false } }))).toBe(
			"Ramesh Iyer removed you",
		);
	});

	it("names the account or the holder's accounts when sharing", () => {
		const shared = entry("access_given", {
			actor: me,
			subject: { ...ramesh, pending: false },
			level: "edit",
			target: account,
		});
		expect(say(shared)).toBe("You shared Anil · Zerodha with Ramesh Iyer — [Can edit]");
		expect(ACTIVITY_SENTENCE.access_given(shared, { waiting: false }).namesTarget).toBe(true);
		expect(
			say(
				entry("access_given", {
					actor: ramesh,
					subject: { ...me, pending: false },
					level: "view",
					target: holder,
				}),
			),
		).toBe("Ramesh Iyer shared all of Anil Mehta's accounts with you — [Can view]");
	});

	it("tags an invite only while it is waiting", () => {
		const invite = entry("invited", {
			actor: me,
			subject: { name: "vikram.sethi@gmail.com", isMe: false, pending: true },
			level: "view",
			target: account,
		});
		expect(say(invite, true)).toBe(
			"You invited vikram.sethi@gmail.com — [Can view] [Not signed in yet]",
		);
		expect(say(invite, false)).toBe("You invited vikram.sethi@gmail.com — [Can view]");
	});

	it("has words for entries nobody did", () => {
		const subject = { name: "x@y.in", isMe: false, pending: true };
		expect(say(entry("invite_expired", { subject }))).toBe(
			"The invite to x@y.in ran out. It was never used.",
		);
		expect(say(entry("invite_reported_wrong", { subject }))).toBe(
			"The person who received the invite to x@y.in said it reached the wrong person. It was stopped.",
		);
		expect(
			say(entry("owner_confirmed", { subject: { ...ramesh, pending: false }, level: "owner" })),
		).toBe("Ramesh Iyer was confirmed as [Owner]");
		expect(
			say(entry("owner_confirmed", { subject: { ...me, pending: false }, level: "owner" })),
		).toBe("You were confirmed as [Owner]");
	});

	it("covers adding, accepting and leaving", () => {
		expect(say(entry("holder_added", { actor: me, target: holder }))).toBe("You added Anil Mehta");
		expect(say(entry("account_added", { actor: me, target: account }))).toBe(
			"You added Anil · Zerodha",
		);
		expect(
			say(
				entry("invite_accepted", {
					actor: ramesh,
					subject: { ...ramesh, pending: false },
					level: "edit",
				}),
			),
		).toBe("Ramesh Iyer signed in and accepted the invite — [Can edit]");
		expect(
			say(entry("left", { actor: ramesh, subject: { ...ramesh, pending: false }, target: account })),
		).toBe("Ramesh Iyer stopped seeing Anil · Zerodha");
		expect(
			say(entry("left", { actor: me, subject: { ...me, pending: false }, target: account })),
		).toBe("You stopped seeing Anil · Zerodha");
	});

	it("never breaks on kinds from a later phase, or on missing pieces", () => {
		expect(say(entry("upload", { actor: ramesh, detail: "Tradebook.csv, 214 lines" }))).toBe(
			"Ramesh Iyer uploaded a statement — Tradebook.csv, 214 lines",
		);
		expect(say(entry("undo", { actor: ramesh }))).toBe("Ramesh Iyer undid an upload");
		expect(say(entry("answer"))).toBe("Someone answered a question");
		expect(say(entry("access_given"))).toBe("Someone shared an account with someone");
		expect(say(entry("level_changed", { actor: me }))).toBe("You changed what someone can do");
	});
});

describe("waitingInvites", () => {
	it("tags exactly the invites the server says are still open", () => {
		const invite = (id: string, inviteOpen: boolean) =>
			entry("invited", { id, inviteOpen, subject: { name: "v@x.in", isMe: false, pending: true }, target: account });
		expect([...waitingInvites([invite("open", true), invite("used", false), entry("upload", { id: "u" })])]).toEqual([
			"open",
		]);
	});

	it("tells apart two people with the same name", () => {
		const other = { key: "u:ramesh-2", name: "Ramesh Iyer", isMe: false };
		expect(actorsIn([entry("upload", { actor: ramesh }), entry("upload", { actor: other })])).toHaveLength(2);
	});
});

describe("feed helpers", () => {
	it("groups entries under day headings, newest first", () => {
		const now = new Date(2026, 10, 15, 12, 0).getTime();
		const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).getTime();
		const days = groupByDay(
			[
				entry("upload", { at: at(15, 10) }),
				entry("upload", { at: at(15, 9) }),
				entry("upload", { at: at(14, 21) }),
				entry("upload", { at: at(12, 11) }),
			],
			now,
		);
		expect(days.map((day) => [day.label, day.items.length])).toEqual([
			["Today", 2],
			["Yesterday", 1],
			["12 Nov", 1],
		]);
	});

	it("shows an entry once and lists who did things, the viewer first", () => {
		const a = entry("upload", { actor: ramesh });
		const b = entry("upload", { actor: me });
		const c = entry("invite_expired");
		expect(uniqueById([a, b, a, c])).toEqual([a, b, c]);
		expect(actorsIn([a, b, a, c]).map((actor) => actor.name)).toEqual(["Anil Mehta", "Ramesh Iyer"]);
	});
});
