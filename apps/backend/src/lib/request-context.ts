import { AsyncLocalStorage } from "node:async_hooks";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";

/**
 * Per-request access scope, propagated via AsyncLocalStorage. Set by
 * `rpcPortfolioProcedure` from the caller's rows in `access_grants`.
 *
 * The broker account is the unit of access. Every account-scoped table's
 * default scope reads `accountIds` to filter every query, so a handler cannot
 * read another account's rows by accident; writes additionally call
 * `requireAccountLevel` / `requirePersonLevel` (access.portfolio.service.ts).
 *
 * The snapshot is taken once per request: a grant created inside a request is
 * not visible to that same request's scopes.
 */
export interface RequestContext {
	userId: string;
	/** Effective level per account the caller can see (max of account + holder grants). */
	accountLevels: ReadonlyMap<string, AccessLevel>;
	/** Level per holder the caller has a holder-wide grant on. */
	personLevels: ReadonlyMap<string, AccessLevel>;
	/** Keys of `accountLevels`. Never empty — see `NO_ROWS`. */
	accountIds: readonly string[];
	/** Holders the caller can see: granted directly, or holding a visible account. Never empty. */
	personIds: readonly string[];
}

/**
 * Stand-in id for "no rows". `IN ()` is not valid SQL, so an empty access list
 * is represented by one id that can never exist (ids are 26-char ULIDs).
 */
export const NO_ROWS = "-";

export const requestContext = new AsyncLocalStorage<RequestContext>();
export const getRequestContext = () => requestContext.getStore();
