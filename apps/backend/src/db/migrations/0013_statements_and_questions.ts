import { change } from "../db_script";

// Phase 3 of the build plan: statements in, ledger out.
//
//  import_files        every uploaded statement, verbatim, next to its batch —
//                      so each raw row traces to the exact bytes it came from.
//  import_batches      which file, which broker, what dates it covers, and the
//                      file-level facts (opening/closing balance).
//  raw_ledger_lines    line_no: the line's place in its file, so lines posted
//                      on the same day keep their order.
//  raw_holdings_snapshots, trades, cash_flows
//                      is_live: false once the batch or answer that produced
//                      the row is undone. Rows are never deleted; reads take
//                      live rows only.
//  cash_flows.origin   a broker ledger line, or the balance the account
//                      already held before the first line Kosh has.
//  transfer_links      "this money leaving one account and that money arriving
//                      in another are the same money" — an overlay on two
//                      external flows, never a rewrite of either.

change(async (db) => {
	await db.createTable(
		"import_files",
		(t) => ({
			id: t.string(26).primaryKey(),
			accountId: t.string(26).foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			fileName: t.string(255),
			sizeBytes: t.integer(),
			sha256: t.string(64),
			content: t.bytea(),
			uploadedByUserId: t.uuid().foreignKey("users", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["accountId", "sha256"])],
	);

	await db.changeTable("import_batches", (t) => ({
		importFileId: t.add(
			t
				.string(26)
				.foreignKey("import_files", "id", { onUpdate: "RESTRICT", onDelete: "RESTRICT" })
				.nullable(),
		),
		fileName: t.add(t.string(255).nullable()),
		broker: t.add(t.string(20).nullable()),
		spanFrom: t.add(t.date().nullable()),
		spanTo: t.add(t.date().nullable()),
		meta: t.add(t.json().nullable()),
	}));

	await db.changeTable("raw_ledger_lines", (t) => ({
		lineNo: t.add(t.integer().default(0)),
	}));
	await db.changeTable("raw_holdings_snapshots", (t) => ({
		isLive: t.add(t.boolean().default(true)),
	}));
	await db.changeTable("trades", (t) => ({
		isLive: t.add(t.boolean().default(true)),
	}));
	await db.changeTable("cash_flows", (t) => ({
		isLive: t.add(t.boolean().default(true)),
		origin: t.add(t.string(24).default("ledger_line")),
	}));

	await db.createTable(
		"transfer_links",
		(t) => ({
			id: t.string(26).primaryKey(),
			outFlowId: t.string(26).foreignKey("cash_flows", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			inFlowId: t.string(26).foreignKey("cash_flows", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			outAccountId: t.string(26).foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			inAccountId: t.string(26).foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			/** true: the same money · false: looked alike, but someone said no. */
			same: t.boolean(),
			decidedByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			isLive: t.boolean().default(true),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [t.index(["outFlowId"]), t.index(["inFlowId"])],
	);
});

change(async (db, up) => {
	if (!up) return;
	// Rows produced by events that were later superseded are not live.
	await db.adapter.query(
		`UPDATE "trades" t SET "is_live" = false FROM "events" e ` +
			`WHERE e."id" = t."recognized_event_id" AND e."superseded_by_event_id" IS NOT NULL`,
	);
	await db.adapter.query(
		`UPDATE "cash_flows" c SET "is_live" = false FROM "events" e ` +
			`WHERE e."id" = c."classified_event_id" AND e."superseded_by_event_id" IS NOT NULL`,
	);
	await db.adapter.query(
		`UPDATE "raw_holdings_snapshots" h SET "is_live" = false FROM "import_batches" b ` +
			`WHERE b."id" = h."batch_id" AND b."status" = 'retracted'`,
	);
	await db.adapter.query(
		`UPDATE "raw_ledger_lines" SET "line_no" = COALESCE(("raw_row"->>'row')::int, 0)`,
	);
	await db.adapter.query(
		`CREATE INDEX "cash_flows_live_idx" ON "cash_flows" ("account_id", "flow_date") WHERE "is_live"`,
	);
	await db.adapter.query(
		`CREATE INDEX "trades_live_idx" ON "trades" ("account_id", "trade_date") WHERE "is_live"`,
	);
	await db.adapter.query(
		`CREATE INDEX "cash_flows_source_line_idx" ON "cash_flows" ("source_ledger_line_id") WHERE "is_live"`,
	);
});
