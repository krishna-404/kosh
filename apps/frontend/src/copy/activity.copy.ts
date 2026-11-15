import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type { ActivityItem, ActivityKind } from "@connected-repo/zod-schemas/kosh/people.zod";
import { firstNameOf, possessive } from "@frontend/modules/access/people.utils";

/**
 * Words for Activity, in the wording board's voice: who did what, to whom,
 * at what level. Sentences are data (parts), so this file stays free of
 * markup — the feed decides how a name, a level or a tag is drawn.
 */

type Person = { name: string; isMe: boolean } | null;
type Target = NonNullable<ActivityItem["target"]>;

/** One piece of a sentence. */
export type SentencePart =
	/** Plain words. */
	| string
	/** A name, drawn bold. */
	| { strong: string }
	/** An account by name — bold, and a way to its page when it can be opened. */
	| { account: { id: string; label: string } }
	/** A holder: by name, or as "all of Anil’s accounts". */
	| { holder: { id: string; label: string }; form: "name" | "accounts" }
	/** A level, drawn as its badge; `lead` is a word kept on the same line ("— ", "from "). */
	| { level: AccessLevel; lead?: string }
	/** The "Not signed in yet" tag on an invite still waiting. */
	| { waiting: true };

interface Sentence {
	parts: SentencePart[];
	/** The sentence already says where it happened, so no target is shown under it. */
	namesTarget?: boolean;
}

interface SentenceContext {
	/** For an invite: nobody has signed in with it, and it has not ended. */
	waiting: boolean;
}

/** "You" / a name at the start of a sentence. */
const subjectOf = (person: Person): SentencePart => ({
	strong: person === null ? "Someone" : person.isMe ? "You" : person.name,
});

/** "you" / a name later in a sentence. */
const objectOf = (person: Person): SentencePart =>
	person === null ? "someone" : person.isMe ? "you" : { strong: person.name };

/** The account by name, or "all of Anil’s accounts" for a holder. */
const whereOf = (target: Target | null): SentencePart =>
	target === null
		? "an account"
		: target.kind === "account"
			? { account: { id: target.id, label: target.label } }
			: { holder: { id: target.id, label: target.label }, form: "accounts" };

/** " — [level]" at the end of a sentence. */
const atLevel = (level: AccessLevel | null): SentencePart[] =>
	level === null ? [] : [" ", { level, lead: "— " }];

const waitingTag = (ctx: SentenceContext): SentencePart[] =>
	ctx.waiting ? [" ", { waiting: true }] : [];

/** " — 214 lines" when the server sends extra words. */
const withDetail = (detail: string | null): SentencePart[] => (detail ? [` — ${detail}`] : []);

/** One sentence per kind of entry. */
export const ACTIVITY_SENTENCE: Record<
	ActivityKind,
	(item: ActivityItem, ctx: SentenceContext) => Sentence
