import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * What a fund manager or adviser charges for an account, when it is paid
 * from outside the account. (A fee the broker debits inside the account is
 * already in the ledger as a charge and needs nothing here.) One live row
 * per account; changing it ends the old row and starts a new one.
 */
export class FeeArrangementTable extends BaseTable {
	readonly table = "fee_arrangements";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			accountId: t.ulid().foreignKey("broker_accounts", "id", { onUpdate: "RESTRICT", onDelete: "RESTRICT" }),
			kind: t.string(20),
			payee: t.string(120).nullable(),
			rate: t.decimal(9, 6).nullable(),
			amountPerYear: t.decimal(20, 2).nullable(),
			hurdleRate: t.decimal(9, 6).nullable(),
			startsOn: t.date(),
			endsOn: t.date().nullable(),
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
