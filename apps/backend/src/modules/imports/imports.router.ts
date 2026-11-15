import { getHistory } from "@backend/modules/imports/services/history.service";
import {
	applyStatement,
	listUploads,
	previewStatement,
	undoUpload,
} from "@backend/modules/imports/services/import.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import {
	historyZod,
	statementAppliedZod,
	statementPreviewZod,
	statementUploadZod,
	uploadZod,
} from "@connected-repo/zod-schemas/kosh/statements.zod";
import { z } from "zod";

// Statements. Each endpoint checks the level it needs on the account
// (services/import.service.ts): looking needs view; uploading and undoing
// need edit, and someone who is not an owner undoes only their own uploads.

const account = z.object({ accountId: z.string() });

// What uploading this file would do. Changes nothing.
const preview = rpcPortfolioProcedure
	.input(statementUploadZod)
	.output(statementPreviewZod)
	.handler(({ input }) => previewStatement(input));

// Put the file in — all of it or none of it.
const apply = rpcPortfolioProcedure
	.input(statementUploadZod)
	.output(statementAppliedZod)
	.handler(({ input }) => applyStatement(input));

const undo = rpcPortfolioProcedure
	.input(z.object({ batchId: z.string(), reason: z.string().max(500).optional() }))
	.output(z.object({ ok: z.literal(true) }))
	.handler(async ({ input }) => {
		await undoUpload(input);
		return { ok: true as const };
	});

const list = rpcPortfolioProcedure
	.input(account)
	.output(z.array(uploadZod))
	.handler(({ input }) => listUploads(input.accountId));

// How complete this account's history is, and what is missing.
const history = rpcPortfolioProcedure
	.input(account)
	.output(historyZod)
	.handler(({ input }) => getHistory(input.accountId));

export const importsRouter = { preview, apply, undo, list, history };
