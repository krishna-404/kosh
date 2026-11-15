import { db } from "@backend/db/db";
import {
	atLeast,
	effectiveLevel,
	inList,
	requireAccess,
	usersById,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import { countQuestions } from "@backend/modules/questions/questions.service";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type {
	AccessMatrix,
	AccessNotices,
	Directory,
	InviteStatus,
} from "@connected-repo/zod-schemas/kosh/people.zod";

// Read models for the people-and-access screens. Everything here is derived
// from `access_grants` and limited to what the caller may know: who else can
// see an account is told to its owners only.

const rankOf = (level: AccessLevel) => ({ view: 0, edit: 1, owner: 2 })[level];

const isPendingAndLive = (
	g: { userId: string | null; expiresAt: number | null },
	now: number,
) => g.userId === null && (g.expiresAt === null || g.expiresAt > now);

/** Every holder and account the caller can see, with their level on each. */
export async function getDirectory(me: {
	id: string;
	name: string;
	email: string | null;
}): Promise<Directory> {
	const ctx = requireAccess();
	const now = Date.now();

	const holders = await db.persons
		.order({ createdAt: "ASC" })
		.select("id", "displayName", "kind", "linkedUserId", "createdAt");
	const accounts = await db.brokerAccounts
		.order({ createdAt: "ASC" })
		.select(
			"id",
			"personId",
			"label",
			"broker",
			"brokerName",
			"baseCurrency",
			"createdAt",
		);

	// The grant that gives the caller their level on each account says who
	// shared it and whether it is news.
	const myGrants = await db.accessGrants
		.where({ revokedAt: null, userId: me.id })
		.select(
			"id",
			"personId",
			"accountId",
			"level",
			"needsConfirmation",
			"grantedByUserId",
			"seenAt",
		);
	const onHolder = new Map(
		myGrants.filter((g) => g.personId).map((g) => [g.personId as string, g]),
	);
	const onAccount = new Map(
		myGrants.filter((g) => g.accountId).map((g) => [g.accountId as string, g]),
	);

	// Who else is on the accounts the caller owns.
	const owned = accounts.filter((a) =>
		atLeast(ctx.accountLevels.get(a.id), "owner"),
	);
	const others =
		owned.length > 0
			? await db.accessGrants
					.where({
						revokedAt: null,
						OR: [
							{ accountId: { in: inList(owned.map((a) => a.id)) } },
							{ personId: { in: inList(owned.map((a) => a.personId)) } },
						],
					})
					.select(
						"personId",
						"accountId",
						"userId",
						"invitedEmail",
						"level",
						"needsConfirmation",
						"expiresAt",
					)
			: [];

	// The newest upload on each account, and how many questions wait there.
	const uploads =
		accounts.length > 0
			? await db.importBatches
					.where({ accountId: { in: accounts.map((a) => a.id) }, status: "applied" })
					.order({ appliedAt: "DESC" })
					.select("accountId", "appliedAt", "uploadedByUserId")
			: [];
	const latestUpload = new Map<string, (typeof uploads)[number]>();
	for (const u of uploads) if (!latestUpload.has(u.accountId)) latestUpload.set(u.accountId, u);
	const waiting = await countQuestions();

	const users = await usersById([
		...myGrants.map((g) => g.grantedByUserId),
		...others.map((g) => g.userId),
		...[...latestUpload.values()].map((u) => u.uploadedByUserId),
	]);

	return {
		me: { userId: me.id, name: me.name, email: me.email ?? "" },
		holders: holders.map((h) => ({
			id: h.id,
			displayName: h.displayName,
			kind: h.kind,
			isMe: h.linkedUserId === me.id,
			myLevel: ctx.personLevels.get(h.id) ?? null,
			createdAt: h.createdAt,
		})),
		accounts: accounts.flatMap((a) => {
			const myLevel = ctx.accountLevels.get(a.id);
			if (!myLevel) return [];
			const holderGrant = onHolder.get(a.personId);
			const accountGrant = onAccount.get(a.id);
			// The holder grant wins a tie: it is the wider one.
			const viaHolder =
				holderGrant !== undefined &&
				(accountGrant === undefined ||
					rankOf(effectiveLevel(holderGrant)) >=
						rankOf(effectiveLevel(accountGrant)));
			const giving = viaHolder ? holderGrant : accountGrant;
			if (!giving) return [];
			const sharer =
				giving.grantedByUserId && giving.grantedByUserId !== me.id
					? users.get(giving.grantedByUserId)
					: undefined;

			let access: Directory["accounts"][number]["access"] = null;
			if (myLevel === "owner") {
				const on = others.filter(
					(g) => g.accountId === a.id || g.personId === a.personId,
				);
				const people = new Map<string, { key: string; name: string }>();
				const ownerIds = new Set<string>();
				const invited = new Set<string>();
				for (const g of on) {
					if (g.userId) {
						const u = users.get(g.userId);
						people.set(g.userId, {
							key: g.userId,
							name: g.userId === me.id ? me.name : (u?.name ?? u?.email ?? "Someone"),
						});
						if (effectiveLevel(g) === "owner") ownerIds.add(g.userId);
					} else if (g.invitedEmail && isPendingAndLive(g, now)) {
						invited.add(g.invitedEmail);
					}
				}
				access = {
					people: [...people.values()],
					owners: ownerIds.size,
					invited: invited.size,
				};
			}

			return [
				{
					...a,
					myLevel,
					myGrantId: giving.id,
					via: viaHolder ? ("holder" as const) : ("account" as const),
					sharedBy: sharer
						? { userId: sharer.id, name: sharer.name, email: sharer.email ?? "" }
						: null,
					isNew: sharer !== undefined && giving.seenAt === null,
					access,
					value: null,
					xirr: null,
					benchmarkXirr: null,
					updated: (() => {
						const upload = latestUpload.get(a.id);
						return upload?.appliedAt
							? {
									at: upload.appliedAt,
									byName: users.get(upload.uploadedByUserId)?.name ?? "Someone",
									byMe: upload.uploadedByUserId === me.id,
								}
							: null;
					})(),
					questionsWaiting: waiting.get(a.id) ?? 0,
				},
			];
		}),
	};
}

/**
 * Who can see what: everything the caller owns, and everyone with any
 * access to it. Holder-wide access on a holder the caller only partly owns
 * is included (those people do see the caller's account) but marked as not
 * the caller's to change.
 */
export async function getAccessMatrix(meId: string): Promise<AccessMatrix> {
	const ctx = requireAccess();
	const accounts = (
		await db.brokerAccounts
			.order({ createdAt: "ASC" })
			.select("id", "personId", "label", "broker", "brokerName")
	).filter((a) => atLeast(ctx.accountLevels.get(a.id), "owner"));
	if (accounts.length === 0) return { holders: [], people: [] };

	const holderIds = [...new Set(accounts.map((a) => a.personId))];
	const holders = await db.persons
		.where({ id: { in: holderIds } })
		.order({ createdAt: "ASC" })
		.select("id", "displayName", "kind");
	const grants = await db.accessGrants
		.where({
			revokedAt: null,
			OR: [
				{ accountId: { in: accounts.map((a) => a.id) } },
				{ personId: { in: holderIds } },
			],
		})
		.order({ createdAt: "ASC" })
		.select("id", "personId", "accountId", "userId", "invitedEmail", "level");
	const users = await usersById(grants.map((g) => g.userId));

	const people = new Map<string, AccessMatrix["people"][number]>();
	for (const g of grants) {
		const key = g.userId ?? g.invitedEmail ?? g.id;
		const user = g.userId ? users.get(g.userId) : undefined;
		const person = people.get(key) ?? {
			key,
			userId: g.userId,
			name: user?.name ?? null,
			email: user?.email ?? g.invitedEmail ?? "",
			pending: g.userId === null,
			isMe: g.userId === meId,
			holders: [],
			accounts: [],
		};
		if (g.personId)
			person.holders.push({ personId: g.personId, level: g.level, grantId: g.id });
		else if (g.accountId)
			person.accounts.push({ accountId: g.accountId, level: g.level, grantId: g.id });
		people.set(key, person);
	}

	return {
		holders: holders.map((h) => ({
			...h,
			ownsHolder: atLeast(ctx.personLevels.get(h.id), "owner"),
			accounts: accounts
				.filter((a) => a.personId === h.id)
				.map(({ personId: _personId, ...a }) => ({ ...a, value: null })),
		})),
		// The caller first, then people who have signed in, then invites.
		people: [...people.values()].sort(
			(a, b) =>
				Number(b.isMe) - Number(a.isMe) || Number(a.pending) - Number(b.pending),
		),
	};
}

/** Labels for grant targets, read past the caller's scope — see callers. */
async function targetLabels(
	grants: { personId: string | null; accountId: string | null }[],
) {
	const accountIds = grants.flatMap((g) => (g.accountId ? [g.accountId] : []));
	const personIds = grants.flatMap((g) => (g.personId ? [g.personId] : []));
	const [accounts, persons] = await Promise.all([
		accountIds.length > 0
			? db.brokerAccounts
					.unscope("default")
					.where({ id: { in: accountIds } })
					.select("id", "label")
			: [],
		personIds.length > 0
			? db.persons
					.unscope("default")
					.where({ id: { in: personIds } })
					.select("id", "displayName")
			: [],
	]);
	const accountLabel = new Map(accounts.map((a) => [a.id, a.label]));
	const personLabel = new Map(persons.map((p) => [p.id, p.displayName]));
	return (g: { personId: string | null; accountId: string | null }) =>
		g.accountId
			? {
					kind: "account" as const,
					id: g.accountId,
					label: accountLabel.get(g.accountId) ?? "An account",
				}
			: {
					kind: "holder" as const,
					id: g.personId as string,
					label: personLabel.get(g.personId as string) ?? "Someone",
				};
}

/** What the caller should be told once: new shares, lost access, owners to confirm. */
export async function getAccessNotices(meId: string): Promise<AccessNotices> {
	const ctx = requireAccess();

	const arrivals = (
		await db.accessGrants
			.where({ revokedAt: null, userId: meId, seenAt: null })
			.order({ createdAt: "DESC" })
			.select("id", "personId", "accountId", "level", "grantedByUserId", "createdAt")
	).filter((g) => g.grantedByUserId && g.grantedByUserId !== meId);

	// Told once, by name — the one place a label is read for something the
	// caller can no longer see. Skipped if they still reach it another way.
	const lost = (
		await db.accessGrants
			.where({ userId: meId, endReason: "removed", endSeenAt: null })
			.order({ revokedAt: "DESC" })
			.select("id", "personId", "accountId", "revokedByUserId", "revokedAt")
	).filter((g) =>
		g.accountId
			? !ctx.accountLevels.has(g.accountId)
			: !ctx.personLevels.has(g.personId as string),
	);

	const ownedAccounts = [...ctx.accountLevels]
		.filter(([, level]) => level === "owner")
		.map(([id]) => id);
	const ownedHolders = [...ctx.personLevels]
		.filter(([, level]) => level === "owner")
		.map(([id]) => id);
	const toConfirm =
		ownedAccounts.length + ownedHolders.length > 0
			? (
					await db.accessGrants
						.where({
							revokedAt: null,
							needsConfirmation: true,
							OR: [
								{ accountId: { in: inList(ownedAccounts) } },
								{ personId: { in: inList(ownedHolders) } },
							],
						})
						.order({ createdAt: "DESC" })
						.select("id", "personId", "accountId", "userId", "createdAt")
				).filter((g) => g.userId !== meId)
			: [];

	const users = await usersById([
		...arrivals.map((g) => g.grantedByUserId),
		...lost.map((g) => g.revokedByUserId),
		...toConfirm.map((g) => g.userId),
	]);
	const label = await targetLabels([...arrivals, ...lost, ...toConfirm]);

	return {
		arrivals: arrivals.flatMap((g) => {
			const by = users.get(g.grantedByUserId as string);
			return by
				? [
						{
							grantId: g.id,
							sharedBy: { userId: by.id, name: by.name, email: by.email ?? "" },
							target: label(g),
							level: g.level,
							at: g.createdAt,
						},
					]
				: [];
		}),
		lost: lost.map((g) => {
			const target = label(g);
			return {
				grantId: g.id,
				kind: target.kind,
				label: target.label,
				byName: g.revokedByUserId
					? (users.get(g.revokedByUserId)?.name ?? null)
					: null,
				at: g.revokedAt ?? 0,
			};
		}),
		toConfirm: toConfirm.map((g) => {
			const user = users.get(g.userId as string);
			return {
				grantId: g.id,
				name: user?.name ?? null,
				email: user?.email ?? "",
				target: label(g),
				at: g.createdAt,
			};
		}),
	};
}

/** Mark notices as shown, so each is told once. Only the caller's own. */
export async function acknowledgeNotices(
	meId: string,
	input: { arrivals: string[]; lost: string[] },
): Promise<void> {
	const now = Date.now();
	if (input.arrivals.length > 0)
		await db.accessGrants
			.where({ userId: meId, seenAt: null, id: { in: input.arrivals } })
			.update({ seenAt: now });
	if (input.lost.length > 0)
		await db.accessGrants
			.where({ userId: meId, endSeenAt: null, id: { in: input.lost } })
			.update({ endSeenAt: now });
}

const maskEmail = (email: string): string => {
	const [local = "", domain = ""] = email.split("@");
	return `${local.charAt(0)}•••@${domain}`;
};

const INVITE_COLUMNS = [
	"id",
	"invitedEmail",
	"grantedByUserId",
	"revokedAt",
	"endReason",
	"expiresAt",
] as const;

const findInvite = (where: { inviteToken: string } | { supersedesGrantId: string }) =>
	db.accessGrants
		.where(where)
		.select(...INVITE_COLUMNS)
		.takeOptional();

/**
 * What became of the invite behind a link, for the person who opened it.
 * By the time this runs, an invite addressed to the caller has already been
 * accepted (see `loadAccess`), so "yours" means "it is in your accounts now".
 */
export async function getInviteStatus(
	me: { id: string; email: string | null },
	inviteToken: string,
): Promise<InviteStatus> {
	const myEmail = me.email ?? "";
	const first = await findInvite({ inviteToken });
	if (!first)
		return { state: "not_found", inviterName: null, maskedEmail: null, myEmail };

	const inviter = first.grantedByUserId
		? await db.users.findOptional(first.grantedByUserId).select("name")
		: undefined;
	const base = {
		inviterName: inviter?.name ?? null,
		maskedEmail: first.invitedEmail ? maskEmail(first.invitedEmail) : null,
		myEmail,
	};

	// A re-sent invite lives on in the row that replaced it.
	let grant = first;
	for (let hops = 0; grant.endReason === "renewed" && hops < 20; hops++) {
		const next = await findInvite({ supersedesGrantId: grant.id });
		if (!next) break;
		grant = next;
	}

	if (grant.endReason === "claimed") {
		const mine = await db.accessGrants
			.where({ supersedesGrantId: grant.id, userId: me.id })
			.exists();
		return { state: mine ? "yours" : "accepted", ...base };
	}
	if (grant.revokedAt !== null)
		return {
			state: grant.endReason === "expired" ? "expired" : "cancelled",
			...base,
		};
	if (grant.expiresAt !== null && grant.expiresAt <= Date.now())
		return { state: "expired", ...base };
	return { state: "other_email", ...base };
}
