import { BaseTable } from "@backend/db/base_table";

/**
 * Who may do what — the ONLY place access lives.
 *
 * One row gives one user a level (`view` < `edit` < `owner`) on one target:
 *   - an account (`accountId`), or
 *   - a holder (`personId`): every account that holder has, including ones
 *     added later.
 * A user's effective level on an account is the higher of the two.
 *
 * The grantee is a user (`userId`) or, until they sign in, an invited email
 * (`invitedEmail`, lower-cased). An invite counts only for a login whose
 * email is verified.
 *
 * Rows are never updated or deleted: revoking stamps `revokedAt`, and a level
 * change is a revoke plus a new row, so the table is its own history. Live
 * rows are `revoked_at IS NULL`.
 *
 * No default scope — every read goes through access.portfolio.service.ts,
 * which checks the caller first.
 * See docs/kosh/02-domain-model.md §1.
 */
export class AccessGrantTable extends BaseTable {
	readonly table = "access_grants";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			// Exactly one of personId / accountId (CHECK in migration 0011).
			personId: t
				.ulid()
				.foreignKey("persons", "id", {
					onUpdate: "RESTRICT",
					onDelete: "CASCADE",
				})
				.nullable(),
			accountId: t
				.ulid()
				.foreignKey("broker_accounts", "id", {
					onUpdate: "RESTRICT",
					onDelete: "CASCADE",
				})
				.nullable(),
			// Exactly one of userId / invitedEmail (CHECK in migration 0011).
			// RESTRICT: deleting a login must not silently orphan what it owns.
			userId: t
				.uuid()
				.foreignKey("users", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
			invitedEmail: t.string(320).nullable(),
			level: t.accessLevelEnum(),
			grantedByUserId: t
				.uuid()
				.foreignKey("users", "id", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),
			revokedAt: t.timestampNumber().nullable(),
			revokedByUserId: t
				.uuid()
				.foreignKey("users", "id", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),

			...t.timestampsAsNumbers(),
		}),
		(t) => [
			t.index(["userId"]),
			t.index(["invitedEmail"]),
			t.index(["personId"]),
			t.index(["accountId"]),
		],
	);
}
