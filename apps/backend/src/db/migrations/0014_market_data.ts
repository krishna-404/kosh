import { ulid } from "ulid";
import { change } from "../db_script";

// Phase 4 of the build plan: prices.
//
//  provider_payloads  every feed pull, verbatim — so prices can be re-derived
//                     without downloading again. One row per (source, key):
//                     a day's bhavcopy is its own row for good; feeds that
//                     return their whole history each time keep the latest.
//  price_bars         daily closes for TRACKED instruments only — anything
//                     held in some account, plus the benchmarks. The key
//                     carries a resolution so finer bars need no migration.
//  instruments        how each one is priced and since when it is tracked;
//                     a slug for the benchmarks.
//  market_state       one row: a counter bumped whenever prices change, so
//                     anything computed from prices knows when to recompute.
//  broker_accounts    ledger_version: bumped by every upload, undo and answer.

change(async (db) => {
	await db.createTable(
		"provider_payloads",
		(t) => ({
			id: t.string(26).primaryKey(),
			source: t.string(32),
			key: t.string(64),
			url: t.text(),
			status: t.string(16),
			sha256: t.string(64).nullable(),
			sizeBytes: t.integer().default(0),
			content: t.bytea().nullable(),
			fetchedAt: t.timestamp(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.unique(["source", "key"])],
	);

	await db.createTable(
		"price_bars",
		(t) => ({
			instrumentId: t.string(26).foreignKey("instruments", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			resolution: t.string(4).default("1d"),
			barDate: t.date(),
			close: t.decimal(20, 6),
			source: t.string(16),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.primaryKey(["instrumentId", "resolution", "barDate"])],
	);

	await db.changeTable("instruments", (t) => ({
		slug: t.add(t.string(40).nullable()),
		priceSource: t.add(t.string(16).nullable()),
		trackedSince: t.add(t.date().nullable()),
		pricedFrom: t.add(t.date().nullable()),
		pricedThrough: t.add(t.date().nullable()),
	}));

	await db.createTable("market_state", (t) => ({
		id: t.integer().primaryKey(),
		pricesVersion: t.integer().default(0),
		lastSyncAt: t.timestamp().nullable(),
		lastSyncNote: t.text().nullable(),
		syncLeaseUntil: t.timestamp().nullable(),
		createdAt: t.timestamps().createdAt,
		updatedAt: t.timestamps().updatedAt,
	}));

	await db.changeTable("broker_accounts", (t) => ({
		ledgerVersion: t.add(t.integer().default(0)),
	}));
});

change(async (db, up) => {
	if (!up) return;
	await db.adapter.query(
		`CREATE UNIQUE INDEX "instruments_slug_idx" ON "instruments" ("slug") WHERE "slug" IS NOT NULL`,
	);
	await db.adapter.query(`INSERT INTO "market_state" ("id") VALUES (1)`);

	// What "the same money" is compared with. The NIFTY total-return index is
	// not published openly, so NIFTY 50 is stood in for by the NAV of a NIFTY 50
	// index fund — which is also what an investor could really have earned,
	// dividends included, costs taken off. Gold likewise by a gold fund's NAV.
	const benchmarks = [
		["nifty50", "index", "NIFTY 50", "NIFTY50", "100822"],
		["gold", "commodity", "Gold", "GOLD", "114616"],
	] as const;
	for (const [slug, kind, name, symbol, amfiCode] of benchmarks)
		await db.adapter.query(
			`INSERT INTO "instruments" ("id", "kind", "symbol_canonical", "name", "currency", "amfi_code", "slug", "price_source") ` +
				`VALUES ('${ulid()}', '${kind}', '${symbol}', '${name}', 'INR', '${amfiCode}', '${slug}', 'amfi')`,
		);
});
