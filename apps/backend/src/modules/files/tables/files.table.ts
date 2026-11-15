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
			// Auto-stamped from AsyncLocalStorage on insert.
			familyId: t
				.ulid()
				.foreignKey("families", "id", {
					onDelete: "CASCADE",
					onUpdate: "RESTRICT",
				})
				.nullable()
				.setOnCreate(() => getRequestContext()?.familyId ?? null),
			deletedAt: t.timestampNumber().nullable(),

			...t.timestampsAsNumbers(),
		}),
		(t) => [
			t.index(["familyId"]),
			// Look-up index for the parent-scoped fetch pattern
			// (files.getByTableId).
			t.index(["tableName", "tableId"]),
		],
	);

	// Default tenant scope. Bypass with `.unscope('default')` where a
	// cross-tenant read is genuinely required.
	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ familyId: ctx.familyId }) : q;
		},
	});

	// Disable soft delete during non-E2E tests to avoid SQL syntax errors when using onConflictDoNothing()
	readonly softDelete = true;
}
