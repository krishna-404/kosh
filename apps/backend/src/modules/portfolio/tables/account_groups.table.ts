import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * Saved, ad-hoc, overlapping selections of broker accounts (e.g. "Dad+Mom",
 * "equity only"). "Everything" is a virtual group (all accounts the user can see), not a
 * row here. See docs/kosh/02-domain-model.md §1.
 */
export class AccountGroupTable extends BaseTable {
	readonly table = "account_groups";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			// Whose saved view this is. Groups are personal: each user builds
			// their own from the accounts they can see.
			userId: t.uuid().foreignKey("users", "id", {
				onUpdate: "RESTRICT",
				onDelete: "CASCADE",
			}),
			name: t.string(),
			/** An optional label (family, fund manager…). It shares nothing. */
			kind: t.groupKindEnum().nullable(),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["userId"])],
	);

	// Default access scope: a user sees only their own saved groups.
	// Bypass with `.unscope('default')` only for code that has done its own check.
	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ userId: ctx.userId }) : q;
		},
	});
}
