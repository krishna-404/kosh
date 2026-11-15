import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * Every uploaded statement, kept exactly as it arrived — the bytes each raw
 * row came from. Stored in Postgres beside its batch (not in object storage)
 * so the trail from a number back to its file needs nothing else running.
 * Statements are sensitive financial documents: the database is expected to
 * be encrypted at rest.
 */
export class ImportFileTable extends BaseTable {
	readonly table = "import_files";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			accountId: t.ulid().foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			fileName: t.string(255),
			sizeBytes: t.integer(),
			sha256: t.string(64),
			content: t.bytea(),
			uploadedByUserId: t.uuid().foreignKey("users", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),

			...t.timestampsAsNumbers(),
		}),
		(t) => [t.index(["accountId", "sha256"])],
	);

	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ accountId: { in: [...ctx.accountIds] } }) : q;
		},
	});
}
