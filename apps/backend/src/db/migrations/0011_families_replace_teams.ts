import { ulid } from "ulid";
import { change } from "../db_script";

// Kosh has no workspaces: a login belongs to exactly one household, and the
// household is the tenant. This replaces the boilerplate's teams_app /
// team_members (multi-team membership, roles, active-team switching) with a
// plain `families` row linked from `users.family_id`.
//
// Data is preserved without rewriting a single portfolio row: every team
// becomes a family UNDER THE SAME ID, so the `family_id` already stamped on
// the ledger tables stays valid — only the foreign keys are re-pointed.
//
// Forward-only (like 0008): the raw statements below have no automatic
// reverse, and team memberships/roles are dropped for good.

const FAMILY_SCOPED_TABLES = [
	"persons",
	"broker_accounts",
	"account_groups",
	"account_group_members",
	"events",
	"import_batches",
	"raw_trades",
	"raw_ledger_lines",
	"raw_holdings_snapshots",
	"trades",
	"trade_charge_units",
	"cash_flows",
] as const;

change(async (db) => {
	await db.createTable("families", (t) => ({
		id: t.string(26).primaryKey(),
		name: t.string(),
		createdAt: t.timestamps().createdAt,
		updatedAt: t.timestamps().updatedAt,
	}));

	// Every team (soft-deleted ones included, so no ledger row is orphaned)
	// becomes a family with the same id.
	await db.adapter.query(
		`INSERT INTO "families" ("id", "name", "created_at", "updated_at") ` +
			`SELECT "id", "name", "created_at", "updated_at" FROM "teams_app"`,
	);

	await db.changeTable("users", (t) => ({
		familyId: t.add(
			t
				.string(26)
				.foreignKey("families", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
		),
	}));

	// A user's family is the team they had active — that is where anything
	// they imported was stamped — falling back to their personal team.
	await db.adapter.query(
		`UPDATE "users" SET "family_id" = "active_team_app_id" ` +
			`WHERE "active_team_app_id" IS NOT NULL`,
	);
	await db.adapter.query(
		`UPDATE "users" u SET "family_id" = t."id" FROM "teams_app" t ` +
			`WHERE u."family_id" IS NULL AND t."personal_team_for_user_id" = u."id" ` +
			`AND t."deleted_at" IS NULL`,
	);
	// Anyone left has no team at all: mint a family for them.
	const orphans = await db.adapter.query<{ id: string; name: string }>(
		`SELECT "id", "name" FROM "users" WHERE "family_id" IS NULL`,
	);
	for (const user of orphans.rows) {
		const familyId = ulid();
		const firstName = user.name.trim().split(/\s+/)[0];
		await db.adapter.query(
			`INSERT INTO "families" ("id", "name") VALUES ($1, $2)`,
			[familyId, firstName ? `${firstName}'s family` : "My family"],
		);
		await db.adapter.query(
			`UPDATE "users" SET "family_id" = $1 WHERE "id" = $2`,
			[familyId, user.id],
		);
	}

	await db.adapter.query(`ALTER TABLE "users" DROP COLUMN "active_team_app_id"`);

	// Re-point every ledger table's tenant FK from teams_app to families.
	for (const table of FAMILY_SCOPED_TABLES) {
		await db.adapter.query(
			`ALTER TABLE "${table}" DROP CONSTRAINT "${table}_family_id_fkey"`,
		);
		await db.adapter.query(
			`ALTER TABLE "${table}" ADD CONSTRAINT "${table}_family_id_fkey" ` +
				`FOREIGN KEY ("family_id") REFERENCES "families" ("id") ` +
				`ON UPDATE RESTRICT ON DELETE CASCADE`,
		);
	}

	// files: team_id → family_id. The old index only drove sync cursors.
	await db.adapter.query(`DROP INDEX IF EXISTS "files_sync_delta_idx"`);
	await db.adapter.query(
		`ALTER TABLE "files" DROP CONSTRAINT "files_team_id_fkey"`,
	);
	await db.adapter.query(
		`ALTER TABLE "files" RENAME COLUMN "team_id" TO "family_id"`,
	);
	await db.adapter.query(
		`ALTER TABLE "files" ADD CONSTRAINT "files_family_id_fkey" ` +
			`FOREIGN KEY ("family_id") REFERENCES "families" ("id") ` +
			`ON UPDATE RESTRICT ON DELETE CASCADE`,
	);
	await db.adapter.query(
		`CREATE INDEX "files_family_id_idx" ON "files" ("family_id")`,
	);

	await db.adapter.query(`DROP TABLE "team_members"`);
	await db.adapter.query(`DROP TABLE "teams_app"`);
	await db.adapter.query(`DROP TYPE "team_member_role_enum"`);
});
