import {
	type AccessTarget,
	grantAccess,
	listAccess,
	revokeAccess,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import { accessLevelZod } from "@connected-repo/zod-schemas/enums.zod";
import { z } from "zod";

// Sharing. A target is one account, or a holder (all of that holder's
// accounts, including ones added later). Every endpoint is owner-only; the
// checks live in access.portfolio.service.ts.

const targetZod = z
	.object({
		accountId: z.string().optional(),
		personId: z.string().optional(),
	})
	.refine((t) => (t.accountId === undefined) !== (t.personId === undefined), {
		message: "Give exactly one of accountId or personId",
	});

const toTarget = (t: z.infer<typeof targetZod>): AccessTarget =>
	t.accountId !== undefined
		? { accountId: t.accountId }
		: { personId: t.personId as string };

const list = rpcPortfolioProcedure
	.input(targetZod)
	.handler(({ input }) => listAccess(toTarget(input)));

// Also the way to change someone's level: grant the new one.
const grant = rpcPortfolioProcedure
	.input(
		z.object({
			target: targetZod,
			email: z.email().max(320),
			level: accessLevelZod,
		}),
	)
	.handler(({ input }) =>
		grantAccess({
			target: toTarget(input.target),
			email: input.email,
			level: input.level,
		}),
	);

const revoke = rpcPortfolioProcedure
	.input(z.object({ grantId: z.string() }))
	.handler(async ({ input }) => {
		await revokeAccess(input.grantId);
		return { ok: true as const };
	});

export const accessRouter = { list, grant, revoke };
