import type { GroupKind } from "@connected-repo/zod-schemas/enums.zod";
import type { GroupsCompared, WhatIf } from "@connected-repo/zod-schemas/kosh/money.zod";
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

// ─── The comparison ─────────────────────────────────────────────────────

export type ComparedGroup = GroupsCompared["groups"][number];

/**
 * Where a group stands in the comparison.
 * - `ranked`: a year or more of history and a return to set beside NIFTY's.
 * - `unranked`: figures, but no return can be worked out from them.
 * - `short`: under a year of history — shown, not ranked.
 * - `none`: nothing uploaded in any of its accounts (or it has no accounts).
 * - `pending`: its figures have not arrived yet (just made, still loading).
 */
export type Standing = "ranked" | "unranked" | "short" | "none" | "pending";

/**
 * A group's standing. Whether anything has been uploaded comes from the
 * accounts themselves (`uploaded`): the comparison gives an empty group
 * zeros, which must not be read as figures.
 */
export const standingOf = (
	figures: Pick<ComparedGroup, "shortHistory" | "aheadPoints"> | undefined,
	uploaded: boolean,
): Standing => {
	if (!uploaded) return "none";
	if (figures === undefined) return "pending";
	if (figures.shortHistory) return "short";
	return figures.aheadPoints === null ? "unranked" : "ranked";
};

const STANDING_ORDER: Record<Standing, number> = {
	ranked: 0,
	unranked: 1,
	short: 2,
	none: 3,
	pending: 3,
};

/**
 * The table's order: furthest ahead of NIFTY first. Groups that cannot be
 * ranked follow — no return, then too little history, then no figures — by name.
 */
export const rankGroups = <
	R extends { name: string; standing: Standing; aheadPoints: number | null },
>(
	rows: readonly R[],
): R[] =>
	[...rows].sort(
		(a, b) =>
			STANDING_ORDER[a.standing] - STANDING_ORDER[b.standing] ||
			(a.standing === "ranked" && b.standing === "ranked"
				? (b.aheadPoints ?? 0) - (a.aheadPoints ?? 0)
				: 0) ||
			a.name.localeCompare(b.name),
	);

/** The groups a kind chip shows; groups with no kind are under "All" only. */
export const ofKind = <G extends { kind: GroupKind | null }>(
	groups: readonly G[],
	kind: GroupKind | "all",
): G[] => (kind === "all" ? [...groups] : groups.filter((group) => group.kind === kind));

/**
 * Ahead, behind or level — decided on the figure as it is shown (one decimal
 * of a percentage point), so "0.0" is never painted as a gain or a loss.
 */
export const leaningOf = (points: number): "ahead" | "behind" | "level" => {
	if (Number(Math.abs(points * 100).toFixed(1)) === 0) return "level";
	return points > 0 ? "ahead" : "behind";
};

/** The longest bar on the ahead-or-behind scale: the largest gap among ranked groups. */
export const widestGap = (points: readonly (number | null)[]): number =>
	Math.max(0, ...points.map((value) => Math.abs(value ?? 0)));

// ─── Groups that share accounts ─────────────────────────────────────────

/** The other groups holding at least one of this group's accounts. */
export const sharingWith = <G extends Pick<Group, "id" | "accountIds">>(
	group: G,
	groups: readonly G[],
): G[] =>
	groups.filter(
		(other) => other.id !== group.id && other.accountIds.some((id) => group.accountIds.includes(id)),
	);

/**
 * One account that sits in more than one group, with the groups it is in —
 * the example for "groups can share accounts". Null when none is shared.
 */
export const sharedExample = (
	groups: readonly Pick<Group, "name" | "accountIds">[],
	accounts: readonly Pick<DirectoryAccount, "id" | "label">[],
): { account: string; groups: string[] } | null => {
	for (const account of accounts) {
		const holding = groups.filter((group) => group.accountIds.includes(account.id));
		if (holding.length > 1) return { account: account.label, groups: holding.map((group) => group.name) };
	}
	return null;
};

// ─── What if ────────────────────────────────────────────────────────────

export interface WhatIfLine {
	/** A group's id or a benchmark's slug. */
	id: string;
	name: string;
	kind: WhatIf["rows"][number]["kind"];
	/** What the money would be worth now; null when it cannot fairly be worked out. */
	value: number | null;
	/** Rupees more (+) or less (−) than what really happened. Null for the group itself and where there is no value. */
	difference: number | null;
	/** 0 to 1 — this bar's length against the longest. */
	share: number;
}

