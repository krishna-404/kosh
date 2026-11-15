import {
	confirmOwner,
	grantAccess,
	listAccess,
	reportInviteWrong,
	resendInvite,
	revokeAccess,
	toTarget,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import {
	acknowledgeNotices,
	getAccessMatrix,
	getAccessNotices,
	getInviteStatus,
} from "@backend/modules/portfolio/services/directory.portfolio.service";
import { notifyShared } from "@backend/modules/portfolio/services/notify.portfolio.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import { rpcPublicProcedure } from "@backend/procedures/public.procedure";
import {
	accessGrantInputZod,
	accessListZod,
	accessMatrixZod,
	accessNoticesZod,
	accessTargetZod,
	inviteStatusZod,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { z } from "zod";

// Sharing. A target is one account, or a holder (all of that holder's
// accounts, including ones added later). The checks live in
// services/access.portfolio.service.ts; this file only wires them up.

const ok = z.object({ ok: z.literal(true) });
const grantId = z.object({ grantId: z.string() });
const inviteToken = z.object({ token: z.string().min(20).max(64) });

// People with access to a target. Owners only.
const list = rpcPortfolioProcedure
	.input(accessTargetZod)
	.output(accessListZod)
	.handler(({ input }) => listAccess(toTarget(input)));

// Share, or change someone's level: grant the new one. Owners only.
const grant = rpcPortfolioProcedure
	.input(accessGrantInputZod)
	.output(z.object({ grantId: z.string(), pending: z.boolean() }))
	.handler(async ({ input, context: { user } }) => {
		const result = await grantAccess({
			target: toTarget(input.target),
			email: input.email,
			level: input.level,
		});
		notifyShared({ grantId: result.grantId, inviteToken: result.inviteToken, by: user });
		return { grantId: result.grantId, pending: result.pending };
	});

// Remove someone, cancel an invite, or leave.
const revoke = rpcPortfolioProcedure
	.input(grantId)
	.output(ok)
	.handler(async ({ input }) => {
		await revokeAccess(input.grantId);
		return { ok: true as const };
	});

// Send an invite again: a fresh 14 days.
const resend = rpcPortfolioProcedure
	.input(grantId)
	.output(grantId)
	.handler(async ({ input, context: { user } }) => {
		const result = await resendInvite(input.grantId);
		notifyShared({ grantId: result.grantId, inviteToken: result.inviteToken, by: user });
		return { grantId: result.grantId };
	});

// "Yes, that is who I meant" for an accepted Owner invite.
const confirm = rpcPortfolioProcedure
	.input(grantId)
	.output(ok)
	.handler(async ({ input }) => {
		await confirmOwner(input.grantId);
		return { ok: true as const };
	});

// Who can see what, across everything the caller owns.
const matrix = rpcPortfolioProcedure
	.output(accessMatrixZod)
	.handler(({ context: { user } }) => getAccessMatrix(user.id));

// New shares, lost access and owner invites to confirm — each told once.
const notices = rpcPortfolioProcedure
	.output(accessNoticesZod)
	.handler(({ context: { user } }) => getAccessNotices(user.id));

const acknowledge = rpcPortfolioProcedure
	.input(
		z.object({
			arrivals: z.array(z.string()).max(500).default([]),
			lost: z.array(z.string()).max(500).default([]),
		}),
	)
	.output(ok)
	.handler(async ({ input, context: { user } }) => {
		await acknowledgeNotices(user.id, input);
		return { ok: true as const };
	});

// What became of the invite behind a link, for whoever opened it signed in.
const inviteStatus = rpcPortfolioProcedure
	.input(inviteToken)
	.output(inviteStatusZod)
	.handler(({ input, context: { user } }) => getInviteStatus(user, input.token));

// "This reached the wrong person" — from the email, no sign-in needed.
const reportWrong = rpcPublicProcedure
	.input(inviteToken)
	.output(ok)
	.handler(async ({ input }) => {
		await reportInviteWrong(input.token);
		return { ok: true as const };
	});

export const accessRouter = {
	list,
	grant,
	revoke,
	resend,
	confirm,
	matrix,
	notices,
	acknowledge,
	inviteStatus,
	reportWrong,
};
