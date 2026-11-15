import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type {
	AccessNotices,
	Directory,
	DirectoryAccount,
	DirectoryHolder,
	Group,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { listOf } from "@frontend/copy/shared.copy";
import { firstNameOf } from "@frontend/modules/access/people.utils";

/**
 * Reading the directory from the receiving end: what other people have
 * shared with the signed-in person, and what has only just arrived.
 */

export type Sharer = NonNullable<DirectoryAccount["sharedBy"]>;
export type Arrival = AccessNotices["arrivals"][number];

/** An account someone else shared, with its holder looked up. */
export interface SharedAccount {
	account: DirectoryAccount & { sharedBy: Sharer };
	holder: DirectoryHolder | undefined;
}

export const sharedAccounts = (directory: Directory): SharedAccount[] =>
	directory.accounts.flatMap((account) =>
		account.sharedBy
			? [
					{
						account: { ...account, sharedBy: account.sharedBy },
						holder: directory.holders.find((h) => h.id === account.personId),
					},
				]
			: [],
	);

/** One card of the page: a heading and the accounts under it. */
export interface SharedSection {
	key: string;
	sharer?: Sharer;
	group?: Group;
	rows: SharedAccount[];
}

/** Grouped by who shared, in the order the directory lists them. */
export const bySharer = (shared: readonly SharedAccount[]): SharedSection[] => {
	const sections = new Map<string, SharedSection>();
	for (const row of shared) {
		const sharer = row.account.sharedBy;
		const section = sections.get(sharer.userId) ?? { key: sharer.userId, sharer, rows: [] };
		section.rows.push(row);
		sections.set(sharer.userId, section);
	}
	return [...sections.values()];
};

/**
 * Grouped by the signed-in person's own groups. An account in two groups is
 * listed under both; `ungrouped` is whatever is in none.
 */
export const byGroup = (
	shared: readonly SharedAccount[],
	groups: readonly Group[],
): { sections: SharedSection[]; ungrouped: SharedAccount[] } => {
	const grouped = new Set<string>();
	const sections = groups.flatMap((group): SharedSection[] => {
		const rows = shared.filter((row) => group.accountIds.includes(row.account.id));
		for (const row of rows) grouped.add(row.account.id);
		return rows.length > 0 ? [{ key: group.id, group, rows }] : [];
	});
	return { sections, ungrouped: shared.filter((row) => !grouped.has(row.account.id)) };
};

/** The total of the amounts that exist, or null when none does yet. */
export const totalValue = (accounts: readonly Pick<DirectoryAccount, "value">[]): number | null => {
	const amounts = accounts.flatMap((a) => (a.value === null ? [] : [Number(a.value)]));
	return amounts.length > 0 ? amounts.reduce((sum, n) => sum + n, 0) : null;
};

/** "Mehta" from "Anil Mehta"; null for a single word. */
export const lastNameOf = (name: string): string | null => {
	const words = name.trim().split(/\s+/).filter(Boolean);
	return words.length > 1 ? (words[words.length - 1] ?? null) : null;
};

/** The surname everyone shares, if they all share one. */
export const sharedLastName = (names: readonly string[]): string | null => {
	const lasts = names.map(lastNameOf);
	const first = lasts[0];
	return first && lasts.every((last) => last === first) ? first : null;
};

/** "Anil and Sunita Mehta" for one family; otherwise full names, listed. */
export const namesOf = (names: readonly string[]): string => {
	const family = sharedLastName(names);
	return family && names.length > 1
		? `${listOf(names.map(firstNameOf))} ${family}`
		: listOf([...names]);
};

/** One line of what just arrived. */
export interface ArrivalRow {
	key: string;
	/** Null when a person arrived who has no accounts yet. */
	account: DirectoryAccount | null;
	label: string;
	/** The holder it belongs to, when known. */
	holderName: string | null;
	level: AccessLevel;
	/** It came as "all of this person's accounts", so later ones are included. */
	wide: boolean;
	/** Shared as Owner, but worth "Can view" until the sharer confirms. */
	awaitingOwner: boolean;
}

export interface ArrivalSection {
	sharer: Sharer;
	rows: ArrivalRow[];
}

/**
 * What just arrived, account by account, under whoever shared it. Something
 * shared as "all of a person's accounts" becomes one line per account they have.
 */
export const arrivalSections = (
	arrivals: readonly Arrival[],
	directory: Directory,
): ArrivalSection[] => {
	const sections = new Map<string, ArrivalSection>();
	const seen = new Set<string>();
	// Oldest first, the order the same accounts are listed in below.
	for (const arrival of [...arrivals].sort((a, b) => a.at - b.at)) {
		const section = sections.get(arrival.sharedBy.userId) ?? { sharer: arrival.sharedBy, rows: [] };
		sections.set(arrival.sharedBy.userId, section);

		const wide = arrival.target.kind === "holder";
		const accounts = directory.accounts.filter((a) =>
			wide ? a.personId === arrival.target.id : a.id === arrival.target.id,
		);
		const holderName = (personId: string) =>
			directory.holders.find((h) => h.id === personId)?.displayName ?? null;

		if (accounts.length === 0) {
			section.rows.push({
				key: arrival.grantId,
				account: null,
				label: arrival.target.label,
				holderName: wide ? arrival.target.label : null,
				level: arrival.level,
				wide,
				awaitingOwner: false,
			});
			continue;
		}
		for (const account of accounts) {
			if (seen.has(account.id)) continue;
			seen.add(account.id);
			section.rows.push({
				key: `${arrival.grantId}-${account.id}`,
				account,
				label: account.label,
				holderName: holderName(account.personId),
				level: account.myLevel,
				wide,
				awaitingOwner: arrival.level === "owner" && account.myLevel !== "owner",
			});
		}
	}
	return [...sections.values()];
};

/** The accounts a group made from the arrivals would hold. */
export const arrivedAccountIds = (sections: readonly ArrivalSection[]): string[] => [
	...new Set(sections.flatMap((s) => s.rows.flatMap((r) => (r.account ? [r.account.id] : [])))),
];
