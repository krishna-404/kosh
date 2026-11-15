import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * Money a share paid its holder, per account.
 *
 * `expected`: worked out from the exchange's announcement × the shares held
 * on the ex-date; counted in the return from the ex-date, as the best guess.
 * `confirmed`: a person said what arrived and when. `not_received`: a person
 * said it never came; it is no longer counted. Nothing is deleted — a row
 * that stops applying (the trades it rested on were undone) is marked not live.
 */
export class DividendTable extends BaseTable {
	readonly table = "dividends";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			accountId: t.ulid().foreignKey("broker_accounts", "id", { onUpdate: "RESTRICT", onDelete: "RESTRICT" }),
			instrumentId: t.ulid().foreignKey("instruments", "id", { onUpdate: "RESTRICT", onDelete: "RESTRICT" }),
			corporateActionId: t
				.ulid()
				.foreignKey("corporate_actions", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),
			exDate: t.date(),
			receivedOn: t.date(),
			quantity: t.quantity8(),
			amountPerShare: t.decimal(20, 4),
			amount: t.decimal(20, 2),
			state: t.string(14),
			source: t.string(8),
			decidedByUserId: t.uuid().foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" }).nullable(),
			isLive: t.boolean().default(true),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["accountId", "isLive"]), t.index(["instrumentId"])],
	);

	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ accountId: { in: [...ctx.accountIds] } }) : q;
		},
	});
}
