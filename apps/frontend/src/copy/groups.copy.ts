/**
 * Words for Groups — the comparison, "What if", year by year, the new/edit
 * dialog and delete — from the design's wording board. A group is a person's
 * own saved set of accounts; nothing here may suggest that making one shares
 * anything.
 */

import { MONEY } from "./money.copy";

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

const list =
	(word: string) =>
	(names: readonly string[]): string =>
		names.length <= 1
			? (names[0] ?? "")
			: `${names.slice(0, -1).join(", ")} ${word} ${names[names.length - 1]}`;

/** "Anil", "Anil or Riya", "Anil, Riya or Ramesh". */
const orList = list("or");
/** "Family", "Family and Kids", "Family, Kids and Ramesh". */
const andList = list("and");

export const GROUPS = {
	/** The page's heading; the tab and the navigation keep the one word, "Groups". */
	title: "Your groups, compared",
	intro:
		"A group is any set of accounts — a fund manager’s, a family’s, your own trading. Each is judged on its own deposits and withdrawals against NIFTY on the same dates.",
	/** The same, for a phone's width. */
	introShort: "Compared on the same money. Only you see your groups.",

	// Buttons
	newGroup: "New group",
	saveGroup: "Save group",
	saveEmpty: "Save without accounts",
	saving: "Saving…",
	cancel: "Cancel",
	edit: "Edit",
	delete: "Delete",
	retry: "Try again",
	more: (name: string) => `More for ${name}`,

	// The list
	kindFilterLabel: "Kind of group",
	allKinds: "All",
	accountsCount: (n: number) => `${n} ${plural(n, "account", "accounts")}`,
	/** "Riya · Dhan, Kabir · Zerodha, Anil · Groww +2 more" */
	membersLine: (labels: readonly string[], shown = 3) =>
		labels.length <= shown
			? labels.join(", ")
			: `${labels.slice(0, shown).join(", ")} +${labels.length - shown} more`,
	noAccountsShort: "No accounts",
	noMembers:
		"No accounts in this group — the ones it had are no longer shared with you, or it was saved empty.",

	// The comparison
	table: {
		label: "Your groups, compared with NIFTY on the same money",
		group: "Group",
		moneyNow: "Money now",
		return: "Return",
		nifty: "NIFTY",
		aheadOrBehind: "Ahead or behind, same money",
		yearsAhead: "Years ahead",
		more: "More",
	},
	/** What a tap on a group's name does. */
	openIn: (name: string) => `${name} — open in Overview`,
	// "ahead", "behind" and "a year" are the words every money page uses.
	ahead: MONEY.ahead,
	behind: MONEY.behind,
	level: "level",
	levelWith: "level with NIFTY",
	aYear: MONEY.aYear,
	niftyAt: "NIFTY",
	/** "2 of 3" — full calendar years ahead of NIFTY. */
	yearsOf: (ahead: number, counted: number) => `${ahead} of ${counted}`,
	yearsOfShort: (ahead: number, counted: number) =>
		`${ahead} of ${counted} ${plural(counted, "year", "years")} ahead`,
	noFullYear: "No full year yet",
	shortHistory: {
		title: "Not enough history yet",
		body: (name: string) =>
			`Returns over less than a year swing a lot. We’ll compare ${name} once it has a full year.`,
	},
	nothingUploaded: "Nothing uploaded in its accounts yet, so there is nothing to compare.",
	noReturn: "A return can’t be worked out from this group’s money yet.",
	/** Under the table. */
	sinceStart: "Return is the yearly rate (XIRR) since each group’s first money went in.",
	overlapNote: (example: { account: string; groups: readonly string[] } | null) =>
		`${
			example
				? `Groups can share accounts — ${example.account} is in ${example.groups.length === 2 ? "both " : ""}${andList(example.groups)}.`
				: "Groups can share accounts."
		} Compare them freely, but don’t add them up; that’s why there’s no total row.`,

	// When no group has figures
	noFigures: {
		title: "Nothing to compare yet",
		body: "None of the accounts in your groups has a statement yet. Upload one, and each group is compared with NIFTY on the same money.",
		action: "Go to Accounts and people",
	},
	figuresFailed: "Couldn’t load the comparison. Your groups are still here.",
	figuresStale: "Couldn’t refresh the comparison. These figures may be out of date.",

	// What if
	whatIf: {
		lead: "What if the money in",
		tail: "had followed another group?",
		/** With no other group to follow. */
		tailAlone: "had gone somewhere else?",
		pick: "Choose the group whose money it is",
		explain: (name: string) =>
			`The deposits and withdrawals that really went through ${name}, on the days they happened, earning what each other group earned — or put somewhere else entirely.`,
		explainAlone: (name: string) =>
			`The deposits and withdrawals that really went through ${name}, on the days they happened, put somewhere else.`,
		leftOut: (names: readonly string[], name: string) =>
			`${andList(names)} ${names.length === 1 ? "shares" : "share"} accounts with ${name}, so ${names.length === 1 ? "it is" : "they are"} left out.`,
		onlyGroup: "With one group there is no other group to follow yet.",
		/** Beside the group's own row, where the others have their difference. */
		happened: "what happened",
		/** Why a row has no figure. */
		startedLater: "started later",
		noFiguresYet: "no figures yet",
		noPrices: "no prices yet",
		startedLaterNote: (names: readonly string[], name: string) =>
			`${andList(names)} started after the first money went into ${name}, so there is nothing fair to compare.`,
		caution:
			"These are past returns: what the same money did elsewhere, not what it would do next.",
		cautionSmaller: (small: string, smallWorth: string, name: string, worth: string) =>
			`Past returns. ${small} holds much less money than ${name} (${smallWorth} against ${worth}) — a bigger one may not have done the same.`,
		failed: "Couldn’t work this out.",
		nothingYet: "Nothing uploaded yet",
	},

	// Year by year
	years: {
		title: "Year by year, ahead or behind NIFTY (percentage points)",
		soFar: "so far",
		partYear: "part of the year",
		notThere: "not there yet",
		note: (thisYear: number) =>
			`Figures in a dashed outline cover part of a year: the year a group started, and ${thisYear} so far. “Years ahead” counts full calendar years only.`,
	},

	empty: {
		title: "No groups yet",
		body: "Put accounts together your way — Parents, Kids, a fund manager, your own trading — and compare them on the same money. Only you see your groups.",
	},

	// New group / Edit group
	dialogNew: "New group",
	dialogEdit: "Edit group",
	nameLabel: "Name",
	namePlaceholder: "Parents",
	nameRequired: "Give the group a name.",
	nameTaken: (name: string) => `You already have a group called ${name}.`,
	kindLabel: "Kind",
	kindNote: "— optional, only a label; it shares nothing",
	accountsLabel: "Accounts",
	accountsNote: "Only accounts you can see are listed",
	others: "Others",
	selectAll: (firstName: string) => `Select all of ${firstName}’s`,
	clearAll: (firstName: string) => `Clear all of ${firstName}’s`,
	noAccounts: {
		title: "You need an account first",
		body: "A group is made of accounts, and there are none here yet. Add one — or wait for someone to share theirs with you.",
		action: "Go to Accounts and people",
	},
	everyAccount: {
		title: "That’s every account you can see",
		body: "A group can only hold accounts shared with you. If someone shares theirs, they’ll show up here.",
	},
	/** The gentle note before a group is saved with nothing in it. */
	savingEmpty: (name: string) =>
		`No accounts chosen. You can save ${name} empty and add accounts later — or tick some now.`,

	// The summary beside the checklist
	together: (name: string) => `${name || "This group"}, together`,
	noneChosen: "No accounts chosen yet",
	selected: (n: number) => `${n} selected`,
	noteOnlyYou: "Only you see this group. Making it shares nothing with anyone.",
	noteCompared: (name: string) =>
		`Once saved, ${name || "this group"} is compared with your other groups on the same money.`,
	/**
	 * What happens to a group holding accounts someone else shared.
	 * `account` is given when there is exactly one such account.
	 */
	noteShared: (sharers: readonly string[], account: string | null, withTotal: boolean) => {
		const who = sharers.length > 3 ? "someone" : orList(sharers);
		const what = account ?? "an account";
		return `If ${who} stops sharing ${what} with you, it leaves this group${withTotal ? " and the total changes" : ""}.`;
	},

	// What just happened
	saved: (name: string) => `Saved ${name}`,
	deleted: (name: string) => `Deleted ${name}`,

	// Delete
	deleteTitle: (name: string) => `Delete ${name}?`,
	deleteBody:
		"The accounts stay where they are and nothing changes about who can see them. Only this grouping goes.",
	deleteConfirm: "Delete group",
	deleteKeep: "Keep",

	// When something goes wrong
	loadFailed: "Couldn’t load your groups.",
	saveFailed: "Couldn’t save the group. Try again.",
	deleteFailed: "Couldn’t delete the group. Try again.",
} as const;