> = {
	// "You added Anil Mehta"
	holder_added: (item) => ({
		parts: [
			subjectOf(item.actor),
			" added ",
			item.target
				? { holder: { id: item.target.id, label: item.target.label }, form: "name" }
				: "a person",
		],
		namesTarget: true,
	}),
	// "You added Anil · Dhan"
	account_added: (item) => ({
		parts: [subjectOf(item.actor), " added ", whereOf(item.target)],
		namesTarget: true,
	}),
	// "You invited vikram.sethi@gmail.com — Can view [Not signed in yet]"
	invited: (item, ctx) => ({
		parts: [
			subjectOf(item.actor),
			" invited ",
			objectOf(item.subject),
			...atLevel(item.level),
			...waitingTag(ctx),
		],
	}),
	// "You shared Anil · Zerodha with Ramesh Iyer — Can edit"
	// "Riya Mehta shared Riya · Dhan with you — Can view"
	access_given: (item) => ({
		parts: [
			subjectOf(item.actor),
			" shared ",
			whereOf(item.target),
			" with ",
			objectOf(item.subject),
			...atLevel(item.level),
		],
		namesTarget: true,
	}),
	// "You changed Ramesh Iyer from [Can view] to [Can edit]"
	level_changed: (item) => ({
		parts:
			item.level === null
				? [subjectOf(item.actor), " changed what ", objectOf(item.subject), " can do"]
				: [
						subjectOf(item.actor),
						" changed ",
						objectOf(item.subject),
						...(item.fromLevel === null
							? []
							: ([" ", { level: item.fromLevel, lead: "from " }] satisfies SentencePart[])),
						" ",
						{ level: item.level, lead: "to " },
					],
	}),
	// "Ramesh Iyer signed in and accepted the invite — Can edit"
	invite_accepted: (item) => ({
		parts: [
			subjectOf(item.actor ?? item.subject),
			" signed in and accepted the invite",
			...atLevel(item.level),
		],
	}),
	// "You cancelled the invite to vikram.sethi@gmial.com. It was never used."
	invite_cancelled: (item) => ({
		parts: [
			subjectOf(item.actor),
			" cancelled the invite to ",
			objectOf(item.subject),
			". It was never used.",
		],
	}),
	// "The invite to x@y ran out. It was never used."
	invite_expired: (item) => ({
		parts: ["The invite to ", objectOf(item.subject), " ran out. It was never used."],
	}),
	// "You sent the invite to x@y again — Can view [Not signed in yet]"
	invite_resent: (item, ctx) => ({
		parts: [
			subjectOf(item.actor),
			" sent the invite to ",
			objectOf(item.subject),
			" again",
			...atLevel(item.level),
			...waitingTag(ctx),
		],
	}),
	// "The person who received the invite to x@y said it reached the wrong person. It was stopped."
	invite_reported_wrong: (item) => ({
		parts: [
			"The person who received the invite to ",
			objectOf(item.subject),
			" said it reached the wrong person. It was stopped.",
		],
	}),
	// "Ramesh Iyer was confirmed as [Owner]"
	owner_confirmed: (item) => ({
		parts: [
			subjectOf(item.subject),
			item.subject?.isMe ? " were confirmed as " : " was confirmed as ",
			{ level: item.level ?? "owner" },
		],
	}),
	// "You removed Ramesh Iyer" · "Anil Mehta removed you"
	removed: (item) => ({
		parts: [subjectOf(item.actor), " removed ", objectOf(item.subject)],
	}),
	// "Ramesh Iyer stopped seeing Anil · Zerodha" · "You stopped seeing all of Anil’s accounts"
	left: (item) => ({
		parts: [subjectOf(item.actor ?? item.subject), " stopped seeing ", whereOf(item.target)],
		namesTarget: true,
	}),
	// Statements and questions arrive with a later phase; until then these
	// say only what is certain and pass on whatever words the server sends.
	upload: (item) => ({
		parts: [subjectOf(item.actor), " uploaded a statement", ...withDetail(item.detail)],
	}),
	undo: (item) => ({
		parts: [subjectOf(item.actor), " undid an upload", ...withDetail(item.detail)],
	}),
	answer: (item) => ({
		parts: [subjectOf(item.actor), " answered a question", ...withDetail(item.detail)],
	}),
};

export type ActivityFilter = "all" | "uploads" | "access" | "answers";

export const ACTIVITY = {
	subtitle:
		"Every upload, undo, answer and access change on accounts you can see — who did it and when. Nothing here can be edited or deleted.",

	// Filters
	filterLabel: "Kind of activity",
	/** Chip words; `short` is for a phone, where the row scrolls sideways. */
	filters: {
		all: { label: "Everything", short: "Everything" },
		uploads: { label: "Uploads and undos", short: "Uploads" },
		access: { label: "Access changes", short: "Access" },
		answers: { label: "Answers", short: "Answers" },
	} satisfies Record<ActivityFilter, { label: string; short: string }>,
	allAccounts: "All accounts",
	anyone: "Anyone",
	you: "You",
	accountPicker: "Account",
	personPicker: "Person",
	filterSheet: "Filter",
	filterSheetOn: "Filter — on",
	done: "Done",
	clearFilters: "Clear filters",
	/** "Showing Anil · Zerodha · Ramesh Iyer" — what the phone's filter sheet has narrowed to. */
	showing: (names: readonly string[]) => `Showing ${names.join(" · ")}`,

	// The feed
	notSignedInYet: "Not signed in yet",
	/** Under an entry: the holder whose accounts it was about. */
	holderTarget: (holderName: string) =>
		`All of ${possessive(firstNameOf(holderName))} accounts`,
	/** The same, inside a sentence. */
	allOf: (holderName: string) => `all of ${possessive(firstNameOf(holderName))} accounts`,
	// Something that happened to the person on an account they can no longer
	// see is still listed — without the name, which is no longer theirs to read.
	hiddenAccount: "an account",
	hiddenHolder: "a person",
	hiddenHolderAccounts: "someone’s accounts",
	hiddenHolderTarget: "Someone’s accounts",
	openAccount: (label: string) => `Open ${label}`,
	showMore: "Show more",
	loadingMore: "Loading…",

	// Nothing to show
	empty: {
		title: "Nothing has happened yet",
		body: "Uploads, undos, answers and access changes appear here with who did them and when.",
	},
	noMatch: {
		title: "Nothing matches these filters",
		bodyMore: "Older entries may still match — show more to look further back.",
	},

	// When something goes wrong
	loadFailed: "Couldn’t load activity.",
	moreFailed: "Couldn’t load more.",
	accountsFailed:
		"Couldn’t load your accounts, so entries can’t be opened or narrowed to one account.",
	retry: "Try again",
} as const;
