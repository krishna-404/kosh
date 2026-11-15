import { db } from "@backend/db/db";
import {
	requireAccess,
	requireAccountLevel,
	requirePersonLevel,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import { getDirectory } from "@backend/modules/portfolio/services/directory.portfolio.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import {
	accountCreateZod,
	accountUpdateZod,
	directoryZod,
	groupCreateZod,
	groupUpdateZod,
	groupZod,
	personCreateZod,
	personUpdateZod,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

// Holders (persons), broker accounts and saved groups. Access is decided per
// account — see services/access.portfolio.service.ts.

const ok = z.object({ ok: z.literal(true) });
const created = z.object({ id: z.string() });

// ─── Holders ────────────────────────────────────────────────────────────

// Whoever adds a holder owns it (and so every account it will ever have).
const createPerson = rpcPortfolioProcedure
	.input(personCreateZod)
	.output(created)
	.handler(({ input, context: { user } }) =>
		db.$transaction(async () => {
			const person = await db.persons.create({
				displayName: input.displayName,
				kind: input.kind,
				linkedUserId: input.isMe ? user.id : null,
			});
			await db.accessGrants.create({
				personId: person.id,
				userId: user.id,
				level: "owner",
				grantedByUserId: user.id,
				seenAt: Date.now(),
			});
			return { id: person.id };
		}),
	);

// Rename a holder, change what kind it is, or say "this is me". Owners only.
const updatePerson = rpcPortfolioProcedure
	.input(personUpdateZod)
	.output(ok)
	.handler(async ({ input, context: { user } }) => {
		requirePersonLevel(input.personId, "owner");
		const current = await db.persons.find(input.personId).select("linkedUserId");
		// "This is me" can be set to the caller or cleared by the caller — one
		// owner cannot point a holder at another login, or unlink someone else.
		if (
			input.isMe === false &&
			current.linkedUserId !== null &&
			current.linkedUserId !== user.id
		)
			throw new ORPCError("FORBIDDEN", {
				status: 403,
				message: "Only the person this is can unlink themselves",
			});
		await db.persons.where({ id: input.personId }).update({
			...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
			...(input.kind !== undefined ? { kind: input.kind } : {}),
			...(input.isMe !== undefined
				? { linkedUserId: input.isMe ? user.id : null }
				: {}),
		});
		return { ok: true as const };
	});

// ─── Accounts ───────────────────────────────────────────────────────────

// Adding an account for a holder needs owner on that holder.
const createAccount = rpcPortfolioProcedure
	.input(accountCreateZod)
	.output(created)
	.handler(async ({ input, context: { user } }) => {
		requirePersonLevel(input.personId, "owner");
		const account = await db.brokerAccounts.create({
			personId: input.personId,
			broker: input.broker,
			brokerName: input.broker === "manual" ? (input.brokerName ?? null) : null,
			label: input.label,
			createdByUserId: user.id,
		});
		return { id: account.id };
	});

const updateAccount = rpcPortfolioProcedure
	.input(accountUpdateZod)
	.output(ok)
	.handler(async ({ input }) => {
		requireAccountLevel(input.accountId, "owner");
		await db.brokerAccounts
			.where({ id: input.accountId })
			.update({ label: input.label });
		return { ok: true as const };
	});

// Every holder and account the caller can see, with their level on each.
const directory = rpcPortfolioProcedure
	.output(directoryZod)
	.handler(({ context: { user } }) => getDirectory(user));

// ─── Groups: the caller's own saved selections of accounts ──────────────

/** A group may only hold accounts its owner can see. */
const assertVisible = (accountIds: string[]): void => {
	const { accountLevels } = requireAccess();
	for (const accountId of accountIds)
		if (!accountLevels.has(accountId))
			throw new ORPCError("NOT_FOUND", {
				status: 404,
				message: "Account not found",
			});
};

/** The caller's own group, or "not found" — other people's groups do not exist to them. */
async function requireOwnGroup(groupId: string): Promise<void> {
	if (!(await db.accountGroups.where({ id: groupId }).exists()))
		throw new ORPCError("NOT_FOUND", { status: 404, message: "Group not found" });
}

async function replaceMembers(groupId: string, accountIds: string[]) {
	await db.accountGroupMembers.unscope("default").where({ groupId }).delete();
	const unique = [...new Set(accountIds)];
	if (unique.length > 0)
		await db.accountGroupMembers.createMany(
			unique.map((accountId) => ({ groupId, accountId })),
		);
}

const createGroup = rpcPortfolioProcedure
	.input(groupCreateZod)
	.output(created)
	.handler(({ input, context: { user } }) => {
		assertVisible(input.accountIds);
		return db.$transaction(async () => {
			const group = await db.accountGroups.create({
				name: input.name,
				kind: input.kind,
				userId: user.id,
			});
			await replaceMembers(group.id, input.accountIds);
			return { id: group.id };
		});
	});

const updateGroup = rpcPortfolioProcedure
	.input(groupUpdateZod)
	.output(ok)
	.handler(async ({ input }) => {
		await requireOwnGroup(input.groupId);
		if (input.accountIds) assertVisible(input.accountIds);
		await db.$transaction(async () => {
			await db.accountGroups.where({ id: input.groupId }).update({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.kind !== undefined ? { kind: input.kind } : {}),
			});
			if (input.accountIds) await replaceMembers(input.groupId, input.accountIds);
		});
		return { ok: true as const };
	});

const deleteGroup = rpcPortfolioProcedure
	.input(z.object({ groupId: z.string() }))
	.output(ok)
	.handler(async ({ input }) => {
		await requireOwnGroup(input.groupId);
		await db.$transaction(async () => {
			await db.accountGroupMembers
				.unscope("default")
				.where({ groupId: input.groupId })
				.delete();
			await db.accountGroups.where({ id: input.groupId }).delete();
		});
		return { ok: true as const };
	});

// Members are scoped to accounts the caller can still see: an account they
// lose access to simply drops out of their groups.
const listGroups = rpcPortfolioProcedure
	.output(z.array(groupZod))
	.handler(async () => {
		const groups = await db.accountGroups
			.order({ name: "ASC" })
			.select("id", "name", "kind", "createdAt");
		if (groups.length === 0) return [];
		const members = await db.accountGroupMembers
			.where({ groupId: { in: groups.map((g) => g.id) } })
			.select("groupId", "accountId");
		return groups.map((g) => ({
			...g,
			accountIds: members.filter((m) => m.groupId === g.id).map((m) => m.accountId),
		}));
	});

export const portfolioRouter = {
	createPerson,
	updatePerson,
	createAccount,
	updateAccount,
	directory,
	createGroup,
	updateGroup,
	deleteGroup,
	listGroups,
};
