import { db } from "@backend/db/db";
import {
	getRequestContext,
	NO_ROWS,
	type RequestContext,
} from "@backend/lib/request-context";
import {
	ACCESS_LEVEL_ENUM,
	type AccessLevel,
} from "@connected-repo/zod-schemas/enums.zod";
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

/** `IN ()` is not valid SQL — an empty list becomes one id that matches nothing. */
const inList = (ids: Iterable<string>): string[] => {
	const list = [...ids];
	return list.length > 0 ? list : [NO_ROWS];
};

// ─── Resolving a caller's access ────────────────────────────────────────

export interface AccessUser {
	id: string;
	email: string | null;
	emailVerified: boolean;
}

/**
 * Everything `user` can reach, read fresh from `access_grants`.
 *
 * A grant counts when it names the user, or names their email and that email
 * is verified — so an invite sent to an address starts working the moment its
 * real owner signs in, and never for someone who merely typed it at sign-up.
 *
 * A holder-wide grant covers every account of that holder, present and
 * future; the effective level on an account is the higher of its own grant
 * and its holder's.
 */
export async function loadAccess(user: AccessUser): Promise<RequestContext> {
	const live = db.accessGrants.where({ revokedAt: null });
	const invitedAs =
		user.email && user.emailVerified ? user.email.toLowerCase() : null;
	const grants = await (invitedAs
		? live.where({ OR: [{ userId: user.id }, { invitedEmail: invitedAs }] })
		: live.where({ userId: user.id })
	).select("personId", "accountId", "level");

	const personLevels = new Map<string, AccessLevel>();
	const ownAccountLevels = new Map<string, AccessLevel>();
	for (const g of grants) {
		if (g.personId)
			personLevels.set(
				g.personId,
				higher(personLevels.get(g.personId), g.level),
			);
		else if (g.accountId)
			ownAccountLevels.set(
				g.accountId,
				higher(ownAccountLevels.get(g.accountId), g.level),
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

/** What a grant is on: one account, or a holder (all their accounts). */
export type AccessTarget =
	| { accountId: string; personId?: undefined }
	| { personId: string; accountId?: undefined };

const requireOwnerOf = (target: AccessTarget): void => {
	if (target.accountId !== undefined)
		requireAccountLevel(target.accountId, "owner");
	else requirePersonLevel(target.personId, "owner");
};

const targetWhere = (target: AccessTarget) =>
	target.accountId !== undefined
		? { accountId: target.accountId, personId: null }
		: { personId: target.personId, accountId: null };

export interface AccessEntry {
	grantId: string;
	level: AccessLevel;
	/** `holder`: comes from a grant on the account's holder, shown read-only on the account. */
	via: "account" | "holder";
	userId: string | null;
	name: string | null;
	email: string | null;
	/** Invited by email and not signed in yet. */
	pending: boolean;
	grantedAt: number;
}

/** Everyone with access to a target. Owners only. */
export async function listAccess(target: AccessTarget): Promise<AccessEntry[]> {
	requireOwnerOf(target);

	const columns = [
		"id",
		"personId",
		"userId",
		"invitedEmail",
		"level",
		"createdAt",
	] as const;
	const own = await db.accessGrants
		.where({ revokedAt: null, ...targetWhere(target) })
		.order({ createdAt: "ASC" })
		.select(...columns);

	// On an account, also show who reaches it through its holder.
	let inherited: typeof own = [];
	if (target.accountId !== undefined) {
		const personId = await db.brokerAccounts
			.unscope("default")
			.find(target.accountId)
			.get("personId");
		inherited = await db.accessGrants
			.where({ revokedAt: null, personId, accountId: null })
			.order({ createdAt: "ASC" })
			.select(...columns);
	}

	const rows = [...inherited, ...own];
	const userIds = rows
		.map((r) => r.userId)
		.filter((id): id is string => id !== null);
	const users =
		userIds.length > 0
			? await db.users
					.where({ id: { in: userIds } })
					.select("id", "name", "email")
			: [];
	const byId = new Map(users.map((u) => [u.id, u]));

	return rows.map((r) => {
		const user = r.userId ? byId.get(r.userId) : undefined;
		return {
			grantId: r.id,
			level: r.level,
			via:
				target.accountId !== undefined && r.personId !== null
					? "holder"
					: "account",
			userId: r.userId,
			name: user?.name ?? null,
			email: user?.email ?? r.invitedEmail,
			pending: r.userId === null,
			grantedAt: r.createdAt,
		};
	});
}

/**
 * A holder must keep at least one owner who can actually sign in. Throws if
 * taking `grant` away (or lowering it) would leave none.
 */
async function assertNotLastOwner(grant: {
	id: string;
	personId: string | null;
	userId: string | null;
	level: AccessLevel;
}): Promise<void> {
	if (grant.personId === null || grant.level !== "owner" || !grant.userId)
		return;
	const others = await db.accessGrants
		.where({
			revokedAt: null,
			personId: grant.personId,
			accountId: null,
			level: "owner",
			userId: { not: null },
			id: { not: grant.id },
		})
		.count();
	if (others === 0)
		throw new ORPCError("BAD_REQUEST", {
			status: 400,
			message: "This would leave no owner. Make someone else an owner first.",
		});
}

const revokeRow = (grantId: string, byUserId: string) =>
	db.accessGrants
		.where({ id: grantId })
		.update({ revokedAt: Date.now(), revokedByUserId: byUserId });

/**
 * Give `email` a level on a target, or change the level they have. Owners
 * only. If nobody with that verified email has signed in yet, the grant waits
 * as an invite.
 */
export async function grantAccess(input: {
	target: AccessTarget;
	email: string;
	level: AccessLevel;
}): Promise<{ grantId: string; pending: boolean }> {
	requireOwnerOf(input.target);
	const { userId: me } = requireAccess();
	const email = input.email.trim().toLowerCase();

	const user = await db.users.where({ emailVerified: true })
		.whereSql`lower("email") = ${email}`
		.select("id")
		.takeOptional();
	const grantee = user
		? { userId: user.id, invitedEmail: null }
		: { userId: null, invitedEmail: email };

	return db.$transaction(async () => {
		const existing = await db.accessGrants
			.where({ revokedAt: null, ...targetWhere(input.target), ...grantee })
			.select("id", "personId", "userId", "level")
			.takeOptional();
		if (existing) {
			if (existing.level === input.level)
				return { grantId: existing.id, pending: !user };
			await assertNotLastOwner(existing);
			await revokeRow(existing.id, me);
		}
		const created = await db.accessGrants.create({
			...targetWhere(input.target),
			...grantee,
			level: input.level,
			grantedByUserId: me,
		});
		return { grantId: created.id, pending: !user };
	});
}

/** Take a grant away. Owners of its target only. */
export async function revokeAccess(grantId: string): Promise<void> {
	const { userId: me } = requireAccess();
	const grant = await db.accessGrants
		.where({ id: grantId, revokedAt: null })
		.select("id", "personId", "accountId", "userId", "level")
		.takeOptional();
	if (!grant)
		throw new ORPCError("NOT_FOUND", { status: 404, message: "Not found" });
	requireOwnerOf(
		grant.accountId !== null
			? { accountId: grant.accountId }
			: { personId: grant.personId as string },
	);
	await db.$transaction(async () => {
		await assertNotLastOwner(grant);
		await revokeRow(grant.id, me);
	});
}
