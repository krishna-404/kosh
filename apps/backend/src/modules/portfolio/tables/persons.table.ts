import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * A holder: whose money an account is — NOT a login (a child or an HUF never
 * signs in; logins live in `users`). Every broker account belongs to exactly
 * one holder, and a holder may have accounts at several brokers. Whoever adds
 * a holder gets an `owner` grant on it (access_grants).
 * See docs/kosh/02-domain-model.md §1.
 */
export class PersonTable extends BaseTable {
	readonly table = "persons";

	columns = this.setColumns((t) => ({
		id: t.ulidWithDefault().primaryKey(),
		displayName: t.string(),
		/** A person who signs in, a person without a login, or an HUF. */
		kind: t.holderKindEnum().default("login"),
		/** "This is me": the login this holder is, if anyone said so. */
		linkedUserId: t
			.uuid()
			.foreignKey("users", "id", { onUpdate: "RESTRICT", onDelete: "SET NULL" })
			.nullable(),

		...t.timestampsAsNumbers(),
	}));

	// Default access scope: only holders the caller has a grant on, or who hold an
	// account the caller can see.
	// Bypass with `.unscope('default')` only for code that has done its own check.
	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ id: { in: [...ctx.personIds] } }) : q;
		},
	});
}
