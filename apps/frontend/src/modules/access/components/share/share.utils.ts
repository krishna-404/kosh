import { formatDay, formatDayLabel, formatWhen } from "@connected-repo/ui-mui/format/date";
import { ACCESS_LEVEL_ENUM, type AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type {
	AccessEntry,
	AccessList,
	Directory,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { SHARING } from "@frontend/copy/sharing.copy";
import {
	firstNameOf,
	possessive,
	refusalCode,
	suggestEmailFix,
} from "@frontend/modules/access/people.utils";

const levelRank = (level: AccessLevel): number => ACCESS_LEVEL_ENUM.indexOf(level);

/** What is being shared: one account, or a holder (all of that holder's accounts). */
export type ShareTarget = { accountId: string } | { personId: string };

export const targetKey = (target: ShareTarget): string =>
	"accountId" in target ? `account:${target.accountId}` : `holder:${target.personId}`;

/** "Sunita Mehta", or the address for someone who has not signed in. */
export const entryName = (entry: AccessEntry): string => entry.name || entry.email;

/** "Sunita", or the address for someone who has not signed in. */
export const entryFirstName = (entry: AccessEntry): string =>
	entry.name ? firstNameOf(entry.name) : entry.email;

/** "Today 10:42" → "today 10:42", for the middle of a sentence. */
const midSentence = (when: string): string =>
	when.replace(/^(Today|Yesterday)/, (word) => word.toLowerCase());

export const sentWhen = (entry: AccessEntry): string => midSentence(formatWhen(entry.grantedAt));
export const worksUntil = (entry: AccessEntry): string | null =>
	entry.expiresAt === null ? null : midSentence(formatDayLabel(entry.expiresAt));
export const sinceDay = (entry: AccessEntry): string => formatDay(entry.grantedAt);

type Refusal = "LAST_OWNER" | "SELF" | "COVERED_BY_HOLDER";

/** Which of the refusals the server explains this is, if any (it tags them in `data.code`). */
export const refusalOf = (error: unknown): Refusal | undefined => {
	const code = refusalCode(error);
	return code === "LAST_OWNER" || code === "SELF" || code === "COVERED_BY_HOLDER" ? code : undefined;
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Why "Next" cannot go on yet — each is said in words beside the field. */
export type EmailProblem =
	| { kind: "invalid" }
	| { kind: "self" }
	/** A slip away from a common domain; they choose which address they meant. */
	| { kind: "typo"; typedDomain: string; suggestion: string; suggestedDomain: string }
	/** Already has at least this much through all of the holder's accounts. */
	| { kind: "covered"; name: string; got: AccessLevel }
	/** Already has exactly this, here. */
	| { kind: "same"; name: string }
	/** The server refused, in its own words. */
	| { kind: "refused"; message: string };

const sameAddress = (entry: AccessEntry, email: string): boolean =>
	entry.email.toLowerCase() === email;

/** The people whose access is on this very target (not inherited, not narrower). */
const ownEntries = (list: AccessList): readonly AccessEntry[] =>
	list.target.kind === "account" ? list.direct : list.holderWide;

/** On an account: a live entry for this address on all of the holder's accounts. */
export const coveringEntry = (list: AccessList, email: string): AccessEntry | undefined =>
	list.target.kind === "account"
		? list.holderWide.find((entry) => sameAddress(entry, email) && !entry.expired)
		: undefined;

/** A live entry for this address on this very target, if there is one. */
export const existingEntry = (list: AccessList, email: string): AccessEntry | undefined =>
	ownEntries(list).find((entry) => sameAddress(entry, email) && !entry.expired);

/**
 * The checks before "Check what they'll see". Typos matter here: whoever
 * signs in with the address typed gets the access.
 */
export const checkEmail = ({
	email,
	level,
	list,
	myEmail,
	keepAsTyped,
}: {
	/** Trimmed and lower-cased. */
	email: string;
	level: AccessLevel;
	list: AccessList;
	myEmail: string;
	/** They looked at the typo warning and kept the address. */
	keepAsTyped: boolean;
}): EmailProblem | null => {
	if (!EMAIL_SHAPE.test(email)) return { kind: "invalid" };
	if (
		email === myEmail.toLowerCase() ||
		[...list.holderWide, ...list.direct].some((e) => e.isMe && sameAddress(e, email))
	)
		return { kind: "self" };

	if (list.target.kind === "account") {
		const covering = list.holderWide.find(
			(entry) =>
				sameAddress(entry, email) && !entry.expired && levelRank(entry.level) >= levelRank(level),
		);
		if (covering) return { kind: "covered", name: entryFirstName(covering), got: covering.level };
	}

	const existing = existingEntry(list, email);
	if (existing && existing.level === level) return { kind: "same", name: entryFirstName(existing) };

	// Someone already on the list is not a typo.
	const known = [...list.holderWide, ...list.direct, ...list.onAccounts].some((e) =>
		sameAddress(e, email),
	);
	const suggestion = keepAsTyped || known ? null : suggestEmailFix(email);
	if (suggestion)
		return {
			kind: "typo",
			typedDomain: email.split("@")[1] ?? "",
			suggestion,
			suggestedDomain: suggestion.split("@")[1] ?? "",
		};
	return null;
};

/**
 * "Anil · Groww, Kabir's accounts, or any other account" — what the person
 * sharing can see that this invite does not include.
 */
export const wontSeeWords = (
	directory: Directory | undefined,
	target: AccessList["target"],
	/** They already have all of this holder's accounts, so none of those are news. */
	seesHolder = false,
): string => {
	const holderId = target.holder.id;
	const others = (directory?.accounts ?? []).filter((account) =>
		target.kind === "account" && !seesHolder
			? account.id !== target.id
			: account.personId !== holderId,
	);
	const holders = new Map((directory?.holders ?? []).map((h) => [h.id, h]));

	const names = others.filter((a) => a.personId === holderId).map((a) => a.label);
	const seen = new Set<string>([holderId]);
	for (const account of others) {
		if (seen.has(account.personId)) continue;
		seen.add(account.personId);
		const holder = holders.get(account.personId);
		names.push(
			holder ? SHARING.holderAccounts(possessive(firstNameOf(holder.displayName))) : account.label,
		);
	}
	if (names.length === 0) return SHARING.anyOther;
	return `${names.slice(0, 3).join(", ")}, ${SHARING.orAnyOther}`;
};
