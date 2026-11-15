import { env } from "@backend/configs/env.config";
import { settleActions } from "@backend/modules/corporate-actions/services/corporate_actions.service";
import { settleDividends } from "@backend/modules/dividends/services/dividends.service";
import { requestMarketSync } from "@backend/modules/market-data/services/sync.market.service";
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
	// Splits and bonuses already known for what this account now holds.
	await settleActions(accountId);
	// Dividends due on what it holds, now that the holdings are right.
	await settleDividends(accountId);
	// Only a request for one: the sync itself is started by a timer that lives
	// outside this request and its transaction (see `requestMarketSync`), and
	// by then this change has been committed and the new instruments are visible.
	if (marketSyncEnabled()) requestMarketSync();
}
