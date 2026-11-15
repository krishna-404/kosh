import type { AccessLevel, HolderKind } from "@connected-repo/zod-schemas/enums.zod";

/**
 * Words for "Accounts and people", "Add a person" and "Add an account" —
 * from the design's wording board. Square-bracket blanks on the board are
 * the function arguments here.
 */

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const accountsCount = (n: number): string => count(n, "account", "accounts");
const peopleCount = (n: number): string => count(n, "person", "people");

export const ACCOUNTS = {
	/** The sentence under the page title. The amount is left out until there is one. */
	summaryLead: "Everything you can see:",
	summary: (accounts: number, holders: number): string =>
		accounts === 0
			? `${peopleCount(holders)}, no accounts yet.`
			: `${accountsCount(accounts)} held by ${peopleCount(holders)}.`,
	summaryWithTotal: (accounts: number, holders: number): string =>
		`in ${accountsCount(accounts)} held by ${peopleCount(holders)}.`,

	addPerson: "Add a person",
	addAccount: "Add an account",
	addMenuLabel: "Add a person or an account",

	owned: "You’re an owner",
	shared: "Shared with you",

	columns: {
		account: "Account",
		value: "Value",
		returns: "Return (XIRR)",
		you: "You",
		access: "Who has access",
	},

	/** The quiet line under a holder's name. */
	holderLine: (kind: HolderKind, accounts: number): string => {
		const n = accounts === 0 ? "No accounts yet" : accountsCount(accounts);
		if (kind === "no_login") return `No login · ${n}`;
		if (kind === "huf") return `Hindu Undivided Family · ${n}`;
		return n;
	},
	you: "You",
	shareAll: (firstName: string, kind: HolderKind): string =>
		kind === "huf" ? "Share all of the HUF’s" : `Share all of ${firstName}’s`,
	moreFor: (name: string): string => `More for ${name}`,
	shareAccount: (label: string): string => `Share ${label}`,
	share: "Share",
	rename: "Rename",
	thisIsMe: "This is me",
	thisIsMeHint: "Kosh shows this person as “You”",
	thisIsntMe: "This isn’t me",
	addAccountFor: (firstName: string): string => `Add an account for ${firstName}`,
	noAccountsYet: (firstName: string): string =>
		`No accounts for ${firstName} yet. Add the broker accounts you want to see here.`,

	/** "Who has access", owners only. */
	accessLine: (people: number, owners: number, invited: number): string => {
		if (invited > 0) return people === 1 ? "Only you" : String(people);
		if (people === 1) return "Only you";
		return owners === people ? `${people} owners` : peopleCount(people);
	},
	invited: (n: number): string => `${n} invited`,
	sharedBy: (firstName: string): string => `Shared by ${firstName}`,
	newTag: "New",
	nifty: "NIFTY on same money",

	markedAsMe: (name: string): string => `${name} is now shown as you`,
	unmarkedAsMe: (name: string): string => `${name} is no longer shown as you`,

	loadFailed: "Couldn’t load your accounts.",
	retry: "Try again",
} as const;

export const WELCOME = {
	title: (firstName: string): string => `Welcome to Kosh, ${firstName}`,
	body: "Start with the first person whose investments you want to see together — probably you.",
	addYourself: "Add yourself",
	addSomeoneElse: "Add someone else",
	expectingLead:
		"Expecting someone to share with you? It appears here as soon as they do — they need to use ",
} as const;

export const ADD_PERSON = {
	title: "Add a person",
	titleSelf: "Add yourself",
	name: "Name",
	namePlaceholder: "Their full name",
	nameSelfHelp: "The name your accounts are held in.",
	who: "Who is this?",
	kinds: {
		login: { title: "Someone who will use Kosh", hint: "You can invite them after adding" },
		no_login: { title: "Someone without a login", hint: "A child, or someone you look after" },
		huf: { title: "An HUF", hint: "Hindu Undivided Family" },
	} satisfies Record<HolderKind, { title: string; hint: string }>,
	ownerNote: (firstName: string): string =>
		`You’ll be ${firstName}’s owner. You can add another owner, like a parent, later.`,
	ownerNoteHuf: "You’ll be the HUF’s owner. You can add another owner later.",
	ownerNoteBlank: "You’ll be this person’s owner. You can add another owner, like a parent, later.",
	ownerNoteSelf: "You’ll be the owner of your accounts. Nobody else sees them until you share.",
	submit: (firstName: string): string => (firstName ? `Add ${firstName}` : "Add this person"),
	cancel: "Cancel",
	nameMissing: "Type their name first.",
	added: (name: string): string => `Added ${name}`,
	inviteThem: "Invite them",
	failed: "Couldn’t add this person. Try again.",
} as const;

export const ADD_ACCOUNT = {
	title: "Add an account",
	whose: "Whose account is it?",
	broker: "Broker",
	brokerName: "Broker’s name",
	brokerNamePlaceholder: "For example, Upstox",
	label: "Name in Kosh",
	submit: "Add account",
	cancel: "Cancel",
	brokerNameMissing: "Type the broker’s name.",
	labelMissing: "Give the account a name.",
	/** "[Sunita] will see this account too." */
	willSee: (names: readonly string[]): string => {
		const who =
			names.length <= 1
				? (names[0] ?? "")
				: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
		return `${who} will see this account too.`;
	},
	/** "They can view all of [Anil]'s accounts, including new ones." */
	willSeeWhy: (level: AccessLevel | "mixed", holderPossessive: string): string => {
		const all = `all of ${holderPossessive} accounts, including new ones.`;
		if (level === "mixed") return `They have access to ${all}`;
		if (level === "owner") return `They’re an owner of ${all}`;
		return `They can ${level} ${all}`;
	},
	change: "Change",
	added: (label: string): string => `Added ${label}`,
	failed: "Couldn’t add this account. Try again.",
} as const;

export const RENAME = {
	title: (name: string): string => `Rename ${name}`,
	person: "Name",
	account: "Name in Kosh",
	submit: "Save name",
	cancel: "Cancel",
	missing: "A name is needed.",
	done: (name: string): string => `Renamed to ${name}`,
	failed: "Couldn’t save the name. Try again.",
} as const;
