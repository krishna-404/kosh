import { BaseTable } from "@backend/db/base_table";

/**
 * Every pull from a market-data feed, exactly as received. Prices are parsed
 * from here, never straight from the network, so they can be re-derived (a
 * new instrument is backfilled from the files already held) and a bad pull
 * can be thrown away without guessing what it changed.
 *
 * One row per (source, key). A day's bhavcopy (`nse_bhavcopy`, key = the
 * date) never changes once fetched. Feeds that return their full history on
 * every call (`mfapi`, key = the scheme code; `amfi_nav_all`, key = "latest")
 * keep only the newest pull — each one contains everything the last did.
 *
 * `status`: `ok`, or `missing` for a day the exchange published nothing
 * (a holiday) — remembered so it is not asked for again.
 *
 * Reference data, not anyone's: no access scope.
 */
export class ProviderPayloadTable extends BaseTable {
	readonly table = "provider_payloads";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			source: t.string(32),
			key: t.string(64),
			url: t.text(),
			status: t.string(16),
			sha256: t.string(64).nullable(),
			sizeBytes: t.integer().default(0),
			content: t.bytea().nullable(),
			fetchedAt: t.timestampNumber(),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.unique(["source", "key"])],
	);
}
