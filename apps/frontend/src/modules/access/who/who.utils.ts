import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type { AccessMatrix } from "@connected-repo/zod-schemas/kosh/people.zod";
import { brokerNameOf } from "@frontend/modules/access/people.utils";

/**
 * Reading the "who can see what" matrix: everything the signed-in person
 * owns × everyone on it. Pure functions, shared by the grid, the phone list,
 * the by-account view and the one-person sheet.
 */

export type MatrixHolder = AccessMatrix["holders"][number];
export type MatrixAccount = MatrixHolder["accounts"][number];
export type MatrixPerson = AccessMatrix["people"][number];

/** What the share dialog is opened on. */
export type ShareTarget = { accountId: string } | { personId: string };

const RANK: Record<AccessLevel, number> = { view: 0, edit: 1, owner: 2 };
export const LEVELS_HIGH_TO_LOW: readonly AccessLevel[] = ["owner", "edit", "view"];

export const isHigher = (a: AccessLevel, b: AccessLevel): boolean => RANK[a] > RANK[b];

/** One thing a person was given: a level, and the id to change or remove it by. */
export interface Entry {
	level: AccessLevel;
	grantId: string;
}

/**
 * An accepted Owner invite counts as "Can view" until an owner confirms it;
 * `unconfirmed` holds the ids of those still waiting.
 */
const worth = (entry: Entry, unconfirmed: ReadonlySet<string>): Entry =>
	unconfirmed.has(entry.grantId) ? { ...entry, level: "view" } : entry;

/** What one person has across one holder's columns. */
export interface HolderCells {
	holder: MatrixHolder;
	/** On the holder itself: all their accounts, including new ones. */
	wide: Entry | null;
	/**
	 * Per account, in column order: what to show in that column — the
	 * person's own entry on the account when there is no holder-wide one, or
	 * when it is higher than the holder-wide one. Null is "nothing of its own".
	 */
	accounts: (Entry | null)[];
}

export const cellsFor = (
	person: MatrixPerson,
	holders: readonly MatrixHolder[],
	unconfirmed: ReadonlySet<string> = new Set(),
): HolderCells[] =>
	holders.map((holder) => {
		const onHolder = person.holders.find((h) => h.personId === holder.id);
		const wide = onHolder ? worth(onHolder, unconfirmed) : null;
		return {
			holder,
			wide,
			accounts: holder.accounts.map((account) => {
				const own = person.accounts.find((a) => a.accountId === account.id);
				if (!own) return null;
				const entry = worth(own, unconfirmed);
				return wide && !isHigher(entry.level, wide.level) ? null : entry;
			}),
		};
	});

/** One account a person can see, the level they end up with, and where it comes from. */
export interface SeenAccount {
	account: MatrixAccount;
	holder: MatrixHolder;
	level: AccessLevel;
	via: "holder" | "account";
	grantId: string;
}

export const accountsSeenBy = (
	person: MatrixPerson,
	holders: readonly MatrixHolder[],
	unconfirmed: ReadonlySet<string> = new Set(),
): SeenAccount[] =>
	cellsFor(person, holders, unconfirmed).flatMap(({ holder, wide, accounts }) =>
		holder.accounts.flatMap((account, index): SeenAccount[] => {
			const own = accounts[index];
			if (own) return [{ account, holder, via: "account", ...own }];
			if (wide) return [{ account, holder, via: "holder", ...wide }];
			return [];
		}),
	);

export const allAccounts = (holders: readonly MatrixHolder[]): MatrixAccount[] =>
	holders.flatMap((h) => h.accounts);

/** How many accounts a person has at each level, highest level first. */
export const levelCounts = (seen: readonly SeenAccount[]): { level: AccessLevel; count: number }[] =>
	LEVELS_HIGH_TO_LOW.map((level) => ({
		level,
		count: seen.filter((s) => s.level === level).length,
	})).filter((c) => c.count > 0);

/** The name a person goes by on these screens: their name, or the address they were invited at. */
export const nameOf = (person: Pick<MatrixPerson, "name" | "email">): string =>
	person.name?.trim() || person.email;

export type PeopleFilter = "everyone" | "editors" | "invited";

export const canEditSomething = (
	person: MatrixPerson,
	unconfirmed: ReadonlySet<string> = new Set(),
): boolean =>
	[...person.holders, ...person.accounts].some((e) => worth(e, unconfirmed).level !== "view");

export const filterPeople = (
	people: readonly MatrixPerson[],
	filter: PeopleFilter,
	query: string,
	unconfirmed: ReadonlySet<string> = new Set(),
): MatrixPerson[] => {
	const q = query.trim().toLowerCase();
	return people.filter((person) => {
		if (filter === "editors" && !canEditSomething(person, unconfirmed)) return false;
		if (filter === "invited" && !person.pending) return false;
		if (!q) return true;
		return (person.name ?? "").toLowerCase().includes(q) || person.email.toLowerCase().includes(q);
	});
};

/**
 * What to call each of a holder's accounts under the holder's name: the
 * broker ("Zerodha") — or the account's own label when two of them are with
 * the same broker and the broker alone would not tell them apart.
 */
export const columnNames = (holder: MatrixHolder): string[] => {
	const brokers = holder.accounts.map(brokerNameOf);
	return holder.accounts.map((account, index) =>
		brokers.filter((b) => b === brokers[index]).length > 1 ? account.label : (brokers[index] ?? ""),
	);
};

/**
 * Removing someone "from everything": the entries the signed-in person may
 * end, and the holder-wide ones they may not (on a holder they only partly own).
 */
export const removalPlan = (
	person: MatrixPerson,
	holders: readonly MatrixHolder[],
): { grantIds: string[]; stuck: { holder: MatrixHolder }[] } => {
	const grantIds = person.accounts.map((a) => a.grantId);
	const stuck: { holder: MatrixHolder }[] = [];
	for (const entry of person.holders) {
		const holder = holders.find((h) => h.id === entry.personId);
		if (!holder) continue;
		if (holder.ownsHolder) grantIds.push(entry.grantId);
		else stuck.push({ holder });
	}
	return { grantIds, stuck };
};

/** Everyone who can see one account, with the level they end up with. */
export const peopleOnAccount = (
	matrix: AccessMatrix,
	accountId: string,
	unconfirmed: ReadonlySet<string> = new Set(),
): { person: MatrixPerson; seen: SeenAccount }[] =>
	matrix.people.flatMap((person) => {
		const seen = accountsSeenBy(person, matrix.holders, unconfirmed).find(
			(s) => s.account.id === accountId,
		);
		return seen ? [{ person, seen }] : [];
	});

/**
 * What a person could still be given: holder-wide access they do not have
 * (on holders the signed-in person owns outright), and accounts they cannot see.
 */
export const shareChoices = (
	holders: readonly MatrixHolder[],
	person?: MatrixPerson,
): { holder: MatrixHolder; wide: boolean; accounts: MatrixAccount[] }[] =>
	holders
		.map((holder) => {
			const hasWide = person?.holders.some((h) => h.personId === holder.id) ?? false;
			const seen = new Set(person?.accounts.map((a) => a.accountId));
			return {
				holder,
				wide: holder.ownsHolder && !hasWide,
				accounts: hasWide ? [] : holder.accounts.filter((a) => !seen.has(a.id)),
			};
		})
		.filter((choice) => choice.wide || choice.accounts.length > 0);
