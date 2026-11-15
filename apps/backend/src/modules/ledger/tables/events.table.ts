import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * The append-only Layer-2 spine: every ledger fact is an event. Rows are
 * never updated or deleted by convention — a RETRACTION is a new event
 * (kind='retraction', retractsEventId set) and the target gets
 * supersededByEventId stamped; live events read as
 * `WHERE superseded_by_event_id IS NULL`. `reason` is mandatory for
 * retractions — enforced at the service layer, not by the DB.
 * See docs/kosh/02-domain-model.md §4 and 01-architecture.md §3.
 */
export class EventTable extends BaseTable {
	readonly table = "events";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			// The account this fact is about. Every event the import pipeline
			// writes has one; it is what access is checked against.
			accountId: t
				.ulid()
				.foreignKey("broker_accounts", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
			kind: t.eventKindEnum(),
			payload: t.json<Record<string, unknown>>(),
			// 'system' | 'user' — a small backend-local pg enum
			// (event_actor_enum, declared in base_table.ts) rather than one from
			// zod-schemas, because it is server-stamped and never client input.
			actor: t.eventActorEnum(),
			userId: t
				.uuid()
				.foreignKey("users", "id", {
					onUpdate: "RESTRICT",
					onDelete: "SET NULL",
				})
				.nullable(),
			// Domain time (e.g. trade date, ex-date) — distinct from recordedAt.
			occurredAt: t.timestampNumber(),
			recordedAt: t.timestampNumber().default(t.sql`now()`),
			// Set iff kind='retraction': the event this one retracts.
			retractsEventId: t
				.ulid()
				.foreignKey("events", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
			// Set on the TARGET when retracted; live = IS NULL.
			supersededByEventId: t
				.ulid()
				.foreignKey("events", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
			// Mandatory for retractions (service-layer invariant).
			reason: t.text().nullable(),

			...t.timestampsAsNumbers(),
		}),
		(t) => [
			t.index(["accountId", "kind"]),
			t.index(["accountId", "occurredAt"]),
		],
	);

	// Default access scope: only rows of accounts the caller can see.
	// Bypass with `.unscope('default')` only for code that has done its own check.
	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ accountId: { in: [...ctx.accountIds] } }) : q;
		},
	});
}
