import {
	GRANT_END_REASON_ENUM,
	GROUP_KIND_ENUM,
	HOLDER_KIND_ENUM,
} from "@connected-repo/zod-schemas/enums.zod";
import { change } from "../db_script";

// Phase 2 of the build plan: what the people-and-sharing screens need on top
// of the access model.
//
//  persons          kind (login / no login / HUF) and an optional link to the
//                   login the holder *is* ("This is me").
//  broker_accounts  the broker's own name when it is not one Kosh knows, and
//                   who added the account (for Activity).
//  account_groups   an optional kind — a label, never a permission.
//  access_grants    the life of an invite and of a grant:
//                     expires_at            an unaccepted invite runs out (14 days)
//                     invite_token          the unguessable handle in the invite link
//                     end_reason            why a row stopped being live
//                     supersedes_grant_id   the row this one replaced
//                     needs_confirmation    an accepted Owner invite waits for an owner's nod
//                     confirmed_at          when it got one
//                     seen_at / end_seen_at the grantee has been told (once) that
//                                           they gained / lost this access

change(async (db) => {
	await db.createEnum("holder_kind_enum", [...HOLDER_KIND_ENUM]);
	await db.createEnum("group_kind_enum", [...GROUP_KIND_ENUM]);
	await db.createEnum("grant_end_reason_enum", [...GRANT_END_REASON_ENUM]);

	await db.changeTable("persons", (t) => ({
		kind: t.add(t.enum("holder_kind_enum").default("login")),
		linkedUserId: t.add(
			t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
		),
	}));

	await db.changeTable("broker_accounts", (t) => ({
		brokerName: t.add(t.string(60).nullable()),
		createdByUserId: t.add(
			t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
		),
	}));

	await db.changeTable("account_groups", (t) => ({
		kind: t.add(t.enum("group_kind_enum").nullable()),
	}));

	await db.changeTable("access_grants", (t) => ({
		expiresAt: t.add(t.timestamp().nullable()),
		inviteToken: t.add(t.string(64).nullable()),
		endReason: t.add(t.enum("grant_end_reason_enum").nullable()),
		supersedesGrantId: t.add(t.string(26).nullable()),
		needsConfirmation: t.add(t.boolean().default(false)),
		confirmedAt: t.add(t.timestamp().nullable()),
		seenAt: t.add(t.timestamp().nullable()),
		endSeenAt: t.add(t.timestamp().nullable()),
	}));
});

change(async (db, up) => {
	if (!up) return;

	// Rows already ended before reasons existed were removals.
	await db.adapter.query(
		`UPDATE "access_grants" SET "end_reason" = 'removed' WHERE "revoked_at" IS NOT NULL`,
	);
	// Nothing that exists today is news to its grantee.
	await db.adapter.query(
		`UPDATE "access_grants" SET "seen_at" = now(), ` +
			`"end_seen_at" = CASE WHEN "revoked_at" IS NOT NULL THEN now() END`,
	);
	// Invites already waiting get the full 14 days from now.
	await db.adapter.query(
		`UPDATE "access_grants" SET "expires_at" = now() + interval '14 days' ` +
			`WHERE "revoked_at" IS NULL AND "invited_email" IS NOT NULL`,
	);
	await db.adapter.query(
		`CREATE UNIQUE INDEX "access_grants_invite_token_idx" ON "access_grants" ("invite_token") ` +
			`WHERE "invite_token" IS NOT NULL`,
	);
});
