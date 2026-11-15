import { z } from "zod";
import { cashFlowClassificationZod, tradeSideZod } from "../enums.zod.js";

/**
 * Statements, the ledger they produce and the questions they raise — the
 * contract between the backend and the account page
 * (docs/kosh/06-build-plan.md, phase 3).
 *
 * Amounts are decimal strings in rupees; dates are YYYY-MM-DD; moments are
 * epoch milliseconds.
 */

export const STATEMENT_KINDS = ["tradebook", "ledger", "holdings", "dividends"] as const;
export const statementKindZod = z.enum(STATEMENT_KINDS);
export type StatementKind = z.infer<typeof statementKindZod>;

// ─── Uploading ──────────────────────────────────────────────────────────

/** A file as picked in the browser. Nobody says what kind it is — Kosh works that out. */
export const statementUploadZod = z.object({
	accountId: z.string(),
	fileName: z.string().trim().min(1).max(255),
	/** The file's bytes, base64. Statements are small; 12 MB is far above any real one. */
	contentBase64: z.string().min(1).max(16_000_000),
	/** For a holdings statement whose date is not written in the file. */
	asOf: z.iso.date().optional(),
});
export type StatementUpload = z.infer<typeof statementUploadZod>;

export const PREVIEW_PROBLEMS = [
	"unreadable", // not a CSV or XLSX Kosh can open
	"unrecognised", // opened, but not a statement Kosh knows
	"unsupported", // recognised, but not read yet (e.g. dividend statements)
	"wrong_broker", // a statement from another broker than the account's
	"already_uploaded", // this exact file is already in
	"nothing_new", // every line is already in from other files
	"has_errors", // lines Kosh could not read, or the balances do not add up
	"needs_date", // a holdings statement that does not say what day it is for
] as const;

const previewRowZod = z.object({
	/** The broker's own reference, or the line's number in the file. */
	ref: z.string(),
	date: z.string().nullable(),
	text: z.string(),
	/** Signed for money lines (+ into the account); the trade's value for trades. */
	amount: z.string().nullable(),
	/** `question`: new, but Kosh will ask what it was. */
	status: z.enum(["new", "duplicate", "question"]),
});

export const statementPreviewZod = z.object({
	fileName: z.string(),
	detected: z.object({ broker: z.string(), kind: statementKindZod }).nullable(),
	/** True only when the whole file can go in as one. */
	canApply: z.boolean(),
	problem: z
		.object({ code: z.enum(PREVIEW_PROBLEMS), message: z.string() })
		.nullable(),
	summary: z.object({
		total: z.number().int(),
		new: z.number().int(),
		duplicate: z.number().int(),
		error: z.number().int(),
		/** New lines Kosh will ask about once they are in. */
		questions: z.number().int(),
	}),
	span: z.object({ from: z.string(), to: z.string() }).nullable(),
	/** Lines that could not be read (first 50). */
	errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
	/** The first lines, each with what will happen to it. */
	rows: z.array(previewRowZod),
	moreRows: z.number().int(),
	/** When this file, or all of its lines, came in before. */
	previous: z.object({ fileName: z.string(), at: z.number() }).nullable(),
});
export type StatementPreview = z.infer<typeof statementPreviewZod>;

export const statementAppliedZod = z.object({
	batchId: z.string(),
	added: z.number().int(),
	duplicates: z.number().int(),
	questions: z.number().int(),
});

export const uploadZod = z.object({
	batchId: z.string(),
	fileName: z.string().nullable(),
	kind: z.string(),
	broker: z.string().nullable(),
	status: z.enum(["applied", "retracted"]),
	at: z.number(),
	byName: z.string(),
	byMe: z.boolean(),
	added: z.number().int(),
	span: z.object({ from: z.string(), to: z.string() }).nullable(),
	/** The caller may undo it: an owner any upload, an editor their own. */
	canUndo: z.boolean(),
	/** Why not, when they could in principle (an editor looking at someone else's). */
	undoBlocked: z.string().nullable(),
});
export type Upload = z.infer<typeof uploadZod>;

// ─── How complete the history is ────────────────────────────────────────

