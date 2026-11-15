import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request tenant scope, propagated via AsyncLocalStorage. Set by
 * `rpcFamilyProcedure` for user requests.
 *
 * Read by the `koshFamilyId` column's `setOnCreate` hook (see
 * `db/base_table.ts`) to auto-stamp `familyId` on every insert, and by each
 * family-scoped table's default scope to filter every read — making it
 * impossible to write or read a row without tenant identity.
 */
export interface RequestContext {
	familyId: string;
	userId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
export const getRequestContext = () => requestContext.getStore();
