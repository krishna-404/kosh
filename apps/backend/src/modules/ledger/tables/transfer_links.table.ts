import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * "The money that left this account and the money that arrived in that one
 * are the same money." An overlay on two external cash flows — neither flow
 * is rewritten. A selection that contains both accounts leaves the pair out
 * of its returns (the money never left the family); a selection with only
 * one of them still counts that leg as money in or out
 * (docs/kosh/03-metrics-spec.md §1).
 *
 * `same: false` records that two look-alike flows were checked and are not a
 * transfer, so the question is not asked again.
 *
 * A link is in force only while it is live and both of its flows are live.
 * Visible to someone who can see either account.
 */
export class TransferLinkTable extends BaseTable {
	readonly table = "transfer_links";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			outFlowId: t.ulid().foreignKey("cash_flows", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			inFlowId: t.ulid().foreignKey("cash_flows", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			outAccountId: t.ulid().foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			inAccountId: t.ulid().foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			same: t.boolean(),
			decidedByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			isLive: t.boolean().default(true),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["outFlowId"]), t.index(["inFlowId"])],
	);

	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			if (!ctx) return q;
			const ids = [...ctx.accountIds];
			return q.where({ OR: [{ outAccountId: { in: ids } }, { inAccountId: { in: ids } }] });
		},
	});
}
