import { db } from "@backend/db/db";
import { rpcFamilyProcedure } from "@backend/procedures/protected.procedure";
import { fileTableNameZod } from "@connected-repo/zod-schemas/enums.zod";
import {
	fileCreateInputZod,
	fileSelectAllZod,
} from "@connected-repo/zod-schemas/file.zod";
import { z } from "zod";

const create = rpcFamilyProcedure
	.route({ method: "POST", tags: ["Files"] })
	.input(fileCreateInputZod)
	.output(fileSelectAllZod)
	.handler(async ({ input, context: { user, familyId } }) => {
		// Selective .merge() lets late-arriving cdnUrl/thumbnailCdnUrl land on an
		// existing row without overwriting immutable fields (filename, owner).
		//
		// `familyId` is server-owned — pulled from the auth context, NEVER
		// from the client input, to prevent tenant-forgery.
		const newFile = await db.files
			.create({
				...input,
				familyId,
				createdByUserId: user.id,
			})
			.onConflict("id")
			.merge(["cdnUrl", "thumbnailCdnUrl"]);

		return newFile;
	});

const getByTableId = rpcFamilyProcedure
	.route({ method: "GET", tags: ["Files"] })
	.input(
		z.object({
			tableName: fileTableNameZod,
			tableId: z.string(),
		}),
	)
	.output(z.array(fileSelectAllZod))
	.handler(async ({ input, context: { user, familyId } }) => {
		return await db.files
			.where({
				tableName: input.tableName,
				tableId: input.tableId,
				createdByUserId: user.id,
				familyId,
			})
			.order({ createdAt: "ASC" });
	});

export const filesRouter = {
	create,
	getByTableId,
};
