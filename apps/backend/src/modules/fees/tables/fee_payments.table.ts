import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/** A fee actually paid to a manager from outside the account — for arrangements billed by invoice. */
export class FeePaymentTable extends BaseTable {
	readonly table = "fee_payments";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			accountId: t.ulid().foreignKey("broker_accounts", "id", { onUpdate: "RESTRICT", onDelete: "RESTRICT" }),
			paidOn: t.date(),
			amount: t.decimal(20, 2),
			note: t.string(200).nullable(),
			createdByUserId: t.uuid().foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" }).nullable(),
			isLive: t.boolean().default(true),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["accountId", "isLive"])],
	);

	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ accountId: { in: [...ctx.accountIds] } }) : q;
		},
	});
}
