import { ACCESS_LEVEL_ENUM } from "@connected-repo/zod-schemas/enums.zod";
import { ulid } from "ulid";
import { change } from "../db_script";

// Kosh has no workspaces and no tenant column. The broker account is the unit
// of access: `access_grants` gives a user a level (view / edit / owner) on one
// account, or on a holder (= all of that holder's accounts, present and
// future). This replaces the boilerplate's teams_app / team_members and the
// `family_id` (→ teams_app) stamped on every ledger table.
//
// Nobody loses access: each team member becomes a grant on every holder of
// that team — Owner/Admin → owner, Member → edit (a member could already do
// everything an editor can), and invites that were still pending stay pending.
//
// Forward-only (like 0008): the raw statements below have no automatic
// reverse.

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
	await db.createEnum("access_level_enum", [...ACCESS_LEVEL_ENUM]);

	await db.createTable(
		"access_grants",
		(t) => ({
			id: t.string(26).primaryKey(),
			personId: t
				.string(26)
				.foreignKey("persons", "id", {
					onUpdate: "RESTRICT",
					onDelete: "CASCADE",
				})
				.nullable(),
			accountId: t
				.string(26)
				.foreignKey("broker_accounts", "id", {
					onUpdate: "RESTRICT",
					onDelete: "CASCADE",
				})
				.nullable(),
			userId: t
				.uuid()
				.foreignKey("users", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
			invitedEmail: t.string(320).nullable(),
			level: t.enum("access_level_enum"),
			grantedByUserId: t
				.uuid()
				.foreignKey("users", "id", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),
			revokedAt: t.timestamp().nullable(),
			revokedByUserId: t
				.uuid()
				.foreignKey("users", "id", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),
			createdAt: t.timestamps().createdAt,
			updatedAt: t.timestamps().updatedAt,
		}),
		(t) => [
			t.index(["userId"]),
			t.index(["invitedEmail"]),
			t.index(["personId"]),
			t.index(["accountId"]),
		],
	);
	// One target and one grantee per row.
	await db.adapter.query(
		`ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_one_target_check" ` +
			`CHECK (num_nonnulls("person_id", "account_id") = 1)`,
	);
	await db.adapter.query(
		`ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_one_grantee_check" ` +
			`CHECK (num_nonnulls("user_id", "invited_email") = 1)`,
	);
	// At most one LIVE grant per (target, grantee). Revoked rows are history.
	for (const [target, grantee] of [
		["person_id", "user_id"],
		["person_id", "invited_email"],
		["account_id", "user_id"],
		["account_id", "invited_email"],
	] as const) {
		await db.adapter.query(
			`CREATE UNIQUE INDEX "access_grants_live_${target}_${grantee}_idx" ` +
				`ON "access_grants" ("${target}", "${grantee}") ` +
				`WHERE "revoked_at" IS NULL AND "${target}" IS NOT NULL AND "${grantee}" IS NOT NULL`,
		);
	}

	// ── Team memberships → grants on every holder of that team ─────────────
	const memberships = await db.adapter.query<{
		person_id: string;
		user_id: string | null;
		email: string | null;
		role: string;
		created_by_user_id: string;
	}>(
		`SELECT p."id" AS person_id, m."user_id", lower(m."email") AS email, m."role", t."created_by_user_id" ` +
			`FROM "persons" p ` +
			`JOIN "teams_app" t ON t."id" = p."family_id" ` +
			`JOIN "team_members" m ON m."team_id" = t."id" AND m."deleted_at" IS NULL ` +
			`WHERE m."user_id" IS NOT NULL OR m."email" IS NOT NULL`,
	);
	for (const m of memberships.rows) {
		await db.adapter.query(
			`INSERT INTO "access_grants" ("id", "person_id", "user_id", "invited_email", "level", "granted_by_user_id") ` +
				`VALUES ($1, $2, $3, $4, $5, $6)`,
			[
				ulid(),
				m.person_id,
				m.user_id,
				m.user_id ? null : m.email,
				m.role === "Owner" || m.role === "Admin" ? "owner" : "edit",
				m.created_by_user_id,
			],
		);
	}
	// Every holder must end up with an owner who can sign in; fall back to
	// whoever created the team.
	const ownerless = await db.adapter.query<{
		person_id: string;
		created_by_user_id: string;
	}>(
		`SELECT p."id" AS person_id, t."created_by_user_id" FROM "persons" p ` +
			`JOIN "teams_app" t ON t."id" = p."family_id" ` +
			`WHERE NOT EXISTS (SELECT 1 FROM "access_grants" g WHERE g."person_id" = p."id" ` +
			`AND g."level" = 'owner' AND g."user_id" IS NOT NULL)`,
	);
	for (const row of ownerless.rows) {
		// The creator may already hold a lower grant on this holder; replace it.
		await db.adapter.query(
			`DELETE FROM "access_grants" WHERE "person_id" = $1 AND "user_id" = $2`,
			[row.person_id, row.created_by_user_id],
		);
		await db.adapter.query(
			`INSERT INTO "access_grants" ("id", "person_id", "user_id", "level", "granted_by_user_id") ` +
				`VALUES ($1, $2, $3, 'owner', $3)`,
			[ulid(), row.person_id, row.created_by_user_id],
		);
	}

	// ── Saved groups become personal: they go to the team's creator ───────
	await db.adapter.query(
		`ALTER TABLE "account_groups" ADD COLUMN "user_id" uuid ` +
			`REFERENCES "users" ("id") ON UPDATE RESTRICT ON DELETE CASCADE`,
	);
	await db.adapter.query(
		`UPDATE "account_groups" g SET "user_id" = t."created_by_user_id" ` +
			`FROM "teams_app" t WHERE t."id" = g."family_id"`,
	);
	await db.adapter.query(
		`ALTER TABLE "account_groups" ALTER COLUMN "user_id" SET NOT NULL`,
	);
	await db.adapter.query(
		`CREATE INDEX "account_groups_user_id_idx" ON "account_groups" ("user_id")`,
	);

	// ── Events and charge units carry their account, for access scoping ───
	await db.adapter.query(
		`ALTER TABLE "events" ADD COLUMN "account_id" varchar(26) ` +
			`REFERENCES "broker_accounts" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT`,
	);
	// Every event so far was written by the import pipeline and names its batch.
	await db.adapter.query(
		`UPDATE "events" e SET "account_id" = b."account_id" ` +
			`FROM "import_batches" b WHERE b."id" = e."payload"->>'batchId'`,
	);
	await db.adapter.query(
		`ALTER TABLE "trade_charge_units" ADD COLUMN "account_id" varchar(26) ` +
			`REFERENCES "broker_accounts" ("id") ON UPDATE RESTRICT ON DELETE RESTRICT`,
	);
	await db.adapter.query(
		`UPDATE "trade_charge_units" u SET "account_id" = t."account_id" ` +
			`FROM "trades" t WHERE t."id" = u."trade_id"`,
	);
	await db.adapter.query(
		`ALTER TABLE "trade_charge_units" ALTER COLUMN "account_id" SET NOT NULL`,
	);

	// ── The tenant column goes (its indexes go with it) ────────────────────
	for (const table of FAMILY_SCOPED_TABLES) {
		await db.adapter.query(`ALTER TABLE "${table}" DROP COLUMN "family_id"`);
	}
	await db.adapter.query(
		`CREATE INDEX "broker_accounts_person_id_idx" ON "broker_accounts" ("person_id")`,
	);
	await db.adapter.query(
		`CREATE INDEX "events_account_id_kind_idx" ON "events" ("account_id", "kind")`,
	);
	await db.adapter.query(
		`CREATE INDEX "events_account_id_occurred_at_idx" ON "events" ("account_id", "occurred_at")`,
	);
	await db.adapter.query(
		`CREATE INDEX "import_batches_account_id_idx" ON "import_batches" ("account_id")`,
	);
	await db.adapter.query(
		`CREATE INDEX "cash_flows_account_id_classification_flow_date_idx" ` +
			`ON "cash_flows" ("account_id", "classification", "flow_date")`,
	);

	// ── files belong to whoever uploaded them ──────────────────────────────
	await db.adapter.query(`ALTER TABLE "files" DROP COLUMN "team_id"`);
	await db.adapter.query(
		`CREATE INDEX "files_created_by_user_id_idx" ON "files" ("created_by_user_id")`,
	);

	// ── Teams go ───────────────────────────────────────────────────────────
	await db.adapter.query(
		`ALTER TABLE "users" DROP COLUMN "active_team_app_id"`,
	);
	await db.adapter.query(`DROP TABLE "team_members"`);
	await db.adapter.query(`DROP TABLE "teams_app"`);
	await db.adapter.query(`DROP TYPE "team_member_role_enum"`);
});
