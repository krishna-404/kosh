import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import { NAV } from "@frontend/copy/nav.copy";
import { possessive } from "@frontend/modules/access/people.utils";

/**
 * Words for "Shared with me", the arrival of something newly shared, and the
 * notices shown above every page — from the design's wording board.
 *
 * Never in the UI: role, tenant, grant, permission, ACL, user, revoke,
 * collaborator, entity. Say person, remove, "Can view", "Can edit", "Owner".
 */

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "Anil", "Anil and Sunita", "Anil, Sunita and Deepak". */
export const listOf = (items: readonly string[]): string =>
	items.length <= 1
		? (items[0] ?? "")
		: `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export const SHARED = {
	/** "5 accounts, " … ", shared by 3 people." — the total sits between when there is one. */
	countAccounts: (n: number) => count(n, "account", "accounts"),
	sharedBy: (people: number) => `shared by ${count(people, "person", "people")}.`,
	fallbackSubtitle: "Accounts other people have shared with you, and what you can do with each.",

	groupBy: "Group by",
	byWhoShared: "Who shared",
	byMyGroups: "My groups",

	questionsWaiting: (n: number) => (n === 1 ? "1 question is waiting" : `${n} questions are waiting`),
	questionsOn: (parts: string[]) => ` on accounts you can edit — ${parts.join(", ")}.`,
	questionsOnAccount: (n: number, label: string) => `${n} on ${label}`,
	answerThem: "Answer them",

	from: (name: string) => `From ${name}`,
	sharerLine: (email: string, n: number) => `${email} · ${count(n, "account", "accounts")}`,
	isNew: "New",
	allOfAccounts: (possessiveName: string) => `All of ${possessiveName} accounts`,
	fromFirstName: (name: string) => `from ${name}`,
	questions: (n: number) => count(n, "question", "questions"),
	nothingWaiting: "Nothing waiting",
	viewOnly: "View only",
	more: (label: string) => `More for ${label}`,

	// My groups
	groupLine: (shared: number, total: number) =>
		shared === total
			? count(total, "account", "accounts")
			: `${shared} of its ${count(total, "account", "accounts")} shared with you`,
	notInAGroup: "Not in a group",
	notInAGroupLine: (n: number) => count(n, "account", "accounts"),
	noGroups:
		"You haven’t made any groups yet. A group keeps accounts together your way — a family, a fund manager’s clients — and only you see it.",
	goToGroups: `Go to ${NAV.groups}`,

	// Stop seeing
	stopSeeing: "Stop seeing this",
	stopTitle: (label: string) => `Stop seeing ${label}?`,
	stopBody: (sharer: string) =>
		`It leaves your accounts and your groups straight away. To see it again, ${sharer} would have to share it with you again.`,
	stopConfirm: "Stop seeing it",
	stopWideTitle: (possessiveName: string) => `Stop seeing all of ${possessiveName} accounts?`,
	stopWideBody: (label: string, possessiveName: string, others: string[]) =>
		others.length === 0
			? `${label} is shared with you as part of all of ${possessiveName} accounts, so this covers any account added for them later too.`
			: `${label} is shared with you as part of all of ${possessiveName} accounts. You’ll stop seeing all of them — ${listOf([label, ...others])} — and any added later.`,
	stopWideAfter: (sharer: string) =>
		`They leave your accounts and your groups straight away. To see them again, ${sharer} would have to share them with you again.`,
	stopWideConfirm: (possessiveName: string) => `Stop seeing all of ${possessiveName}`,
	// One account where you have more than on the rest of that person's accounts.
	stepDownTitle: (level: string, label: string) => `Give up ${level} on ${label}?`,
	stepDownBody: (label: string, possessiveName: string, level: string) =>
		`You’ll still see ${label}, as ${level}: all of ${possessiveName} accounts are shared with you. To stop seeing it altogether, choose “Stop seeing this” again afterwards — that covers all of ${possessiveName} accounts.`,
	stepDownConfirm: (level: string) => `Give up ${level}`,
	steppedDown: (level: string, label: string) => `You now have ${level} on ${label}`,
	keep: "Keep",
	stopped: (label: string) => `You no longer see ${label}`,
	stoppedWide: (possessiveName: string) => `You no longer see ${possessiveName} accounts`,
	stopFailed: "Couldn’t do that. Nothing was changed.",
	stopPartly: (why: string) => `Only some of them went through: ${why}`,
	lastOwnerTitle: (label: string) => `${label} needs an owner`,
	lastOwnerBody:
		"You’re its only owner. Make someone else an owner first, so someone can still decide who sees it. Then you can step back.",
	chooseOwner: "Choose a new owner",
	keepMeOwner: "Keep me as owner",

	empty: {
		title: "Nothing shared with you yet",
		body: (email: string) => `When someone shares an account with ${email}, it appears here.`,
	},
	loadFailed: "Couldn’t load what is shared with you.",
	tryAgain: "Try again",
} as const;

const LEVEL_MEANS: Record<AccessLevel, string> = {
	view: "Can view: see everything, change nothing.",
	edit: "Can edit: upload statements, undo uploads, answer questions.",
	owner: "Owner: everything, including inviting people and changing who sees it.",
};

const LEVEL_FOR_YOU: Record<AccessLevel, string> = {
	view: "You can look, not change",
	edit: "You can upload statements and answer questions",
	owner: "You can also share it and change who sees it",
};

export const ARRIVAL = {
	welcome: (firstName: string) => `Welcome back, ${firstName}`,
	title: (accounts: number) =>
		accounts === 1 ? "1 account was just shared with you" : `${accounts} accounts were just shared with you`,
	/** When what arrived is a person with no accounts yet. */
	titleNoAccounts: (possessiveName: string) =>
		`All of ${possessiveName} accounts were just shared with you`,
	from: (names: string, accounts: number) =>
		`From ${names}. ${accounts === 1 ? "It sits" : "They sit"} apart from your other accounts — nothing is mixed.`,
	fromSharer: (name: string) => `From ${name}`,
	isNew: "New",
	wideLine: (possessiveName: string) => `Includes ${possessiveName} accounts added later`,
	wideTitle: (possessiveName: string) => `All of ${possessiveName} accounts`,
	noneYet: "None yet — they appear here as they are added",
	questionsLine: (n: number) =>
		n === 1 ? "1 question waiting for you" : `${n} questions waiting for you`,
	ownerOnceConfirmed: (firstName: string) =>
		`You’ll be an owner once ${firstName} confirms it’s you. Until then you can view.`,
	levelForYou: LEVEL_FOR_YOU,
	levelMeans: LEVEL_MEANS,
	gotIt: "Got it",

	keepFamily: "Keep this family together",
	keepThese: "Keep these together",
	keepBody: (n: number) =>
		`Save these ${n} as a group to see their combined returns and keep them apart from your other accounts. Only you see your groups.`,
	groupName: "Group name",
	groupNameHint: "For example “Mehta household”",
	groupNameMissing: "Give the group a name.",
	household: (lastName: string) => `${lastName} household`,
	saveGroup: "Save group",
	notNow: "Not now",
	saved: (name: string) => `Saved “${name}”`,
	openGroups: `Open ${NAV.groups}`,
	saveFailed: "Couldn’t save the group. Try again.",

	everything: "Everything shared with you",
} as const;

export const NOTICES = {
	/** One account by its name; a holder as "All of Kabir Mehta’s accounts". */
	lostTitle: (label: string, kind: "account" | "holder") =>
		kind === "holder"
			? `All of ${possessive(label)} accounts are no longer shared with you`
			: `${label} is no longer shared with you`,
	lostBy: (name: string, when: string, kind: "account" | "holder") =>
		`${name} changed this ${when}. Nothing from ${kind === "holder" ? "these accounts" : "this account"} is shown any more.`,
	lost: (when: string, kind: "account" | "holder") =>
		`This changed ${when}. Nothing from ${kind === "holder" ? "these accounts" : "this account"} is shown any more.`,
	/** "at 16:12", "yesterday at 21:10", "on 13 Nov at 16:05". */
	at: (time: string) => `at ${time}`,
	yesterdayAt: (time: string) => `yesterday at ${time}`,
	onDayAt: (day: string, time: string) => `on ${day} at ${time}`,
	dismiss: (label: string) => `Dismiss: ${label} is no longer shared with you`,

	toConfirm: (who: string, target: string) =>
		`${who} signed in to the Owner invite for ${target}. Until you confirm it’s who you meant, they can only view.`,
	allOf: (possessiveName: string) => `all of ${possessiveName} accounts`,
	confirm: (firstName: string) => `Confirm ${firstName} as owner`,
	remove: "Remove",
	removeNamed: (name: string) => `Remove ${name}`,
	confirmed: (name: string, target: string) => `${name} is now an owner of ${target}`,
	removed: (name: string, target: string) => `${name} no longer sees ${target}`,
	confirmFailed: "Couldn’t confirm. Try again.",
	removeFailed: "Couldn’t remove them. Try again.",
	someone: "Someone",
} as const;
