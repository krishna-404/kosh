import { kickMarketSync } from "@backend/modules/market-data/services/sync.market.service";
import { marketSyncEnabled } from "@backend/modules/metrics/services/ledger_changed";
import { logger } from "@backend/utils/logger.utils";
import cron, { type ScheduledTask } from "node-cron";

let tasks: ScheduledTask[] = [];

/**
 * Keep prices up to date without anyone asking.
 *
 * NSE publishes the day's bhavcopy in the early evening in India and AMFI
 * the day's NAVs late at night, so prices are fetched after each: 14:10 UTC
 * (19:40 IST) on market days, and 18:40 UTC (00:10 IST) every day. A run
 * that finds nothing new costs one cheap query; one that cannot reach the
 * exchange says so in `market_state.last_sync_note` and tries again next time.
 * Whichever process holds the sync lease does the work, so several server
 * instances do not download the same files.
 */
export function startMarketDataCron(): void {
	if (!marketSyncEnabled()) {
		logger.info("Market data sync is off; prices will not be fetched");
		return;
	}
	if (tasks.length > 0) return;
	tasks = [
		cron.schedule("10 14 * * 1-5", kickMarketSync),
		cron.schedule("40 18 * * *", kickMarketSync),
	];
	// Catch up on whatever was missed while the server was down.
	setTimeout(kickMarketSync, 20_000).unref();
}

export function stopMarketDataCron(): void {
	for (const task of tasks) task.stop();
	tasks = [];
}
