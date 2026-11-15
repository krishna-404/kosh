import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * What was done about a corporate action on one account.
 *
 * `applied`: from the ex-date, the holding is `factor` times what it was.
 * `declined`: someone said it does not apply to this account.
 * A live row is the standing decision; undoing it marks it not live and the
 * action becomes a question again (it is never silently re-applied).
 * `decidedByUserId` null means Kosh applied it from the exchange's
 * announcement.
 */
export class CorporateActionApplicationTable extends BaseTable {
	readonly table = "corporate_action_applications";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			corporateActionId: t.ulid().foreignKey("corporate_actions", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			accountId: t.ulid().foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			instrumentId: t.ulid().foreignKey("instruments", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			exDate: t.date(),
			state: t.string(12),
			factor: t.decimal(24, 12),
			quantityBefore: t.quantity8(),
			quantityAfter: t.quantity8(),
			eventId: t.ulid().foreignKey("events", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			decidedByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			isLive: t.boolean().default(true),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["accountId", "isLive"]), t.index(["corporateActionId", "accountId"])],
	);

	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ accountId: { in: [...ctx.accountIds] } }) : q;
		},
	});
}
