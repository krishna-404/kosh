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
 * A row's meaning never changes and no row is deleted: ending one stamps
 * `revokedAt` + `endReason`, and a level change, an accepted invite or a
 * re-sent invite is an ended row plus a new one pointing back at it
 * (`supersedesGrantId`) — so the table is its own history. Live rows are
 * `revoked_at IS NULL`. Only bookkeeping stamps are ever written to a live
 * row: `seenAt`, `endSeenAt`, and an owner's confirmation.
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
			/** Why the row stopped being live (set together with `revokedAt`). */
			endReason: t.grantEndReasonEnum().nullable(),
			/** The row this one replaced: a level change, an accepted or re-sent invite. */
			supersedesGrantId: t.ulid().nullable(),
			/** An invite nobody has accepted stops working at this moment. */
			expiresAt: t.timestampNumber().nullable(),
			/** The unguessable handle carried by the invite link. */
			inviteToken: t.string(64).nullable(),
			/**
			 * An Owner invite that was accepted counts as View until an existing
			 * owner confirms it — a mistyped address must not hand over an account.
			 */
			needsConfirmation: t.boolean().default(false),
			confirmedAt: t.timestampNumber().nullable(),
			/** The grantee has been shown that they gained / lost this access. */
			seenAt: t.timestampNumber().nullable(),
			endSeenAt: t.timestampNumber().nullable(),

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
