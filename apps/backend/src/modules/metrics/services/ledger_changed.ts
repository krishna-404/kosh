import { env } from "@backend/configs/env.config";
import { kickMarketSync } from "@backend/modules/market-data/services/sync.market.service";
import { bumpLedger } from "./series.metrics.service";

/** Prices are fetched everywhere except in tests, unless the setting says otherwise. */
export const marketSyncEnabled = (): boolean => env.MARKET_DATA_SYNC ?? env.NODE_ENV !== "test";

/**
 * Called inside the transaction of anything that changes an account's
 * ledger — an upload, an undo, an answer. Marks what was derived from it as
 * stale, and makes sure prices are on their way for anything newly held.
 */
export async function onLedgerChanged(accountId: string): Promise<void> {
	await bumpLedger(accountId);
	// After the response, outside the transaction: new instruments are only
	// visible to the sync once this change has been committed.
	if (marketSyncEnabled()) setTimeout(kickMarketSync, 1500);
}
