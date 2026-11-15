import { getHistory } from "@backend/modules/imports/services/history.service";
import {
	applyStatement,
	listUploads,
	previewStatement,
	undoUpload,
} from "@backend/modules/imports/services/import.service";
import { notifyQuestions } from "@backend/modules/portfolio/services/notify.portfolio.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import { TEMPLATE_CASH_EXAMPLE, TEMPLATE_TRADES_EXAMPLE } from "@connected-repo/broker-parsers/template/template";
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
	.handler(async ({ input, context: { user } }) => {
		const applied = await applyStatement(input);
		// The uploader has just been shown the questions; the others who can answer are told.
		notifyQuestions({ accountId: input.accountId, count: applied.questions, by: { id: user.id, name: user.name } });
		return applied;
	});

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

// Kosh's own layout, for an account at a broker it has no reader for: two
// small example tables to download, fill in and upload like any statement.
const layouts = rpcPortfolioProcedure
	.output(z.object({ trades: z.string(), cash: z.string() }))
	.handler(() => ({ trades: TEMPLATE_TRADES_EXAMPLE, cash: TEMPLATE_CASH_EXAMPLE }));

export const importsRouter = { preview, apply, undo, list, history, layouts };
