import {
	type RequestContext,
	requestContext,
} from "@backend/lib/request-context";
import { createRateLimitMiddleware } from "@backend/middlewares/rate_limit.middleware";
import { rpcAuthMiddleware } from "@backend/modules/auth/auth.middleware";
import type { ActiveSessionSelectAll } from "@backend/modules/auth/tables/session.auth.table";
import { loadAccess } from "@backend/modules/portfolio/services/access.portfolio.service";
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
export interface RpcPortfolioContext extends RpcAuthenticatedContext {
	access: RequestContext;
}

/** Requires a valid session. */
export const rpcProtectedProcedure = rpcPublicProcedure.use(rpcAuthMiddleware);

/**
 * Requires a valid session and runs the handler inside an AsyncLocalStorage
 * scope holding the caller's access: which broker accounts they can reach and
 * at what level (see `access_grants`). Every account-scoped table's default
 * scope filters on it, so reads are limited before the handler runs; handlers
 * that change something also call `requireAccountLevel` / `requirePersonLevel`.
 *
 * Access is read fresh from the database on every request — never from the
 * session — so revoking someone takes effect on their next call. The client
 * sends nothing to select a scope. Use this for every portfolio endpoint.
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
export const rpcPortfolioProcedure = rpcProtectedProcedure
	.use(async ({ context, next }) => {
		const access = await loadAccess(context.user);
		return requestContext.run(access, () =>
			next({ context: { ...context, access } }),
		);
	})
	.use(
		createRateLimitMiddleware<RpcPortfolioContext>({
			bucketFn: (ctx) => ({
				key: `app:user:${ctx.user.id}`,
				limit: 300,
				windowSeconds: 60,
			}),
			label: "app",
		}),
	);
