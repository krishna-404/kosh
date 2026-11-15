import { BaseTable } from "@backend/db/base_table";

/**
 * The household — the tenant every Kosh row belongs to (`family_id`). One is
 * created for each user at sign-up (`UserTable.afterCreate`) and linked via
 * `users.family_id`; there is no membership table, no switching and no
 * per-request header. A second login for the same household is a second
 * `users` row pointing at the same family.
 * See docs/kosh/02-domain-model.md §1.
 */
export class FamilyTable extends BaseTable {
	readonly table = "families";

	columns = this.setColumns((t) => ({
		id: t.ulidWithDefault().primaryKey(),
		name: t.string(),

		...t.timestampsAsNumbers(),
	}));
}
