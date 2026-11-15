import { z } from "zod";
import {
	accessLevelZod,
	brokerZod,
	groupKindZod,
	holderKindZod,
} from "../enums.zod.js";

/**
 * People, accounts, sharing and groups — the contract between the backend
 * and the screens (docs/kosh/06-build-plan.md, phase 2).
 *
 * Money and returns are null until the phase that computes them; the shape
 * is here now so screens do not change when the numbers arrive.
 */

const name = z.string().trim().min(1).max(120);

// ─── Inputs ─────────────────────────────────────────────────────────────

export const personCreateZod = z.object({
	displayName: name,
	kind: holderKindZod.default("login"),
	/** "This is me": link the holder to the caller's own login. */
	isMe: z.boolean().default(false),
});

export const personUpdateZod = z.object({
	personId: z.string(),
	displayName: name.optional(),
	kind: holderKindZod.optional(),
	isMe: z.boolean().optional(),
});

export const accountCreateZod = z.object({
	personId: z.string(),
	broker: brokerZod,
	/** The broker's name when it is not one Kosh knows ("Other"). */
	brokerName: z.string().trim().min(1).max(60).optional(),
	label: name,
});

export const accountUpdateZod = z.object({
	accountId: z.string(),
	label: name,
});

/** What a grant is on: one account, or a holder (all of that holder's accounts). */
export const accessTargetZod = z
	.object({
		accountId: z.string().optional(),
		personId: z.string().optional(),
	})
	.refine((t) => (t.accountId === undefined) !== (t.personId === undefined), {
		message: "Give exactly one of accountId or personId",
	});
export type AccessTargetInput = z.infer<typeof accessTargetZod>;

export const accessGrantInputZod = z.object({
	target: accessTargetZod,
	email: z.email().max(320),
	level: accessLevelZod,
});

export const groupCreateZod = z.object({
	name,
	kind: groupKindZod.nullable().default(null),
	accountIds: z.array(z.string()).max(500).default([]),
});

export const groupUpdateZod = z.object({
	groupId: z.string(),
	name: name.optional(),
	kind: groupKindZod.nullable().optional(),
	accountIds: z.array(z.string()).max(500).optional(),
});

// ─── The directory: every holder and account the caller can see ─────────

const sharerZod = z.object({
	userId: z.string(),
	name: z.string(),
	email: z.string(),
});

const facePersonZod = z.object({
	/** Stable key for colour and lists: the login id, or the invited email. */
	key: z.string(),
	name: z.string(),
});

export const directoryHolderZod = z.object({
	id: z.string(),
	displayName: z.string(),
	kind: holderKindZod,
	/** This holder is the caller ("You"). */
	isMe: z.boolean(),
	/** The caller's level on all of this holder's accounts, if they have one. */
	myLevel: accessLevelZod.nullable(),
	createdAt: z.number(),
});
export type DirectoryHolder = z.infer<typeof directoryHolderZod>;

export const directoryAccountZod = z.object({
	id: z.string(),
	personId: z.string(),
	label: z.string(),
	broker: brokerZod,
	brokerName: z.string().nullable(),
	baseCurrency: z.string(),
	createdAt: z.number(),
	myLevel: accessLevelZod,
	/** Whether that level comes from the holder (all their accounts) or this account alone. */
	via: z.enum(["holder", "account"]),
	/**
	 * The caller's own grant that gives them `myLevel` — what "stop seeing
	 * this" (access.revoke) takes. When `via` is "holder" it is their grant on
	 * the holder, and ending it ends their access to all of that holder's accounts.
	 */
	myGrantId: z.string(),
	/** Who gave the caller this access; null when they added it themselves. */
	sharedBy: sharerZod.nullable(),
	/** Shared with the caller and not yet looked at. */
	isNew: z.boolean(),
	/** Who else can see it — given to owners only. */
	access: z
		.object({
			/** Signed-in people with access, the caller included. */
			people: z.array(facePersonZod),
			owners: z.number().int(),
			invited: z.number().int(),
		})
		.nullable(),
	// Filled by later phases:
	value: z.string().nullable(),
	xirr: z.number().nullable(),
	benchmarkXirr: z.number().nullable(),
	updated: z
		.object({ at: z.number(), byName: z.string(), byMe: z.boolean() })
		.nullable(),
	questionsWaiting: z.number().int(),
});
export type DirectoryAccount = z.infer<typeof directoryAccountZod>;

export const directoryZod = z.object({
	me: z.object({ userId: z.string(), name: z.string(), email: z.string() }),
	holders: z.array(directoryHolderZod),
	accounts: z.array(directoryAccountZod),
});
export type Directory = z.infer<typeof directoryZod>;

// ─── People with access to one target (owners only) ─────────────────────

export const accessEntryZod = z.object({
	grantId: z.string(),
	level: accessLevelZod,
	userId: z.string().nullable(),
	name: z.string().nullable(),
	email: z.string(),
	/** Invited by email and not signed in yet. */
	pending: z.boolean(),
	/** The invite ran out before anyone signed in with it. */
	expired: z.boolean(),
	expiresAt: z.number().nullable(),
	isMe: z.boolean(),
	/** This person added the holder (their own first owner grant). */
	addedHolder: z.boolean(),
	/** An owner invite that was accepted and waits for an owner to confirm it. */
	needsConfirmation: z.boolean(),
	grantedAt: z.number(),
	grantedByName: z.string().nullable(),
});
export type AccessEntry = z.infer<typeof accessEntryZod>;

