/**
 * Bring prices up to date now, and say what happened — the same job the
 * server runs by itself after market close and after an upload.
 *
 *   yarn workspace @connected-repo/backend market:sync
 *   yarn workspace @connected-repo/backend market:sync -- --take-over
 *
 * `--take-over` clears a sync lease left behind by a process that was
 * killed mid-run (otherwise it frees itself after ten minutes).
 */
import { db } from "@backend/db/db";
import { syncMarketData } from "@backend/modules/market-data/services/sync.market.service";

async function main(): Promise<void> {
	if (process.argv.includes("--take-over"))
		await db.marketState.where({ id: 1 }).update({ syncLeaseUntil: null });

	for (let round = 1; round <= 200; round++) {
		const report = await syncMarketData({ maxDays: 150 });
		console.info(
			`round ${round}: ${report.daysFetched} days fetched, ${report.barsWritten} prices added, ${report.daysRemaining} days to go`,
		);
		if (report.problems.length > 0) {
			console.warn(`stopped: ${report.problems.join("; ")}`);
			process.exitCode = 1;
			return;
		}
		if (report.daysRemaining === 0) break;
	}
	const instruments = await db.instruments
		.whereSql`"tracked_since" IS NOT NULL`
		.order({ symbolCanonical: "ASC" })
		.select("symbolCanonical", "priceSource", "pricedFrom", "pricedThrough");
	for (const i of instruments)
		console.info(
			`  ${i.symbolCanonical.padEnd(14)} ${(i.priceSource ?? "no price source").padEnd(16)} ${i.pricedFrom ?? "—"} → ${i.pricedThrough ?? "—"}`,
		);
}

main()
	.then(() => process.exit(process.exitCode ?? 0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
