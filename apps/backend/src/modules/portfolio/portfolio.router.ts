import { db } from "@backend/db/db";
import {
	requireAccess,
	requirePersonLevel,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import { BROKER_ENUM } from "@connected-repo/zod-schemas/enums.zod";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

// Holders, accounts and saved groups. Reads are limited to what the caller can
// see by each table's default scope (lib/request-context.ts); the handlers
// below add the checks a write needs.

const createPerson = rpcPortfolioProcedure
	.input(z.object({ displayName: z.string().min(1).max(120) }))
	.handler(({ input, context: { user } }) =>
		// Whoever adds a holder owns it — and through it every account the
		// holder gets, now or later.
		db.$transaction(async () => {
			const person = await db.persons.create({
				displayName: input.displayName,
			});
			await db.accessGrants.create({
				personId: person.id,
				userId: user.id,
				level: "owner",
				grantedByUserId: user.id,
			});
			return person;
		}),
	);

const listPersons = rpcPortfolioProcedure.handler(() =>
	db.persons.order({ displayName: "ASC" }).select("id", "displayName"),
);

const createAccount = rpcPortfolioProcedure
	.input(
		z.object({
			personId: z.string(),
			broker: z.enum(BROKER_ENUM),
			label: z.string().min(1).max(120),
		}),
	)
	.handler(({ input }) => {
		requirePersonLevel(input.personId, "owner");
		return db.brokerAccounts.create({
			personId: input.personId,
			broker: input.broker,
			label: input.label,
		});
	});

const listAccounts = rpcPortfolioProcedure.handler(async () => {
	const { accountLevels } = requireAccess();
	const accounts = await db.brokerAccounts
		.order({ createdAt: "ASC" })
		.select("id", "personId", "broker", "label", "baseCurrency");
	// `level` is what the caller may do with each account (view/edit/owner).
	return accounts.flatMap((account) => {
		const level = accountLevels.get(account.id);
		return level ? [{ ...account, level }] : [];
	});
});

// Saved groups are personal views over the accounts a user can see.

const createGroup = rpcPortfolioProcedure
	.input(z.object({ name: z.string().min(1).max(120) }))
	.handler(({ input, context: { user } }) =>
		db.accountGroups.create({ name: input.name, userId: user.id }),
	);

const setGroupMembers = rpcPortfolioProcedure
	.input(z.object({ groupId: z.string(), accountIds: z.array(z.string()) }))
	.handler(async ({ input }) => {
		const { accountLevels } = requireAccess();
		await db.accountGroups.find(input.groupId); // scoped: the caller's own group
		// A group may only hold accounts the caller can see.
		for (const accountId of input.accountIds) {
			if (!accountLevels.has(accountId))
				throw new ORPCError("NOT_FOUND", {
					status: 404,
					message: "Account not found",
				});
		}
		await db.$transaction(async () => {
			await db.accountGroupMembers
				.unscope("default")
				.where({ groupId: input.groupId })
				.delete();
			if (input.accountIds.length > 0) {
				await db.accountGroupMembers.createMany(
					input.accountIds.map((accountId) => ({
						groupId: input.groupId,
						accountId,
					})),
				);
			}
		});
		return { ok: true as const };
	});

const listGroups = rpcPortfolioProcedure.handler(async () => {
	const groups = await db.accountGroups
		.order({ name: "ASC" })
		.select("id", "name");
	if (groups.length === 0) return [];
	// Scoped to visible accounts: an account the caller has since lost access
	// to silently drops out of their groups.
	const members = await db.accountGroupMembers
		.where({ groupId: { in: groups.map((g) => g.id) } })
		.select("groupId", "accountId");
	return groups.map((g) => ({
		...g,
		accountIds: members
			.filter((m) => m.groupId === g.id)
			.map((m) => m.accountId),
	}));
});

export const portfolioRouter = {
	createPerson,
	listPersons,
	createAccount,
	listAccounts,
	createGroup,
	setGroupMembers,
	listGroups,
};
