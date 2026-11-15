/**
 * Words for Groups — the list, the new/edit dialog and delete — from the
 * design's wording board. A group is a person's own saved set of accounts;
 * nothing here may suggest that making one shares anything.
 */

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** "Anil", "Anil or Riya", "Anil, Riya or Ramesh". */
const orList = (names: readonly string[]): string =>
	names.length <= 1
		? (names[0] ?? "")
		: `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;

export const GROUPS = {
	subtitle:
		"Sets of accounts to add up and compare — family, a fund manager, your own trading. Only you see them.",

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
	noMembers:
		"No accounts in this group — the ones it had are no longer shared with you, or it was saved empty.",

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
