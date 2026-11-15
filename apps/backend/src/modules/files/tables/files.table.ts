import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

export class FileTable extends BaseTable {
	readonly table = "files";

	columns = this.setColumns(
		(t) => ({
			id: t.ulid().primaryKey(),
			tableName: t.fileTableNameEnum(),
			tableId: t.string(),
			type: t.fileTypeEnum(),

			fileName: t.string(),
			mimeType: t.string(),
			cdnUrl: t.string().nullable(),
			thumbnailCdnUrl: t.string().nullable(),
			isMainFileLost: t.boolean().default(false),

			createdByUserId: t.uuid().foreignKey("users", "id", {
				onDelete: "CASCADE",
				onUpdate: "RESTRICT",
			}),
			deletedAt: t.timestampNumber().nullable(),

			...t.timestampsAsNumbers(),
		}),
		(t) => [
			t.index(["createdByUserId"]),
			// Look-up index for the parent-scoped fetch pattern
			// (files.getByTableId).
			t.index(["tableName", "tableId"]),
		],
	);

	// Default scope: a file is visible to the user who uploaded it. Bypass
	// with `.unscope('default')` only for code that has done its own check.
	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ createdByUserId: ctx.userId }) : q;
		},
	});

	// Disable soft delete during non-E2E tests to avoid SQL syntax errors when using onConflictDoNothing()
	readonly softDelete = true;
}
