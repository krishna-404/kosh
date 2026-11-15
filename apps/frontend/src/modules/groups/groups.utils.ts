import type { GroupKind } from "@connected-repo/zod-schemas/enums.zod";
import type {
	DirectoryAccount,
	DirectoryHolder,
	Group,
} from "@connected-repo/zod-schemas/kosh/people.zod";

type Valued = Pick<DirectoryAccount, "value">;

/** Money is shown only once at least one account has a value. */
export const anyValue = (accounts: readonly Valued[]): boolean =>
	accounts.some((account) => account.value !== null);

/** The values that exist, added up — null when none of these accounts has one yet. */
export const totalValue = (accounts: readonly Valued[]): number | null => {
	const known = accounts.flatMap((account) => (account.value === null ? [] : [Number(account.value)]));
	return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
};

/** Accounts under the holder they belong to. */
export interface HolderSection<
	H = DirectoryHolder,
	A = DirectoryAccount,
> {
	key: string;
	/** Null for accounts whose holder is not in the directory (shown as "Others"). */
	holder: H | null;
	accounts: A[];
}

/** The accounts someone can see, under the holder each belongs to — the caller's own first. */
export const accountsByHolder = <
	H extends Pick<DirectoryHolder, "id" | "isMe">,
	A extends Pick<DirectoryAccount, "personId">,
>(
	holders: readonly H[],
	accounts: readonly A[],
): HolderSection<H, A>[] => {
	const ordered = [...holders].sort((a, b) => Number(b.isMe) - Number(a.isMe));
	const sections: HolderSection<H, A>[] = ordered
		.map((holder) => ({
			key: holder.id,
			holder,
			accounts: accounts.filter((account) => account.personId === holder.id),
		}))
		.filter((section) => section.accounts.length > 0);
	const known = new Set(holders.map((holder) => holder.id));
	const rest = accounts.filter((account) => !known.has(account.personId));
	return rest.length > 0 ? [...sections, { key: "others", holder: null, accounts: rest }] : sections;
};

/** A group's accounts, in the group's own order, skipping any the directory no longer has. */
export const membersOf = <A extends Pick<DirectoryAccount, "id">>(
	group: Pick<Group, "accountIds">,
	accounts: readonly A[],
): A[] => {
	const byId = new Map(accounts.map((account) => [account.id, account]));
	return group.accountIds.flatMap((id) => {
		const account = byId.get(id);
		return account ? [account] : [];
	});
};

/** The kinds in use, in the wording board's order, with how many groups have each. */
export const kindCounts = (
	groups: readonly Pick<Group, "kind">[],
	order: readonly GroupKind[],
): { kind: GroupKind; count: number }[] =>
	order
		.map((kind) => ({ kind, count: groups.filter((group) => group.kind === kind).length }))
		.filter((entry) => entry.count > 0);

/** Another group that already has this name (ignoring case and outer spaces), if any. */
export const groupNamed = <G extends Pick<Group, "id" | "name">>(
	name: string,
	groups: readonly G[],
	exceptId?: string,
): G | undefined => {
	const wanted = name.trim().toLowerCase();
	if (wanted === "") return undefined;
	return groups.find((group) => group.id !== exceptId && group.name.trim().toLowerCase() === wanted);
};

/** Whether two selections hold the same accounts, in any order. */
export const sameAccounts = (a: Iterable<string>, b: Iterable<string>): boolean => {
	const left = new Set(a);
	const right = new Set(b);
	return left.size === right.size && [...left].every((id) => right.has(id));
};
