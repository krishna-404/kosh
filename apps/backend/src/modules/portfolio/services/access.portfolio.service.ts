import { randomBytes } from "node:crypto";
import { db } from "@backend/db/db";
import {
	getRequestContext,
	NO_ROWS,
	type RequestContext,
} from "@backend/lib/request-context";
import {
	ACCESS_LEVEL_ENUM,
	type AccessLevel,
	type GrantEndReason,
} from "@connected-repo/zod-schemas/enums.zod";
import type {
	AccessEntry,
	AccessList,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { ORPCError } from "@orpc/server";

// ─── Levels ─────────────────────────────────────────────────────────────

const rank = (level: AccessLevel): number => ACCESS_LEVEL_ENUM.indexOf(level);

/** True when `have` includes everything `need` allows. */
export const atLeast = (
	have: AccessLevel | undefined,
	need: AccessLevel,
): boolean => have !== undefined && rank(have) >= rank(need);

const higher = (a: AccessLevel | undefined, b: AccessLevel): AccessLevel =>
	a !== undefined && rank(a) >= rank(b) ? a : b;

/**
 * What a grant is worth right now. An accepted Owner invite counts as View
 * until an existing owner confirms it, so a mistyped address cannot take an
 * account over.
 */
export const effectiveLevel = (grant: {
	level: AccessLevel;
	needsConfirmation: boolean;
}): AccessLevel => (grant.needsConfirmation ? "view" : grant.level);

/** `IN ()` is not valid SQL — an empty list becomes one id that matches nothing. */
export const inList = (ids: Iterable<string>): string[] => {
	const list = [...ids];
	return list.length > 0 ? list : [NO_ROWS];
};

// ─── Invites ────────────────────────────────────────────────────────────

/** An invite nobody has accepted stops working after 14 days. */
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const newInviteToken = (): string => randomBytes(32).toString("base64url");

const isExpired = (grant: { expiresAt: number | null }, now: number): boolean =>
	grant.expiresAt !== null && grant.expiresAt <= now;

/** Stop a live row. Returns false if it was no longer live (someone got there first). */
async function endGrant(
	grantId: string,
	reason: GrantEndReason,
	byUserId: string | null,
	/** True when the grantee needs no telling (they did it, or it was never theirs). */
	silent: boolean,
): Promise<boolean> {
	const now = Date.now();
	const ended = await db.accessGrants
		.where({ id: grantId, revokedAt: null })
		.update({
			revokedAt: now,
			revokedByUserId: byUserId,
			endReason: reason,
			...(silent ? { endSeenAt: now } : {}),
		});
	return ended > 0;
}

// ─── Resolving a caller's access ────────────────────────────────────────

export interface AccessUser {
	id: string;
	email: string | null;
}

const GRANT_COLUMNS = [
	"id",
	"personId",
	"accountId",
	"userId",
	"invitedEmail",
	"level",
	"grantedByUserId",
	"expiresAt",
	"needsConfirmation",
] as const;

/**
 * Turn invites addressed to this (verified) email into grants for the login.
 * The invite row ends as `claimed` and a new row for the login takes its
 * place, so the invite's own history stays intact.
 */
async function claimInvites(
	user: AccessUser,
	invites: {
		id: string;
		personId: string | null;
		accountId: string | null;
		level: AccessLevel;
		grantedByUserId: string | null;
		expiresAt: number | null;
	}[],
): Promise<void> {
	const now = Date.now();
	await db.$transaction(async () => {
		for (const invite of invites) {
			if (isExpired(invite, now)) {
				await endGrant(invite.id, "expired", null, true);
				continue;
			}
			// Conditional end: of two requests racing to claim, one wins.
			if (!(await endGrant(invite.id, "claimed", user.id, true))) continue;

			const target = invite.accountId
				? { accountId: invite.accountId, personId: null }
				: { personId: invite.personId, accountId: null };
			const mine = await db.accessGrants
				.where({ revokedAt: null, userId: user.id, ...target })
				.select("id", "level")
				.takeOptional();
			if (mine && rank(mine.level) >= rank(invite.level)) continue;
			if (mine) await endGrant(mine.id, "level_changed", user.id, true);

			await db.accessGrants.create({
				...target,
				userId: user.id,
				level: invite.level,
				grantedByUserId: invite.grantedByUserId,
				supersedesGrantId: invite.id,
				needsConfirmation: invite.level === "owner",
			});
		}
	});
}

/**
 * Everything `user` can reach, read fresh from `access_grants`.
 *
 * A grant counts when it names the user. An invite sent to an address is
 * claimed the first time a login with that *verified* address makes a
 * request — never for someone who merely typed the address at sign-up.
 * Whether the address is verified is read from the database at that moment,
 * not from the session, which may be minutes old.
 *
 * A holder-wide grant covers every account of that holder, present and
 * future; the effective level on an account is the higher of its own grant
 * and its holder's.
 */
export async function loadAccess(user: AccessUser): Promise<RequestContext> {
	const live = db.accessGrants.where({ revokedAt: null });
	const invitedAs = user.email ? user.email.toLowerCase() : null;
	const mine = () => live.where({ userId: user.id }).select(...GRANT_COLUMNS);

	let grants = await (invitedAs
		? live
				.where({ OR: [{ userId: user.id }, { invitedEmail: invitedAs }] })
				.select(...GRANT_COLUMNS)
		: mine());

	const invites = grants.filter((g) => g.userId === null);
	if (invites.length > 0) {
		const verified = await db.users
			.where({ id: user.id, emailVerified: true })
			.exists();
		if (verified) await claimInvites(user, invites);
		grants = await mine();
	}

	const personLevels = new Map<string, AccessLevel>();
	const ownAccountLevels = new Map<string, AccessLevel>();
	for (const g of grants) {
		const level = effectiveLevel(g);
		if (g.personId)
			personLevels.set(g.personId, higher(personLevels.get(g.personId), level));
		else if (g.accountId)
			ownAccountLevels.set(
				g.accountId,
				higher(ownAccountLevels.get(g.accountId), level),
			);
	}

	const accountLevels = new Map<string, AccessLevel>();
	const personIds = new Set(personLevels.keys());
	if (grants.length > 0) {
		const accounts = await db.brokerAccounts
			.unscope("default")
			.where({
				OR: [
					{ id: { in: inList(ownAccountLevels.keys()) } },
					{ personId: { in: inList(personLevels.keys()) } },
				],
			})
			.select("id", "personId");
		for (const account of accounts) {
			const own = ownAccountLevels.get(account.id);
			const viaHolder = personLevels.get(account.personId);
			const level = viaHolder ? higher(own, viaHolder) : own;
			if (!level) continue;
			accountLevels.set(account.id, level);
			personIds.add(account.personId);
		}
	}

	return {
		userId: user.id,
		accountLevels,
		personLevels,
		accountIds: inList(accountLevels.keys()),
		personIds: inList(personIds),
	};
}

// ─── Guards (read the request's snapshot) ───────────────────────────────

export function requireAccess(): RequestContext {
	const ctx = getRequestContext();
	if (!ctx)
		throw new ORPCError("UNAUTHORIZED", {
			status: 401,
			message: "No active session",
		});
	return ctx;
}

/**
 * The caller's level on an account, or throws. An account the caller cannot
 * see is reported as missing, not forbidden — its existence is not disclosed.
 */
export function requireAccountLevel(
	accountId: string,
	need: AccessLevel,
): AccessLevel {
	const have = requireAccess().accountLevels.get(accountId);
	if (!have)
		throw new ORPCError("NOT_FOUND", {
			status: 404,
			message: "Account not found",
		});
	if (!atLeast(have, need))
		throw new ORPCError("FORBIDDEN", {
			status: 403,
			message:
				need === "owner"
					? "Only an owner of this account can do this"
					: "You can view this account but not change it",
		});
	return have;
}

/** The caller's holder-wide level, or throws (same disclosure rule). */
export function requirePersonLevel(
	personId: string,
	need: AccessLevel,
): AccessLevel {
	const ctx = requireAccess();
	const have = ctx.personLevels.get(personId);
	if (!have && !ctx.personIds.includes(personId))
		throw new ORPCError("NOT_FOUND", {
			status: 404,
			message: "Person not found",
		});
	if (!atLeast(have, need))
		throw new ORPCError("FORBIDDEN", {
			status: 403,
			message:
				need === "owner"
					? "Only an owner of this person's accounts can do this"
					: "You do not have that access to this person's accounts",
		});
	return have as AccessLevel;
}

// ─── Sharing ────────────────────────────────────────────────────────────

/** What a grant is on: one account, or a holder (all of that holder's accounts). */
export type AccessTarget =
	| { accountId: string; personId?: undefined }
	| { personId: string; accountId?: undefined };

export const toTarget = (t: {
	accountId?: string;
	personId?: string;
}): AccessTarget =>
	t.accountId !== undefined
		? { accountId: t.accountId }
		: { personId: t.personId as string };

const requireOwnerOf = (target: AccessTarget): void => {
	if (target.accountId !== undefined)
		requireAccountLevel(target.accountId, "owner");
	else requirePersonLevel(target.personId, "owner");
};

const targetWhere = (target: AccessTarget) =>
	target.accountId !== undefined
		? { accountId: target.accountId, personId: null }
		: { personId: target.personId, accountId: null };

const targetOf = (grant: {
	accountId: string | null;
	personId: string | null;
}): AccessTarget =>
	grant.accountId !== null
		? { accountId: grant.accountId }
		: { personId: grant.personId as string };

const ENTRY_COLUMNS = [
	"id",
	"personId",
	"accountId",
	"userId",
	"invitedEmail",
	"level",
	"grantedByUserId",
	"expiresAt",
	"needsConfirmation",
	"supersedesGrantId",
	"createdAt",
] as const;

type EntryRow = Awaited<ReturnType<typeof liveEntryRows>>[number];

const liveEntryRows = (where: Record<string, unknown>) =>
	db.accessGrants
		.where({ revokedAt: null, ...where })
		.order({ createdAt: "ASC" })
		.select(...ENTRY_COLUMNS);

/** Names and emails for a set of logins. */
export async function usersById(ids: Iterable<string | null | undefined>) {
	const wanted = [...new Set([...ids].filter((id): id is string => !!id))];
	const users =
		wanted.length > 0
			? await db.users
					.where({ id: { in: wanted } })
					.select("id", "name", "email")
			: [];
	return new Map(users.map((u) => [u.id, u]));
}

const toEntry = (
	row: EntryRow,
	users: Awaited<ReturnType<typeof usersById>>,
	me: string,
	now: number,
): AccessEntry => {
	const user = row.userId ? users.get(row.userId) : undefined;
	const pending = row.userId === null;
	return {
		grantId: row.id,
		level: row.level,
		userId: row.userId,
		name: user?.name ?? null,
		email: user?.email ?? row.invitedEmail ?? "",
		pending,
		expired: pending && isExpired(row, now),
		expiresAt: row.expiresAt,
		isMe: row.userId === me,
		addedHolder:
			row.personId !== null &&
			row.userId !== null &&
			row.userId === row.grantedByUserId &&
			row.supersedesGrantId === null,
		needsConfirmation: row.needsConfirmation,
		grantedAt: row.createdAt,
		grantedByName: row.grantedByUserId
			? (users.get(row.grantedByUserId)?.name ?? null)
			: null,
	};
};

/** Everyone with access to a target. Owners only. */
export async function listAccess(target: AccessTarget): Promise<AccessList> {
	requireOwnerOf(target);
	const ctx = requireAccess();
	const now = Date.now();

	const account =
		target.accountId !== undefined
			? await db.brokerAccounts
					.unscope("default")
					.find(target.accountId)
					.select("id", "label", "personId", "broker")
			: null;
	const holder = await db.persons
		.unscope("default")
		.find(account ? account.personId : (target.personId as string))
		.select("id", "displayName", "kind");

	const holderRows = await liveEntryRows({
		personId: holder.id,
		accountId: null,
	});
	const directRows = account
		? await liveEntryRows({ accountId: account.id, personId: null })
		: [];

	// On a holder, also list people who are on only some of its accounts.
	const siblingAccounts = account
		? []
		: await db.brokerAccounts
				.unscope("default")
				.where({ personId: holder.id })
				.select("id", "label", "broker");
	const onAccountRows =
		siblingAccounts.length > 0
			? await liveEntryRows({
					accountId: { in: siblingAccounts.map((a) => a.id) },
					personId: null,
				})
			: [];

	const all = [...holderRows, ...directRows, ...onAccountRows];
	const users = await usersById(
		all.flatMap((r) => [r.userId, r.grantedByUserId]),
	);
	const entry = (row: EntryRow) => toEntry(row, users, ctx.userId, now);
	const accountsById = new Map(siblingAccounts.map((a) => [a.id, a]));

	return {
		target: {
			kind: account ? "account" : "holder",
			id: account ? account.id : holder.id,
			label: account ? account.label : holder.displayName,
			holder,
		},
		holderWide: holderRows.map(entry),
		direct: directRows.map(entry),
		onAccounts: onAccountRows.flatMap((row) => {
			const a = accountsById.get(row.accountId as string);
			return a
				? [
						{
							...entry(row),
							accountId: a.id,
							accountLabel: a.label,
							broker: a.broker,
						},
					]
				: [];
		}),
		ownsHolder: atLeast(ctx.personLevels.get(holder.id), "owner"),
	};
}

/**
 * A holder must keep at least one owner who can actually sign in and whose
 * ownership is settled. Throws if taking `grant` away (or lowering it) would
 * leave none.
 */
async function assertNotLastOwner(grant: {
	id: string;
	personId: string | null;
	userId: string | null;
	level: AccessLevel;
	needsConfirmation: boolean;
}): Promise<void> {
	if (
		grant.personId === null ||
		grant.level !== "owner" ||
		grant.needsConfirmation ||
		!grant.userId
	)
		return;
	const others = await db.accessGrants
		.where({
			revokedAt: null,
			personId: grant.personId,
			accountId: null,
			level: "owner",
			needsConfirmation: false,
			userId: { not: null },
			id: { not: grant.id },
		})
		.count();
	if (others === 0)
		throw new ORPCError("BAD_REQUEST", {
			status: 400,
			message: "This would leave no owner. Make someone else an owner first.",
			data: { code: "LAST_OWNER" },
		});
}

const MANAGE_COLUMNS = [
	"id",
	"personId",
	"accountId",
	"userId",
	"invitedEmail",
	"level",
	"expiresAt",
	"needsConfirmation",
] as const;

/**
 * Give `email` a level on a target, or change the level they have. Owners
 * only. If nobody with that verified email has signed in yet, the grant waits
 * as an invite for 14 days.
 */
export async function grantAccess(input: {
	target: AccessTarget;
	email: string;
	level: AccessLevel;
}): Promise<{ grantId: string; pending: boolean; inviteToken: string | null; unchanged: boolean }> {
	requireOwnerOf(input.target);
	const { userId: me } = requireAccess();
	const email = input.email.trim().toLowerCase();
	const now = Date.now();

	const self = await db.users.find(me).select("email");
	if (self.email?.toLowerCase() === email)
		throw new ORPCError("BAD_REQUEST", {
			status: 400,
			message: "That's you — you already have access.",
			data: { code: "SELF" },
		});

	const user = await db.users.where({ emailVerified: true })
		.whereSql`lower("email") = ${email}`
		.select("id")
		.takeOptional();
	const grantee = user
		? { userId: user.id, invitedEmail: null }
		: { userId: null, invitedEmail: email };

	// Sharing one account with someone who already has at least this much on
	// all of the holder's accounts would change nothing — say so instead.
	if (input.target.accountId !== undefined) {
		const personId = await db.brokerAccounts
			.unscope("default")
			.find(input.target.accountId)
			.get("personId");
		const covering = await db.accessGrants
			.where({ revokedAt: null, personId, accountId: null, ...grantee })
			.select("level", "expiresAt")
			.takeOptional();
		if (
			covering &&
			!isExpired(covering, now) &&
			rank(covering.level) >= rank(input.level)
		)
			throw new ORPCError("CONFLICT", {
				status: 409,
				message:
					"They already have this on all of this person's accounts. Change it there.",
				data: { code: "COVERED_BY_HOLDER", level: covering.level, personId },
			});
	}

	return db.$transaction(async () => {
		const existing = await db.accessGrants
			.where({ revokedAt: null, ...targetWhere(input.target), ...grantee })
			.select(...MANAGE_COLUMNS)
			.takeOptional();
		if (existing) {
			const sameLevel = existing.level === input.level;
			if (sameLevel && !isExpired(existing, now))
				return { grantId: existing.id, pending: !user, inviteToken: null, unchanged: true };
			if (!sameLevel) await assertNotLastOwner(existing);
			await endGrant(
				existing.id,
				sameLevel ? "renewed" : "level_changed",
				me,
				true,
			);
		}
		const inviteToken = user ? null : newInviteToken();
		const created = await db.accessGrants.create({
			...targetWhere(input.target),
			...grantee,
			level: input.level,
			grantedByUserId: me,
			supersedesGrantId: existing?.id ?? null,
			expiresAt: user ? null : now + INVITE_TTL_MS,
			inviteToken,
			// A changed level is not news; a first share is.
			seenAt: existing ? now : null,
		});
		return { grantId: created.id, pending: !user, inviteToken, unchanged: false };
	});
}

async function findLiveGrant(grantId: string) {
	const grant = await db.accessGrants
		.where({ id: grantId, revokedAt: null })
		.select(...MANAGE_COLUMNS)
		.takeOptional();
	if (!grant)
		throw new ORPCError("NOT_FOUND", { status: 404, message: "Not found" });
	return grant;
}

/**
 * Take a grant away. An owner of the target can remove anyone (or cancel an
 * invite); anyone can remove themselves. The holder keeps an owner either way.
 */
export async function revokeAccess(grantId: string): Promise<void> {
	const { userId: me } = requireAccess();
	const grant = await findLiveGrant(grantId);
	const isSelf = grant.userId === me;
	// Someone else's grant on a target the caller does not own reads as missing.
	if (!isSelf) requireOwnerOf(targetOf(grant));

	const reason: GrantEndReason = isSelf
		? "left"
		: grant.userId === null
			? "cancelled"
			: "removed";

	// The person removed is told once — unless they left, it was an invite
	// nobody had accepted, or they still see the account through its holder.
	let silent = reason !== "removed";
	if (!silent && grant.accountId !== null && grant.userId !== null) {
		const personId = await db.brokerAccounts
			.unscope("default")
			.find(grant.accountId)
			.get("personId");
		silent = await db.accessGrants
			.where({ revokedAt: null, personId, accountId: null, userId: grant.userId })
			.exists();
	}

	await db.$transaction(async () => {
		await assertNotLastOwner(grant);
		await endGrant(grant.id, reason, me, silent);
		// Leaving "all of Anil's accounts" means leaving them: an entry on one
		// of those accounts at the same level or lower was never shown on its
		// own, so it must not quietly keep the account in view. One that gives
		// more than the holder-wide entry did is theirs to give up separately.
		if (isSelf && grant.personId !== null && grant.accountId === null) {
			const accountIds = await db.brokerAccounts
				.unscope("default")
				.where({ personId: grant.personId })
				.pluck("id");
			if (accountIds.length > 0) {
				const covered = await db.accessGrants
					.where({ revokedAt: null, userId: me, accountId: { in: accountIds } })
					.select("id", "level");
				for (const own of covered)
					if (atLeast(grant.level, own.level)) await endGrant(own.id, "left", me, true);
			}
		}
	});
}

/** Send an invite again: a fresh 14 days and a fresh link. Owners only. */
export async function resendInvite(
	grantId: string,
): Promise<{ grantId: string; inviteToken: string }> {
	const { userId: me } = requireAccess();
	const grant = await findLiveGrant(grantId);
	requireOwnerOf(targetOf(grant));
	if (grant.userId !== null || grant.invitedEmail === null)
		throw new ORPCError("BAD_REQUEST", {
			status: 400,
			message: "They have already signed in — there is no invite to send.",
		});
	const now = Date.now();
	const inviteToken = newInviteToken();
	return db.$transaction(async () => {
		await endGrant(grant.id, "renewed", me, true);
		const created = await db.accessGrants.create({
			...targetWhere(targetOf(grant)),
			userId: null,
			invitedEmail: grant.invitedEmail,
			level: grant.level,
			grantedByUserId: me,
			supersedesGrantId: grant.id,
			expiresAt: now + INVITE_TTL_MS,
			inviteToken,
		});
		return { grantId: created.id, inviteToken };
	});
}

/**
 * The one-tap confirm for an accepted Owner invite: an existing owner says
 * "yes, that is who I meant". Until then the grant is worth View.
 */
export async function confirmOwner(grantId: string): Promise<void> {
	const { userId: me } = requireAccess();
	const grant = await findLiveGrant(grantId);
	requireOwnerOf(targetOf(grant));
	if (!grant.needsConfirmation || grant.userId === me)
		throw new ORPCError("BAD_REQUEST", {
			status: 400,
			message: "There is nothing to confirm here.",
		});
	await db.accessGrants
		.where({ id: grant.id, revokedAt: null })
		.update({ needsConfirmation: false, confirmedAt: Date.now() });
}

/**
 * "This reached the wrong person" from the invite email. Needs only the
 * link's token; stops the invite at once. Says nothing about whether the
 * token existed.
 */
export async function reportInviteWrong(inviteToken: string): Promise<void> {
	const grant = await db.accessGrants
		.where({ inviteToken, revokedAt: null, userId: null })
		.select("id")
		.takeOptional();
	if (grant) await endGrant(grant.id, "reported_wrong", null, true);
}
