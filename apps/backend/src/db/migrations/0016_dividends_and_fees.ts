import { change } from "../db_script";

// Phase 6 of the build plan: dividends and fees.
//
//  dividends         money a share paid its holder. In India it goes to the
//                    holder's bank, not the broker's ledger, so no statement
//                    line shows it: Kosh works out what was due from the
//                    exchange's announcement × the shares held on the
//                    ex-date, counts it from that day, and asks the person
//                    to confirm. A confirmed row carries what really arrived
//                    and when.
//  fee_arrangements  what a fund manager or adviser charges for an account,
//                    when that is paid from outside the account (so the
//                    ledger never sees it). Owners only.
//  fee_payments      fees actually paid, for arrangements billed by invoice.

change(async (db) => {
	await db.createTable(
		"dividends",
		(t) => ({
			id: t.string(26).primaryKey(),
			accountId: t.string(26).foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			instrumentId: t.string(26).foreignKey("instruments", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			/** The announcement it was worked out from; null for one a person entered. */
			corporateActionId: t
				.string(26)
				.foreignKey("corporate_actions", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			exDate: t.date(),
			/** The day it is counted on: the ex-date until someone says when it arrived. */
			receivedOn: t.date(),
			quantity: t.decimal(20, 8),
			amountPerShare: t.decimal(20, 4),
			/** Before any tax deducted at source. */
			amount: t.decimal(20, 2),
			/** expected | confirmed | not_received */
			state: t.string(14),
			source: t.string(8),
			decidedByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			isLive: t.boolean().default(true),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["accountId", "isLive"]), t.index(["instrumentId"])],
	);

	await db.createTable(
		"fee_arrangements",
		(t) => ({
			id: t.string(26).primaryKey(),
			accountId: t.string(26).foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			/** percent_of_assets | fixed | profit_share | invoiced */
			kind: t.string(20),
			/** Who is paid — "Ramesh Iyer", "Iyer Capital". */
			payee: t.string(120).nullable(),
			/** percent_of_assets: the yearly rate. profit_share: the share of profit. A fraction. */
			rate: t.decimal(9, 6).nullable(),
			/** fixed: rupees a year. */
			amountPerYear: t.decimal(20, 2).nullable(),
			/** profit_share: the yearly return the manager must beat before sharing. A fraction. */
			hurdleRate: t.decimal(9, 6).nullable(),
			startsOn: t.date(),
			endsOn: t.date().nullable(),
			createdByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			isLive: t.boolean().default(true),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["accountId", "isLive"])],
	);

	await db.createTable(
		"fee_payments",
		(t) => ({
			id: t.string(26).primaryKey(),
			accountId: t.string(26).foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			paidOn: t.date(),
			amount: t.decimal(20, 2),
			note: t.string(200).nullable(),
			createdByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			isLive: t.boolean().default(true),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["accountId", "isLive"])],
	);
});

change(async (db, up) => {
	if (!up) return;
	// One standing row per announcement and account.
	await db.adapter.query(
		`CREATE UNIQUE INDEX "dividends_announced_idx" ON "dividends" ("corporate_action_id", "account_id") ` +
			`WHERE "is_live" AND "corporate_action_id" IS NOT NULL`,
	);
});