export const historyZod = z.object({
	ledger: z
		.object({
			from: z.string(),
			to: z.string(),
			lines: z.number().int(),
			/** Balance in the account before the first line Kosh has; "0.00" when it starts from nothing. */
			openingBalance: z.string(),
			openingExplained: z.boolean(),
			/** Stretches where the running balance jumps: lines are missing in between. */
			gaps: z.array(z.object({ after: z.string(), before: z.string(), missing: z.string() })),
		})
		.nullable(),
	trades: z
		.object({
			from: z.string(),
			to: z.string(),
			count: z.number().int(),
			/** Months the ledger shows trades settling but no tradebook covers. */
			missingMonths: z.array(z.string()),
		})
		.nullable(),
	holdings: z.object({ asOf: z.string(), lines: z.number().int() }).nullable(),
	/** Everything needed for true returns is in, from the account's first day. */
	complete: z.boolean(),
});
export type History = z.infer<typeof historyZod>;

// ─── Questions ──────────────────────────────────────────────────────────

/** The plain-words answers to "what was this line?" */
export const LINE_ANSWERS = [
	"external_deposit",
	"external_withdrawal",
	"charge",
	"interest",
	"trade_settlement",
	"other_internal",
] as const satisfies readonly z.infer<typeof cashFlowClassificationZod>[];
export const lineAnswerZod = z.enum(LINE_ANSWERS);
export type LineAnswer = z.infer<typeof lineAnswerZod>;

const accountRefZod = z.object({ id: z.string(), label: z.string() });

const flowRefZod = z.object({
	flowId: z.string(),
	account: accountRefZod,
	date: z.string(),
	amount: z.string(),
});

export const questionZod = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("ledger_line"),
		id: z.string(),
		account: accountRefZod,
		canAnswer: z.boolean(),
		lineId: z.string(),
		date: z.string(),
		narration: z.string(),
		/** Signed: + came into the account, − left it. */
		amount: z.string(),
	}),
	z.object({
		kind: z.literal("opening_balance"),
		id: z.string(),
		account: accountRefZod,
		canAnswer: z.boolean(),
		date: z.string(),
		amount: z.string(),
	}),
	z.object({
		kind: z.literal("missing_isin"),
		id: z.string(),
		account: accountRefZod,
		canAnswer: z.boolean(),
		rawTradeId: z.string(),
		date: z.string(),
		symbol: z.string(),
		side: tradeSideZod,
		quantity: z.string(),
		price: z.string(),
	}),
	z.object({
		kind: z.literal("transfer"),
		id: z.string(),
		/** The account the question is filed under (where the money arrived). */
		account: accountRefZod,
		canAnswer: z.boolean(),
		out: flowRefZod,
		in: flowRefZod,
	}),
]);
export type Question = z.infer<typeof questionZod>;

export const questionListInputZod = z.object({ accountId: z.string().optional() });

// ─── The ledger, as read ────────────────────────────────────────────────

export const cashFlowRowZod = z.object({
	id: z.string(),
	date: z.string(),
	/** Signed: + into the account, − out of it. */
	amount: z.string(),
	classification: cashFlowClassificationZod,
	narration: z.string().nullable(),
	/** Kosh worked it out, someone answered a question, or it stands for the opening balance. */
	source: z.enum(["rule", "answer", "opening_balance"]),
	/** Paired with money moving in another account — the same money, not new money. */
	transfer: z
		.object({ linkId: z.string(), otherAccount: accountRefZod.nullable() })
		.nullable(),
});
export type CashFlowRow = z.infer<typeof cashFlowRowZod>;

export const ledgerPageInputZod = z.object({
	accountId: z.string(),
	/** `external`: only money in and out; `all`: every line. */
	show: z.enum(["external", "all"]).default("external"),
	/** Rows before this date-and-id cursor. */
	before: z.string().optional(),
	limit: z.number().int().min(1).max(200).default(100),
});

export const cashFlowPageZod = z.object({
	rows: z.array(cashFlowRowZod),
	nextBefore: z.string().nullable(),
	totals: z.object({ in: z.string(), out: z.string() }),
});

export const tradeRowZod = z.object({
	id: z.string(),
	date: z.string(),
	symbol: z.string(),
	isin: z.string().nullable(),
	side: tradeSideZod,
	quantity: z.string(),
	price: z.string(),
	value: z.string(),
});

export const tradePageZod = z.object({
	rows: z.array(tradeRowZod),
	nextBefore: z.string().nullable(),
	total: z.number().int(),
});
