import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * One row per (person, broker) trading/demat account. The unit every import
 * batch, raw row, trade and cash flow hangs off. An account belongs to
 * exactly one person; account_groups model arbitrary overlapping subsets.
 * See docs/kosh/02-domain-model.md §1.
 */
export class BrokerAccountTable extends BaseTable {
	readonly table = "broker_accounts";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			// RESTRICT: a person with accounts cannot be removed — the ledger
			// hanging off the account must not lose its subject.
			personId: t.ulid().foreignKey("persons", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			broker: t.brokerEnum(),
			/** The broker's own name when it is not one Kosh knows. */
			brokerName: t.string(60).nullable(),
			label: t.string(),
			createdByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			baseCurrency: t.string(3).default("INR"),
			// 'file_drop' | 'api' — 'api' reserved for a later phase.
			// TODO(kosh): promote to enum (missing from zod-schemas/enums.zod).
			connectionMethod: t.string(20).default("file_drop"),
			openedAt: t.date().nullable(),
			closedAt: t.date().nullable(),
			/** Goes up with every upload, undo and answer: what is derived from the ledger is stale below it. */
			ledgerVersion: t.integer().default(0),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["personId"])],
	);

	// Default access scope: only accounts the caller has a level on.
	// Bypass with `.unscope('default')` only for code that has done its own check.
	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ id: { in: [...ctx.accountIds] } }) : q;
		},
	});
}