/**
 * The rows of "What if": the group itself, the groups it shares no account
 * with (`leftOut` holds the ones it does), and the benchmarks — highest
 * first, rows with no value last.
 */
export const whatIfLines = (
	whatIf: Pick<WhatIf, "value" | "rows">,
	leftOut: ReadonlySet<string> = new Set(),
): WhatIfLine[] => {
	const actual = Number(whatIf.value);
	const kept = whatIf.rows
		.filter((row) => row.kind !== "group" || !leftOut.has(row.id))
		.map((row) => ({ ...row, value: row.value === null ? null : Number(row.value) }));
	const longest = Math.max(0, ...kept.map((row) => row.value ?? 0));
	return kept
		.map((row) => ({
			...row,
			difference: row.kind === "self" || row.value === null ? null : row.value - actual,
			share: row.value !== null && longest > 0 ? Math.max(0, row.value) / longest : 0,
		}))
		.sort((a, b) => (b.value ?? Number.NEGATIVE_INFINITY) - (a.value ?? Number.NEGATIVE_INFINITY));
};

/** A group holding under a third of the money counts as much smaller. */
const MUCH_SMALLER = 1 / 3;

/**
 * The group a reader is most likely to over-read: it came out ahead of what
 * really happened, but holds much less money than the group asked about.
 * `worth` is what each group is worth now. Null when there is no such group.
 */
export const smallButAhead = (
	lines: readonly WhatIfLine[],
	ownWorth: number,
	worth: ReadonlyMap<string, number>,
): WhatIfLine | null =>
	lines.find((line) => {
		const theirs = worth.get(line.id);
		return (
			line.kind === "group" &&
			line.difference !== null &&
			line.difference > 0 &&
			theirs !== undefined &&
			theirs > 0 &&
			theirs < ownWorth * MUCH_SMALLER
		);
	}) ?? null;

// ─── Year by year ───────────────────────────────────────────────────────

export interface YearCell {
	year: number;
	/** Return minus NIFTY's on the same money that year; null when the group was not there. */
	points: number | null;
	/** Only part of the year is behind this figure: the year the group started, or the year still running. */
	partYear: boolean;
}

/**
 * Each group's years, oldest first. The comparison counts full calendar
 * years only (`yearsCounted`); a group with one more past year than that
 * started part-way through its first, and the year still running is a part
 * year for everyone.
 */
export const yearCells = (
	compared: {
		groups: readonly Pick<ComparedGroup, "groupId" | "yearsCounted">[];
		years: GroupsCompared["years"];
	},
	thisYear: number,
): Map<string, YearCell[]> => {
	const years = [...compared.years].sort((a, b) => a.year - b.year);
	const out = new Map<string, YearCell[]>();
	for (const group of compared.groups) {
		const cells = years.map((row) => ({
			year: row.year,
			points: row.cells.find((cell) => cell.groupId === group.groupId)?.points ?? null,
		}));
		const past = cells.filter((cell) => cell.points !== null && cell.year < thisYear);
		const startYear = past.length > group.yearsCounted ? past[0]?.year : undefined;
		out.set(
			group.groupId,
			cells.map((cell) => ({
				...cell,
				partYear: cell.points !== null && (cell.year >= thisYear || cell.year === startYear),
			})),
		);
	}
	return out;
};

export interface YearGrid {
	years: number[];
	rows: { groupId: string; cells: YearCell[] }[];
}

/**
 * The grid for the groups listed, in that order: groups with no year at all
 * are left out, and so are the years before any of the listed groups began.
 */
export const yearGrid = (
	cells: ReadonlyMap<string, readonly YearCell[]>,
	order: readonly string[],
): YearGrid => {
	const rows = order.flatMap((groupId) => {
		const own = cells.get(groupId) ?? [];
		return own.some((cell) => cell.points !== null) ? [{ groupId, cells: own }] : [];
	});
	const first = Math.min(
		...rows.flatMap((row) => row.cells.filter((cell) => cell.points !== null).map((cell) => cell.year)),
	);
	const kept = rows.map((row) => ({ ...row, cells: row.cells.filter((cell) => cell.year >= first) }));
	return { years: kept[0]?.cells.map((cell) => cell.year) ?? [], rows: kept };
};

/** A group's full calendar years, oldest first, and whether it beat NIFTY in each. */
export const fullYears = (cells: readonly YearCell[]): { year: number; ahead: boolean }[] =>
	cells.flatMap((cell) =>
		cell.points === null || cell.partYear ? [] : [{ year: cell.year, ahead: cell.points > 0 }],
	);
