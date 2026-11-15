import { NAV } from "@frontend/copy/nav.copy";

/**
 * Words for "Who can see what", from the design's wording board.
 *
 * Never in the UI: role, tenant, grant, permission, ACL, user, revoke,
 * collaborator, entity. Say person, remove, "Can view", "Can edit", "Owner".
 */

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const WHO = {
	subtitle: "Everyone with any access to the people and accounts you own.",
	subtitleHint: "Click a level to change it.",

	viewLabel: "Show by",
	byPerson: "By person",
	byAccount: "By account",

	search: "Find a person",
	filterLabel: "Which people",
	filterEveryone: (n: number) => `Everyone · ${n}`,
	filterEditors: (n: number) => `Can edit or more · ${n}`,
	filterInvited: (n: number) => `Invited · ${n}`,
	noMatch: "Nobody matches that.",
	clearFilters: "Show everyone",

	// The grid
	gridLabel: "Who can see what, by person",
	personColumn: "Person",
	you: "You",
	invited: "Invited",
	invitedNotSignedIn: "Invited · not signed in",
	noAccess: "No access",
	allOf: (possessiveName: string) => `All of ${possessiveName}`,
	allOfInclNew: (possessiveName: string) => `All of ${possessiveName}, incl. new ones`,
	allOfAccounts: (possessiveName: string) => `All of ${possessiveName} accounts`,
	onlyThisAccount: "Only this account",
	/** "Sunita, all of Anil’s accounts: Can view. Change" */
	changeHolder: (who: string, possessiveName: string, level: string) =>
		`${who}, all of ${possessiveName} accounts: ${level}. Change`,
	changeAccount: (who: string, account: string, level: string) =>
		`${who}, ${account}: ${level}. Change`,
	openPerson: (who: string) => `${who}: everything they can see`,
	notYoursToChange: (holderName: string) =>
		`Only someone who owns all of ${holderName} accounts can change this.`,
	notYoursNote: (possessiveName: string) =>
		`“All of ${possessiveName}” isn’t yours to change — only someone who owns all of ${possessiveName} accounts can.`,
	legendWide: "Covers all of that person’s accounts, including ones added later",
	legendNone: "— no access",
	onlyOwned:
		"Only things you own are listed. Accounts other people share with you aren’t here because only their owners decide who sees those.",

	// The phone list
	allAccounts: (n: number) => (n === 1 ? "Your one account" : `All ${n} accounts`),
	someAccounts: (seen: number, total: number) => `${seen} of ${total} accounts`,
	countsNote: (total: number) =>
		total === 1
			? "Counts are accounts. You, its owner, aren’t listed."
			: `Counts are accounts. You (Owner of all ${total}) aren’t listed.`,

	// One person
	seesThese: (name: string, touch: boolean) =>
		`${name} can see these of yours. ${touch ? "Tap" : "Click"} one to change it.`,
	invitedTo: (email: string, touch: boolean) =>
		`${email} is invited to these of yours and hasn’t signed in yet. ${touch ? "Tap" : "Click"} one to change it.`,
	onTopOf: (possessiveName: string) => `On top of all of ${possessiveName}`,
	andAnyNew: (names: string[]) =>
		names.length === 0 ? "Any account added later" : `${names.join(", ")} and any new ones`,
	notSharedWith: (name: string) => `Not shared with ${name}`,
	/** Stands in for a name where an invite has only an address, too long for a heading or a button. */
	thisAddress: "this address",
	nothingHidden: (total: number) =>
		total === 1
			? "Nothing — they can see your one account."
			: `Nothing — they can see all ${total} of your accounts.`,
	shareMore: (name: string) => `Share more with ${name}`,
	shareMoreChoose: (name: string) => `What else should ${name} see?`,
	removeFromEverything: (name: string) => `Remove ${name} from everything`,
	removeTitle: (name: string) => `Remove ${name} from everything?`,
	removeBody: (n: number) =>
		`They’ll stop seeing ${plural(n, "that account", `these ${n} accounts`)} straight away. What they uploaded stays.`,
	removeStuck: (labels: string[], holderName: string) =>
		`They’ll still see ${labels.join(", ")} — that comes with all of ${holderName} accounts, which you don’t own all of.`,
	removeConfirm: (name: string) => `Remove ${name}`,
	keep: "Keep",
	cancelInvites: (n: number) => plural(n, "Cancel invite", `Cancel all ${n} invites`),
	cancelTitle: (email: string) => `Cancel the invite to ${email}?`,
	cancelBody: "The link stops working straight away. Nothing was shared.",
	cancelConfirm: "Cancel invite",
	keepInvite: "Keep invite",
	removed: (name: string) => `${name} no longer sees any of your accounts`,
	removedExcept: (name: string, labels: string[]) =>
		`Removed ${name} from everything you can change. They still see ${labels.join(", ")}.`,
	cancelled: (email: string) => `Invite to ${email} cancelled`,
	removedPartly: (name: string, done: number, total: number, why: string) =>
		`Removed ${name} from ${done} of ${total}. The rest didn’t go through: ${why}`,
	removeFailed: "Couldn’t remove them. Nothing was changed.",

	// By account
	accountsLabel: "Your accounts",
	pickAccount: "Which account",
	peopleOn: (label: string) => `People who can see ${label}`,
	heldBy: (broker: string, holder: string) => `${broker} · held by ${holder}`,
	inviteTo: (label: string) => `Invite to ${label}`,
	peopleCount: (n: number) => plural(n, "Only you", `${n} people`),

	// Choosing what to share
	chooseTitle: "What do you want to share?",
	chooseSubtitle: "Pick one account, or everything a person holds.",
	wideChoice: "Including accounts added later",
	inviteSomeone: "Invite someone",

	// Empty states
	empty: {
		title: "Only you can see your accounts",
		body: "Share an account or a person to let someone else see it.",
	},
	nothingOwned: {
		title: "Nothing of yours to share yet",
		body: "This page lists the people and accounts you own, and everyone who can see them. Add a person and their accounts first.",
		action: `Go to ${NAV.accounts}`,
	},

	loadFailed: "Couldn’t load who can see what.",
	tryAgain: "Try again",
} as const;
