import { change } from "../db_script";

// Phase 5 of the build plan: splits and bonuses.
//
//  corporate_actions              what happened to a share: a market fact from
//                                 the exchange's announcements, or — when the
//                                 exchange's feed misses one — something a
//                                 person recorded for one account.
//  corporate_action_applications  what was done about it on each account that
//                                 held the share: applied (the holding changed
//                                 from the ex-date), or declined. Undoing one
//                                 marks it not live; nothing is deleted.

change(async (db) => {
	await db.createTable(
		"corporate_actions",
		(t) => ({
			id: t.string(26).primaryKey(),
			instrumentId: t.string(26).foreignKey("instruments", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			actionType: t.string(20),
			exDate: t.date(),
			recordDate: t.date().nullable(),
			/** How many shares one share becomes; null when the wording gave no ratio. */
			quantityFactor: t.decimal(24, 12).nullable(),
			amountPerShare: t.decimal(20, 4).nullable(),
			rawText: t.text(),
			confidence: t.string(8),
			source: t.string(8),
			/** Set for an action a person recorded: it is theirs, for this account only. */
			accountId: t
				.string(26)
				.foreignKey("broker_accounts", "id", { onUpdate: "RESTRICT", onDelete: "CASCADE" })
				.nullable(),
			createdByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["instrumentId", "exDate"])],
	);

	await db.createTable(
		"corporate_action_applications",
		(t) => ({
			id: t.string(26).primaryKey(),
			corporateActionId: t.string(26).foreignKey("corporate_actions", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			accountId: t.string(26).foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			instrumentId: t.string(26).foreignKey("instruments", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			exDate: t.date(),
			state: t.string(12),
			factor: t.decimal(24, 12),
			quantityBefore: t.decimal(20, 8),
			quantityAfter: t.decimal(20, 8),
			eventId: t.string(26).foreignKey("events", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			decidedByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			isLive: t.boolean().default(true),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["accountId", "isLive"]), t.index(["corporateActionId", "accountId"])],
	);
});

change(async (db, up) => {
	if (!up) return;
	// The exchange announces each action once; the same announcement fetched
	// again is the same row.
	await db.adapter.query(
		`CREATE UNIQUE INDEX "corporate_actions_exchange_idx" ON "corporate_actions" ` +
			`("instrument_id", "ex_date", "action_type", md5("raw_text")) WHERE "source" = 'nse'`,
	);
	await db.adapter.query(
		`CREATE UNIQUE INDEX "corporate_action_applications_live_idx" ON "corporate_action_applications" ` +
			`("corporate_action_id", "account_id") WHERE "is_live"`,
	);
});