export const accessOnAccountEntryZod = accessEntryZod.extend({
	accountId: z.string(),
	accountLabel: z.string(),
	broker: brokerZod,
});

export const accessListZod = z.object({
	target: z.object({
		kind: z.enum(["account", "holder"]),
		id: z.string(),
		label: z.string(),
		holder: z.object({ id: z.string(), displayName: z.string(), kind: holderKindZod }),
	}),
	/** On the holder: all their accounts, including new ones. */
	holderWide: z.array(accessEntryZod),
	/** Account target: people on this account alone. */
	direct: z.array(accessEntryZod),
	/** Holder target: people on only some of the holder's accounts. */
	onAccounts: z.array(accessOnAccountEntryZod),
	/** Account target: the caller also owns the holder, so can change holder-wide access. */
	ownsHolder: z.boolean(),
});
export type AccessList = z.infer<typeof accessListZod>;

// ─── Who can see what: everything the caller owns × everyone on it ──────

export const accessMatrixZod = z.object({
	holders: z.array(
		z.object({
			id: z.string(),
			displayName: z.string(),
			kind: holderKindZod,
			/** False when the caller owns only some of this holder's accounts. */
			ownsHolder: z.boolean(),
			accounts: z.array(
				z.object({
					id: z.string(),
					label: z.string(),
					broker: brokerZod,
					brokerName: z.string().nullable(),
					value: z.string().nullable(),
				}),
			),
		}),
	),
	people: z.array(
		z.object({
			key: z.string(),
			userId: z.string().nullable(),
			name: z.string().nullable(),
			email: z.string(),
			pending: z.boolean(),
			isMe: z.boolean(),
			holders: z.array(
				z.object({ personId: z.string(), level: accessLevelZod, grantId: z.string() }),
			),
			accounts: z.array(
				z.object({ accountId: z.string(), level: accessLevelZod, grantId: z.string() }),
			),
		}),
	),
});
export type AccessMatrix = z.infer<typeof accessMatrixZod>;

// ─── Things the caller should be told once ──────────────────────────────

const targetRefZod = z.object({
	kind: z.enum(["account", "holder"]),
	id: z.string(),
	label: z.string(),
});

export const accessNoticesZod = z.object({
	/** Newly shared with the caller. */
	arrivals: z.array(
		z.object({
			grantId: z.string(),
			sharedBy: sharerZod,
			target: targetRefZod,
			level: accessLevelZod,
			at: z.number(),
		}),
	),
	/** Access the caller no longer has — told once, by name. */
	lost: z.array(
		z.object({
			grantId: z.string(),
			label: z.string(),
			byName: z.string().nullable(),
			at: z.number(),
		}),
	),
	/** Owner invites someone accepted, waiting for the caller's one-tap confirm. */
	toConfirm: z.array(
		z.object({
			grantId: z.string(),
			name: z.string().nullable(),
			email: z.string(),
			target: targetRefZod,
			at: z.number(),
		}),
	),
});
export type AccessNotices = z.infer<typeof accessNoticesZod>;

export const inviteStatusZod = z.object({
	state: z.enum(["yours", "other_email", "expired", "cancelled", "accepted", "not_found"]),
	inviterName: z.string().nullable(),
	/** The address it was sent to, masked ("r•••@iyercapital.in"). */
	maskedEmail: z.string().nullable(),
	myEmail: z.string(),
});
export type InviteStatus = z.infer<typeof inviteStatusZod>;

// ─── Groups ─────────────────────────────────────────────────────────────

export const groupZod = z.object({
	id: z.string(),
	name: z.string(),
	kind: groupKindZod.nullable(),
	/** Only accounts the caller can still see. */
	accountIds: z.array(z.string()),
	createdAt: z.number(),
});
export type Group = z.infer<typeof groupZod>;

// ─── Activity ───────────────────────────────────────────────────────────

export const ACTIVITY_KINDS = [
	"holder_added",
	"account_added",
	"invited",
	"access_given",
	"level_changed",
	"invite_accepted",
	"invite_cancelled",
	"invite_expired",
	"invite_resent",
	"invite_reported_wrong",
	"owner_confirmed",
	"removed",
	"left",
	"upload",
	"undo",
	"answer",
] as const;
export const activityKindZod = z.enum(ACTIVITY_KINDS);
export type ActivityKind = z.infer<typeof activityKindZod>;

export const activityItemZod = z.object({
	id: z.string(),
	at: z.number(),
	kind: activityKindZod,
	actor: z.object({ name: z.string(), isMe: z.boolean() }).nullable(),
	/** The person the entry is about, when it is about someone. */
	subject: z
		.object({ name: z.string(), isMe: z.boolean(), pending: z.boolean() })
		.nullable(),
	level: accessLevelZod.nullable(),
	fromLevel: accessLevelZod.nullable(),
	target: targetRefZod.nullable(),
	/** Extra words for the sentence: a file name, a count. */
	detail: z.string().nullable(),
});
export type ActivityItem = z.infer<typeof activityItemZod>;

export const activityListInputZod = z.object({
	accountId: z.string().optional(),
	filter: z.enum(["all", "uploads", "access", "answers"]).default("all"),
	/** Return entries older than this moment (for "show more"). */
	before: z.number().optional(),
	limit: z.number().int().min(1).max(200).default(50),
});

export const activityListZod = z.object({
	items: z.array(activityItemZod),
	/** Pass as `before` to load the next page; null when there is no more. */
	nextBefore: z.number().nullable(),
});
export type ActivityList = z.infer<typeof activityListZod>;
