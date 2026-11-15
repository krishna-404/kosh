import { BaseTable } from "@backend/db/base_table";

/**
 * One row (id 1). `pricesVersion` goes up whenever price bars change, so
 * anything worked out from prices can tell that it is stale.
 */
export class MarketStateTable extends BaseTable {
	readonly table = "market_state";

	columns = this.setColumns((t) => ({
		id: t.integer().primaryKey(),
		pricesVersion: t.integer().default(0),
		lastSyncAt: t.timestampNumber().nullable(),
		/** What the last sync did, or why it could not finish — for the feed-health view. */
		lastSyncNote: t.text().nullable(),
		/** False when the last sync could not finish (the note then says why). */
		lastSyncOk: t.boolean().default(true),
		/** Held by whichever process is syncing, so two do not download the same files. */
		syncLeaseUntil: t.timestampNumber().nullable(),

		...t.timestampsAsNumbers(),
	}));
}
