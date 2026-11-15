import { formatDayLabel } from "@connected-repo/ui-mui/format/date";
import { formatMoney, toNumber } from "@connected-repo/ui-mui/format/money";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import type { DirectoryAccount, DirectoryHolder } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { listOf } from "@frontend/copy/shared.copy";
import { firstNameOf } from "@frontend/modules/access/people.utils";

/**
 * The account page's pure logic: which tabs a level sees, the sentence that
 * says what a level may do, how the deposits and withdrawals are counted,
 * and how "ahead" and "behind" are worded. No React, no fetching.
 */

// ─── Tabs ────────────────────────────────────────────────────────────────

/** Every tab, in the order the page shows them. The value is what `?tab=` carries. */
export const ACCOUNT_TABS = ["returns", "holdings", "cash", "statements", "worked-out"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** Uploading, undoing and answering need Can edit or Owner. */
export const canEditAccount = (level: AccessLevel): boolean => level !== "view";

/** The tabs a level sees. "Statements and questions" is hidden — not disabled — for Can view. */
export const tabsFor = (level: AccessLevel): AccountTab[] =>
	ACCOUNT_TABS.filter((tab) => tab !== "statements" || canEditAccount(level));

/** The tab an address asks for; Returns when it names none, or one this level does not see. */
export const tabFromParam = (raw: string | null, level: AccessLevel): AccountTab =>
	tabsFor(level).find((tab) => tab === raw) ?? "returns";

/** In the address, which tab is open. */
export const TAB_PARAM = "tab";
/** Belong to one tab only, so they do not travel to another. */
const TAB_ONLY_PARAMS = ["upload", "view"] as const;

/**
 * The query string for a tab of this account. Whatever else the address
 * carries — the period — is kept; Returns, the default, needs no `tab` at all.
 */
export const tabSearch = (
	current: URLSearchParams,
	tab: AccountTab,
	extra: Record<string, string> = {},
): string => {
	const next = new URLSearchParams(current);
	for (const key of TAB_ONLY_PARAMS) next.delete(key);
	if (tab === "returns") next.delete(TAB_PARAM);
	else next.set(TAB_PARAM, tab);
	for (const [key, value] of Object.entries(extra)) next.set(key, value);
	const search = next.toString();
	return search ? `?${search}` : "";
};

// ─── The header ──────────────────────────────────────────────────────────

/** Who to turn to for what this level cannot do: whoever shared the account, by first name. */
export const askName = (account: Pick<DirectoryAccount, "sharedBy">): string | null =>
	account.sharedBy ? firstNameOf(account.sharedBy.name) : null;

/** The one sentence under the account's name; `short` is the phone's line beside the badge. */
export const levelSentence = (level: AccessLevel, ask: string | null, short = false): string =>
	(short ? ACCOUNT.levelShort : ACCOUNT.levelSentence)[level](ask);

/** Where the page was reached from: Shared with me when someone shared it, else Accounts and people. */
export const cameFrom = (
	account: Pick<DirectoryAccount, "sharedBy">,
	holder: Pick<DirectoryHolder, "displayName">,
): { to: string; parent: string; here: string } =>
	account.sharedBy
		? { to: ROUTES.shared, parent: NAV.shared, here: ACCOUNT.from(account.sharedBy.name) }
		: { to: ROUTES.accounts, parent: NAV.accounts, here: holder.displayName };

/** "Today, by you" · "3 Nov, by Ramesh" · "None yet". */
export const lastStatementWords = (
	updated: DirectoryAccount["updated"],
	now: number = Date.now(),
): string =>
	updated
		? ACCOUNT.lastStatementBy(
				formatDayLabel(updated.at, now),
				updated.byMe ? ACCOUNT.you : firstNameOf(updated.byName),
			)
		: ACCOUNT.noStatementYet;

// ─── Deposits and withdrawals ────────────────────────────────────────────

type TrailFlow = Returns["trail"]["flows"][number];

/** The server lists at most this many flows; beyond it a count would be short. */
const TRAIL_CAP = 500;

const hasValue = (amount: string): boolean => Math.abs(toNumber(amount)) >= 0.005;

/** A signed decimal string without its sign: "-700000.00" → "700000.00". */
export const absAmount = (amount: string): string => amount.replace(/^[-−]/, "");

/**
 * The trail's flows without its bookends. The list always ends in today's
 * value, and starts with the value at the start of the window when the
 * window opens on money already there (`opening` is not zero).
 */
const flowsBetween = (flows: readonly TrailFlow[], opening: string): TrailFlow[] =>
	flows.slice(hasValue(opening) ? 1 : 0, Math.max(0, flows.length - 1));

export interface FlowCount {
	deposits: number;
	withdrawals: number;
	/** The window starts with money already in the account. */
	hasOpening: boolean;
	/** More flows than the server lists, so the counts are too low to state. */
	capped: boolean;
}

/**
 * How many deposits and withdrawals the return was worked out from. In the
 * trail, money out of the investor's pocket is negative (a deposit) and
 * money back into it is positive (a withdrawal).
 */
export const countFlows = (flows: readonly TrailFlow[], opening: string): FlowCount => {
	const between = flowsBetween(flows, opening);
	return {
		deposits: between.filter((flow) => toNumber(flow.amount) < 0).length,
		withdrawals: between.filter((flow) => toNumber(flow.amount) > 0).length,
		hasOpening: hasValue(opening),
		capped: between.length >= TRAIL_CAP,
	};
};

/** "Same 44 deposits and withdrawals, on the same dates." — what exactly is held the same. */
export const sameMoneyLine = ({ deposits, withdrawals, hasOpening, capped }: FlowCount): string => {
	const total = deposits + withdrawals;
	const what = capped
		? "deposits and withdrawals"
		: deposits > 0 && withdrawals > 0
			? `${total} deposits and withdrawals`
			: deposits > 0
				? ACCOUNT.deposits(deposits)
				: ACCOUNT.withdrawals(withdrawals);
	if (total === 0)
		return hasOpening
			? `The same value at the start, and nothing put in or taken out since. ${ACCOUNT.onlyWhere}`
			: ACCOUNT.onlyWhere;
	return hasOpening
		? `The same value at the start, then the same ${what}, on the same dates. ${ACCOUNT.onlyWhere}`
		: `Same ${what}, on the same dates. ${ACCOUNT.onlyWhere}`;
};

export interface TrailRow {
	key: string;
	date: string;
	what: string;
	/** Unsigned amounts; exactly one of the two is set. */
	putIn: string | null;
	takenOut: string | null;
}

/**
 * The trail as a statement: every amount in a "put in" or a "taken out"
 * column, and today's value — the last line — kept apart as where it ends.
 */
export const trailRows = (
	flows: readonly TrailFlow[],
): { rows: TrailRow[]; closing: TrailFlow | null } => {
	const closing = flows[flows.length - 1] ?? null;
	const rows = flows.slice(0, -1).map((flow, index) => {
		const out = toNumber(flow.amount) > 0;
		return {
			key: `${index}-${flow.date}`,
			date: flow.date,
			what: flow.what,
			putIn: out ? null : absAmount(flow.amount),
			takenOut: out ? absAmount(flow.amount) : null,
		};
	});
	return { rows, closing };
};

// ─── Ahead or behind ─────────────────────────────────────────────────────

export type AheadState = "ahead" | "behind" | "level";

export interface AheadPart {
	slug: string;
	name: string;
	state: AheadState;
	/** Rupees, unsigned. */
	amount: number;
}

/** Ahead, behind or level, from a signed difference; under half a rupee is level. */
export const aheadState = (difference: string | number): AheadState => {
	const n = toNumber(difference);
	if (!Number.isFinite(n) || Math.abs(n) < 0.5) return "level";
	return n > 0 ? "ahead" : "behind";
};

/** One entry per benchmark that could be compared; one with no value today is left out, not guessed. */
export const aheadParts = (benchmarks: Returns["benchmarks"]): AheadPart[] =>
	benchmarks.flatMap((benchmark) =>
		benchmark.ahead === null
			? []
			: [
					{
						slug: benchmark.slug,
						name: benchmark.name,
						state: aheadState(benchmark.ahead),
						amount: Math.abs(toNumber(benchmark.ahead)),
					},
				],
	);

/** "₹5,10,000 ahead of NIFTY 50" · "₹2,60,000 behind Gold" · "level with Gold". */
export const aheadPhrase = (part: AheadPart): string =>
	part.state === "level"
		? `level with ${part.name}`
		: `${formatMoney(part.amount)} ${part.state === "ahead" ? "ahead of" : "behind"} ${part.name}`;

/** The whole line, each benchmark worded for what it really is. */
export const aheadSentence = (parts: readonly AheadPart[]): string =>
	parts.length === 0 ? "" : `${ACCOUNT.onTheSameMoney}${listOf(parts.map(aheadPhrase))}.`;

/** Good news only when the account is ahead of everything it is compared with. */
export const aheadTone = (parts: readonly AheadPart[]): "good" | "info" =>
	parts.length > 0 && parts.every((part) => part.state === "ahead") ? "good" : "info";

// ─── Small formats ───────────────────────────────────────────────────────

/** Which fixed series colour a benchmark takes, on the chart and on its bar. */
export const benchmarkTone = (slug: string): "nifty" | "gold" | "alt" =>
	slug.includes("gold") ? "gold" : slug.includes("nifty") ? "nifty" : "alt";

const quantity = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

/** A number of shares or units: "2456" → "2,456", "170.00000000" → "170", "12.3456" → "12.346". */
export const formatQuantity = (raw: string): string => {
	const n = Number(raw);
	return Number.isFinite(n) ? quantity.format(n) : raw;
};

/** A ratio such as Sharpe, to two places with a real minus sign: −0.2 → "−0.20". */
export const formatRatio = (value: number): string => {
	const body = Math.abs(value).toFixed(2);
	return value < 0 && Number(body) !== 0 ? `−${body}` : body;
};

/** A group's accounts with this one added, or taken out if it was there. */
export const toggleMember = (accountIds: readonly string[], accountId: string): string[] =>
	accountIds.includes(accountId)
		? accountIds.filter((id) => id !== accountId)
		: [...accountIds, accountId];
