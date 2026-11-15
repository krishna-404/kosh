import { requestContext } from "@backend/lib/request-context";
import { createRateLimitMiddleware } from "@backend/middlewares/rate_limit.middleware";
import { rpcAuthMiddleware } from "@backend/modules/auth/auth.middleware";
import type { ActiveSessionSelectAll } from "@backend/modules/auth/tables/session.auth.table";
import { ensureFamilyId } from "@backend/modules/portfolio/services/ensure_family.portfolio.service";
import {
	type RpcContextWithHeaders,
	rpcPublicProcedure,
} from "@backend/procedures/public.procedure";
import type { UserSelectAll } from "@connected-repo/zod-schemas/user.zod";

/**
 * @public
 */
export interface RpcAuthenticatedContext extends RpcContextWithHeaders {
	session: ActiveSessionSelectAll;
	user: UserSelectAll;
}

/**
 * @public
 */
export interface RpcFamilyContext extends RpcAuthenticatedContext {
	familyId: string;
}

/** Requires a valid session. */
export const rpcProtectedProcedure = rpcPublicProcedure.use(rpcAuthMiddleware);

/**
 * Requires a valid session and runs the rest of the handler inside an
 * AsyncLocalStorage scope carrying the caller's family — the tenant every
 * Kosh row belongs to. The `koshFamilyId` column reads it to auto-stamp
 * `familyId` on every insert, and each family-scoped table's default scope
 * reads it to filter every query, so handlers never pass or check `familyId`.
 *
 * The family comes from the user's own row (`users.family_id`); the client
 * sends nothing to select it. Use this for every portfolio endpoint.
 *
 * Rate limit: 300 requests/min per authenticated user (5 req/sec sustained,
 * with a full-bucket burst up to 300). The purpose is to cap runaway clients
 * (infinite-loop bugs, malicious scripts), not to throttle real traffic.
 *
 * Cost per accepted request: one SELECT + one UPDATE against `rate_limits`.
 * Rows are keyed by userId so there's exactly one row per active user, kept
 * hot in the Postgres buffer cache — an extra ~1ms per RPC under normal load.
 * The rate-limit gate runs BEFORE the handler's own DB reads and BEFORE input
 * validation, so a throttled request never touches the domain tables.
 */
export const rpcFamilyProcedure = rpcProtectedProcedure
	.use(async ({ context, next }) => {
		const familyId = await ensureFamilyId(context.user.id);

		return requestContext.run({ familyId, userId: context.user.id }, () =>
			next({ context: { ...context, familyId } }),
		);
	})
	.use(
		createRateLimitMiddleware<RpcFamilyContext>({
			bucketFn: (ctx) => ({
				key: `app:user:${ctx.user.id}`,
				limit: 300,
				windowSeconds: 60,
			}),
			label: "app",
		}),
	);
