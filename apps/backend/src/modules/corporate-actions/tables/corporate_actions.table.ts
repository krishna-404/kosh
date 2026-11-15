import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * What happened to a share on a day: a split, a bonus, a dividend.
 *
 * Rows from the exchange (`source: "nse"`, `accountId` null) are market
 * facts, the same for everyone. A row a person recorded (`source: "user"`)
 * belongs to one account and is seen only by people who can see that
 * account — one family's reading of a statement never changes another's
 * holdings.
 *
 * `quantityFactor` is how many shares one share becomes (2 for a 1:1 bonus,
 * 10 for a ₹10 → ₹1 split). It is null when the exchange's wording could not
 * be read with certainty; then nothing is applied until someone says.
 * The row itself is never edited.
 */
export class CorporateActionTable extends BaseTable {
	readonly table = "corporate_actions";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			instrumentId: t.ulid().foreignKey("instruments", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			/** `bonus`, `split`, `dividend`, `rights`, `buyback`, `demerger`, `merger`… */
			actionType: t.string(20),
			exDate: t.date(),
			recordDate: t.date().nullable(),
			quantityFactor: t.decimal(24, 12).nullable(),
			amountPerShare: t.decimal(20, 4).nullable(),
			/** The exchange's own words. */
			rawText: t.text(),
			confidence: t.string(8),
			source: t.string(8),
			accountId: t
				.ulid()
				.foreignKey("broker_accounts", "id", { onUpdate: "RESTRICT", onDelete: "CASCADE" })
				.nullable(),
			createdByUserId: t
				.uuid()
				.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
				.nullable(),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["instrumentId", "exDate"])],
	);

	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx
				? q.where({ OR: [{ accountId: null }, { accountId: { in: [...ctx.accountIds] } }] })
				: q;
		},
	});
}
