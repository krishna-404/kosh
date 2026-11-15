import { db } from "@backend/db/db";
import { findInstrumentsByIsin } from "@backend/modules/instruments/services/isin.instruments.service";
import { onLedgerChanged } from "@backend/modules/metrics/services/ledger_changed";
import {
	atLeast,
	requireAccess,
	requireAccountLevel,
	usersById,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import {
	type DetectedStatement,
	detectStatement,
} from "@connected-repo/broker-parsers/detect";
import { findHeaderRow, type Sheet } from "@connected-repo/broker-parsers/table";
import { parseZerodhaHoldings } from "@connected-repo/broker-parsers/zerodha/holdings";
import { parseZerodhaLedger } from "@connected-repo/broker-parsers/zerodha/ledger";
import { classifyZerodhaLedgerLine } from "@connected-repo/broker-parsers/zerodha/ledger-classifier";
import { validateZerodhaLedgerBalances } from "@connected-repo/broker-parsers/zerodha/ledger-validator";
import { parseZerodhaTradebook } from "@connected-repo/broker-parsers/zerodha/tradebook";
import type { CashFlowClassification } from "@connected-repo/zod-schemas/enums.zod";
import type {
	StatementPreview,
	StatementUpload,
	Upload,
} from "@connected-repo/zod-schemas/kosh/statements.zod";
import { ORPCError } from "@orpc/server";
import {
	mulToMoney,
	signedFlowAmount,
	toMoney,
	trimDecimal,
} from "../lib/decimal.imports";
import { ledgerLineHash, sha256HexOfBytes } from "../lib/hash.imports";
import {
	type ReadStatement,
	readStatement,
	UnreadableStatementError,
} from "../lib/statement_reader.imports";

// The import pipeline: a file is read, recognised, checked and previewed
// without changing anything; applying it writes the raw rows and what Kosh
// makes of them in one transaction, or nothing at all. Undoing an upload is
// an event — rows are marked not live, never deleted.

const PREVIEW_ROWS = 200;
const PREVIEW_ERRORS = 50;
const CHUNK = 400;

const BROKER_NAME: Record<string, string> = {
	zerodha: "Zerodha",
	groww: "Groww",
	dhan: "Dhan",
	manual: "another broker",
};

type Problem = NonNullable<StatementPreview["problem"]>;
type PreviewRow = StatementPreview["rows"][number];

/** What a statement would do, and how to do it. */
interface Analysis {
	summary: StatementPreview["summary"];
	span: { from: string; to: string } | null;
	errors: { row: number; message: string }[];
	rows: PreviewRow[];
	problem: Problem | null;
	meta: Record<string, unknown>;
	/** Write the raw rows and their interpretation. Runs inside the apply transaction. */
	write: (batchId: string) => Promise<void>;
}

const chunks = <T>(items: T[], size = CHUNK): T[][] => {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
};

const toEpoch = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Rebuild CSV text from a sheet, starting at its header row — for the CSV-based parsers. */
function sheetToCsv(sheet: Sheet, header: readonly string[]): string | null {
	const found = findHeaderRow(sheet.rows, header);
	if (!found) return null;
	const quote = (cell: string) => (/[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
	return sheet.rows
		.slice(found.rowIndex)
		.map((row, i) => (i === 0 ? row.map((c) => c.trim().toLowerCase()) : row).map(quote).join(","))
		.join("\n");
}

// ─── Tradebook ──────────────────────────────────────────────────────────

/** Get-or-create the instrument for each ISIN, with a broker-symbol alias. */
async function resolveInstruments(
	trades: { isin: string | null; symbol: string; exchange: string }[],
	broker: string,
): Promise<Map<string, string>> {
	const byIsin = new Map<string, { symbol: string; exchange: string }>();
	for (const t of trades) if (t.isin && !byIsin.has(t.isin)) byIsin.set(t.isin, t);
	const isins = [...byIsin.keys()];
	if (isins.length === 0) return new Map();

	// A share keeps its place across a change of ISIN (a face-value split).
	const idByIsin = await findInstrumentsByIsin(isins);
	const missing = isins.filter((isin) => !idByIsin.has(isin));
	for (const group of chunks(missing)) {
		const created = await db.instruments
			.createMany(
				group.map((isin) => {
					const seen = byIsin.get(isin) as { symbol: string; exchange: string };
					return {
						kind: "equity" as const,
						isin,
						symbolCanonical: seen.symbol,
						name: seen.symbol,
						currency: "INR",
						exchangeCalendar:
							seen.exchange === "NSE" || seen.exchange === "BSE" ? seen.exchange : null,
					};
				}),
			)
			.select("id", "isin");
		for (const i of created) idByIsin.set(i.isin as string, i.id);
	}

	// Remember the symbol each broker uses, once.
	const brokerEnum = broker === "zerodha" ? ("zerodha" as const) : null;
	if (brokerEnum) {
		const ids = [...idByIsin.values()];
		const aliases = await db.instrumentAliases
			.where({ instrumentId: { in: ids }, aliasKind: "broker_symbol", broker: brokerEnum })
			.select("instrumentId", "alias");
		const have = new Set(aliases.map((a) => `${a.instrumentId}:${a.alias}`));
		const wanted = [...byIsin]
			.map(([isin, seen]) => ({ instrumentId: idByIsin.get(isin) as string, alias: seen.symbol }))
			.filter((a) => !have.has(`${a.instrumentId}:${a.alias}`));
		for (const group of chunks(wanted))
			await db.instrumentAliases.createMany(
				group.map((a) => ({ ...a, aliasKind: "broker_symbol" as const, broker: brokerEnum })),
			);
	}
	return idByIsin;
}

async function analyzeTradebook(accountId: string, text: string): Promise<Analysis> {
	const parsed = parseZerodhaTradebook(text);
	const errors = parsed.errors.map((e) => ({ row: e.row, message: e.message }));

	const ids = parsed.rows.map((r) => r.brokerTradeId);
	const existing =
		ids.length > 0
			? await db.rawTrades
					.where({ accountId, isLive: true, brokerTradeId: { in: ids } })
					.pluck("brokerTradeId")
			: [];
	const seen = new Set(existing.filter((v): v is string => v !== null));
	// The same fill twice in one file is one fill.
	const fresh = parsed.rows.filter((t) => {
		if (seen.has(t.brokerTradeId)) return false;
		seen.add(t.brokerTradeId);
		return true;
	});
	const freshIds = new Set(fresh.map((t) => t.brokerTradeId));
	const needsIsin = fresh.filter((t) => t.isin === null).length;

	const rows: PreviewRow[] = parsed.rows.map((t) => ({
		ref: t.brokerTradeId,
		date: t.tradeDate,
		text: `${t.side === "buy" ? "Bought" : "Sold"} ${trimDecimal(t.quantity)} ${t.symbol} at ₹${trimDecimal(t.price)}`,
		amount: mulToMoney(t.quantity, t.price),
		status: !freshIds.has(t.brokerTradeId) ? "duplicate" : t.isin === null ? "question" : "new",
	}));
	// A duplicate inside the file shows once as new, later copies as duplicate.
	const shown = new Set<string>();
	for (const row of rows) {
		if (row.status !== "duplicate" && shown.has(row.ref)) row.status = "duplicate";
		shown.add(row.ref);
	}

	return {
		summary: {
			total: parsed.rows.length + errors.length,
			new: fresh.length,
			duplicate: parsed.rows.length - fresh.length,
			error: errors.length,
			questions: needsIsin,
		},
		span: parsed.meta.tradeDateSpan,
		errors,
		rows,
		problem: null,
		meta: { segments: parsed.meta.segments },
		write: async (batchId) => {
			const instruments = await resolveInstruments(fresh, "zerodha");
			for (const group of chunks(fresh)) {
				const raws = await db.rawTrades
					.createMany(
						group.map((t) => ({
							batchId,
							accountId,
							tradeDate: t.tradeDate,
							execTime: t.executedAt ? Date.parse(`${t.executedAt}Z`) : null,
							brokerSymbol: t.symbol,
							exchange: t.exchange,
							isin: t.isin,
							side: t.side,
							quantity: t.quantity,
							price: t.price,
							brokerTradeId: t.brokerTradeId,
							brokerOrderId: t.brokerOrderId,
							charges: null,
							rawRow: { ...t },
						})),
					)
					.select("id");
				// A fill with no ISIN stays raw until someone says what it is.
				const known = group
					.map((t, i) => ({ t, rawId: raws[i]?.id as string }))
					.filter(({ t }) => t.isin !== null);
				if (known.length === 0) continue;
				const events = await db.events
					.createMany(
						known.map(({ t, rawId }) => ({
							accountId,
							kind: "trade_recognized" as const,
							payload: { batchId, rawTradeId: rawId },
							actor: "system" as const,
							occurredAt: toEpoch(t.tradeDate),
						})),
					)
					.select("id");
				await db.trades.createMany(
					known.map(({ t, rawId }, i) => {
						const gross = mulToMoney(t.quantity, t.price);
						return {
							rawTradeId: rawId,
							accountId,
							instrumentId: instruments.get(t.isin as string) as string,
							tradeDate: t.tradeDate,
							side: t.side,
							quantity: t.quantity,
							price: t.price,
							grossValue: gross,
							// Zerodha's tradebook carries no charges; they reach the
							// account through the ledger's settlement lines.
							totalCharges: "0.00",
							netValue: gross,
							recognizedEventId: events[i]?.id as string,
						};
					}),
				);
			}
		},
	};
}

// ─── Ledger ─────────────────────────────────────────────────────────────

async function analyzeLedger(accountId: string, text: string): Promise<Analysis> {
	const parsed = parseZerodhaLedger(text);
	const errors = parsed.errors.map((e) => ({ row: e.row, message: e.message }));
	// The lines must reproduce the statement's own running balance, to the paisa.
	const balance = validateZerodhaLedgerBalances(parsed.rows, parsed.meta);
	for (const e of balance.errors) errors.push({ row: e.row, message: e.message });

	// Lines already in, counted — two identical lines on one day are two lines.
	const existing = await db.rawLedgerLines
		.where({ accountId, isLive: true })
		.select("postedDate", "narration", "debit", "credit");
	const inAlready = new Map<string, number>();
	for (const l of existing) {
		const hash = ledgerLineHash({ accountId, ...l });
		inAlready.set(hash, (inAlready.get(hash) ?? 0) + 1);
	}

	const entries = parsed.rows.map((line) => {
		const hash = ledgerLineHash({
			accountId,
			postedDate: line.postingDate,
			narration: line.particulars,
			debit: line.debit,
			credit: line.credit,
		});
		const left = inAlready.get(hash) ?? 0;
		if (left > 0) inAlready.set(hash, left - 1);
		const guess = classifyZerodhaLedgerLine(line);
		return {
			line,
			duplicate: left > 0,
			// Kosh classifies only what it is sure of; the rest becomes a question.
			classification: (guess.confidence === "high"
				? guess.classification
				: null) as CashFlowClassification | null,
			rule: guess.rule,
		};
	});
	const fresh = entries.filter((e) => !e.duplicate);
	const questions = fresh.filter((e) => e.classification === null).length;

	return {
		summary: {
			total: parsed.rows.length + parsed.errors.length,
			new: fresh.length,
			duplicate: entries.length - fresh.length,
			error: errors.length,
			questions,
		},
		span: parsed.meta.postingDateSpan,
		errors,
		rows: entries.map((e) => ({
			ref: String(e.line.row),
			date: e.line.postingDate,
			text: e.line.particulars,
			amount: signedFlowAmount(e.line.debit, e.line.credit),
			status: e.duplicate ? "duplicate" : e.classification === null ? "question" : "new",
		})),
		problem: null,
		meta: {
			openingBalance: parsed.meta.openingBalance ? toMoney(parsed.meta.openingBalance) : null,
			closingBalance: parsed.meta.closingBalance ? toMoney(parsed.meta.closingBalance) : null,
		},
		write: async (batchId) => {
			for (const group of chunks(fresh)) {
				const raws = await db.rawLedgerLines
					.createMany(
						group.map((e) => ({
							batchId,
							accountId,
							postedDate: e.line.postingDate,
							valueDate: null,
							narration: e.line.particulars,
							debit: e.line.debit,
							credit: e.line.credit,
							runningBalance: e.line.netBalance,
							brokerVoucherId: null,
							rawRow: { ...e.line },
							lineNo: e.line.row,
						})),
					)
					.select("id");
				const sure = group
					.map((e, i) => ({ e, rawId: raws[i]?.id as string }))
					.filter(({ e }) => e.classification !== null);
				if (sure.length === 0) continue;
				const events = await db.events
					.createMany(
						sure.map(({ e, rawId }) => ({
							accountId,
							kind: "cash_flow_classified" as const,
							payload: { batchId, rawLedgerLineId: rawId, rule: e.rule },
							actor: "system" as const,
							occurredAt: toEpoch(e.line.postingDate),
						})),
					)
					.select("id");
				await db.cashFlows.createMany(
					sure.map(({ e, rawId }, i) => {
						const amount = signedFlowAmount(e.line.debit, e.line.credit);
						return {
							accountId,
							flowDate: e.line.postingDate,
							amount,
							currency: "INR",
							classification: e.classification as CashFlowClassification,
							sourceLedgerLineId: rawId,
							classifiedEventId: events[i]?.id as string,
							inrAmount: amount,
						};
					}),
				);
			}
		},
	};
}

// ─── Holdings ───────────────────────────────────────────────────────────

async function analyzeHoldings(
	accountId: string,
	sheet: Sheet,
	asOfInput: string | undefined,
): Promise<Analysis> {
	const parsed = parseZerodhaHoldings(sheet.rows);
	const errors = parsed.errors.map((e) => ({ row: e.row, message: e.message }));
	const asOf = parsed.meta.asOf ?? asOfInput ?? null;

	return {
		summary: {
			total: parsed.rows.length + errors.length,
			new: parsed.rows.length,
			duplicate: 0,
			error: errors.length,
			questions: 0,
		},
		span: asOf ? { from: asOf, to: asOf } : null,
		errors,
		rows: parsed.rows.map((h) => ({
			ref: String(h.row),
			date: asOf,
			text: `${trimDecimal(h.quantity)} ${h.symbol}`,
			amount: null,
			status: "new" as const,
		})),
		problem: asOf
			? null
			: {
					code: "needs_date",
					message:
						"This holdings statement doesn’t say which day it is for. Tell Kosh the date it was downloaded for.",
				},
		meta: { asOf },
		write: async (batchId) => {
			if (!asOf) return;
			// A newer statement for the same day replaces the older one.
			await db.rawHoldingsSnapshots
				.where({ accountId, asOf, isLive: true })
				.update({ isLive: false });
			for (const group of chunks(parsed.rows))
				await db.rawHoldingsSnapshots.createMany(
					group.map((h) => ({
						batchId,
						accountId,
						asOf,
						isin: h.isin,
						brokerSymbol: h.symbol,
						quantity: h.quantity,
						avgPrice: h.averagePrice,
						rawRow: { ...h },
					})),
				);
		},
	};
}

// ─── Reading and recognising a file ─────────────────────────────────────

const KIND_WORDS: Record<DetectedStatement["kind"], string> = {
	tradebook: "tradebook",
	ledger: "ledger",
	holdings: "holdings statement",
	dividends: "dividend statement",
};

interface Analysed {
	bytes: Buffer;
	sha256: string;
	detected: DetectedStatement | null;
	analysis: Analysis | null;
	preview: StatementPreview;
}

const EMPTY_SUMMARY = { total: 0, new: 0, duplicate: 0, error: 0, questions: 0 };

async function analyse(input: StatementUpload): Promise<Analysed> {
	const bytes = Buffer.from(input.contentBase64, "base64");
	const sha256 = sha256HexOfBytes(bytes);
	const account = await db.brokerAccounts.find(input.accountId).select("id", "label", "broker");

	const stopped = (
		problem: Problem,
		detected: DetectedStatement | null = null,
		previous: StatementPreview["previous"] = null,
	): Analysed => ({
		bytes,
		sha256,
		detected,
		analysis: null,
		preview: {
			fileName: input.fileName,
			detected: detected && { broker: detected.broker, kind: detected.kind },
			canApply: false,
			problem,
			summary: EMPTY_SUMMARY,
			span: null,
			errors: [],
			rows: [],
			moreRows: 0,
			previous,
		},
	});

	let file: ReadStatement;
	try {
		file = await readStatement(bytes);
	} catch (error) {
		if (error instanceof UnreadableStatementError)
			return stopped({ code: "unreadable", message: error.message });
		throw error;
	}

	const detected = detectStatement(file.sheets);
	if (!detected)
		return stopped({
			code: "unrecognised",
			message:
				"Kosh doesn’t recognise this file. For now it reads Zerodha’s tradebook, ledger and holdings statements, as downloaded from Console.",
		});
	if (detected.kind === "dividends")
		return stopped(
			{
				code: "unsupported",
				message:
					"This is a dividend statement. Kosh can’t read those yet — upload the tradebook, ledger or holdings statement.",
			},
			detected,
		);
	if (account.broker !== "manual" && account.broker !== detected.broker)
		return stopped(
			{
				code: "wrong_broker",
				message: `This looks like a ${BROKER_NAME[detected.broker]} statement, but ${account.label} is a ${BROKER_NAME[account.broker]} account. Upload it to the ${BROKER_NAME[detected.broker]} account it belongs to.`,
			},
			detected,
		);

	// The very same file again.
	const same = await db.importBatches
		.where({ accountId: account.id, contentSha256: sha256, status: "applied" })
		.order({ createdAt: "DESC" })
		.select("fileName", "appliedAt", "createdAt")
		.takeOptional();
	if (same)
		return stopped(
			{
				code: "already_uploaded",
				message: "This file is already in. Nothing was added.",
			},
			detected,
			{ fileName: same.fileName ?? input.fileName, at: same.appliedAt ?? same.createdAt },
		);

	const sheet = file.sheets.find((s) => s.name === detected.sheet) as Sheet;
	let analysis: Analysis;
	if (detected.kind === "holdings") {
		analysis = await analyzeHoldings(account.id, sheet, input.asOf);
	} else {
		const header =
			detected.kind === "tradebook"
				? ["symbol", "isin", "trade_date", "trade_id"]
				: ["particulars", "posting_date", "net_balance"];
		const text = file.text ?? sheetToCsv(sheet, header);
		if (text === null)
			return stopped(
				{ code: "unrecognised", message: "Kosh couldn’t find the table in this file." },
				detected,
			);
		analysis =
			detected.kind === "tradebook"
				? await analyzeTradebook(account.id, text)
				: await analyzeLedger(account.id, text);
	}

	let problem = analysis.problem;
	if (!problem && analysis.errors.length > 0)
		problem = {
			code: "has_errors",
			message:
				detected.kind === "ledger"
					? "Some lines in this ledger can’t be read, or its balances don’t add up. Nothing will be added until the file is whole — download it again from your broker."
					: `Some lines in this ${KIND_WORDS[detected.kind]} can’t be read. Nothing will be added until the file is whole — download it again from your broker.`,
		};
	if (!problem && analysis.summary.new === 0)
		problem = {
			code: "nothing_new",
			message:
				analysis.summary.total === 0
					? `This ${KIND_WORDS[detected.kind]} has no lines in it.`
					: `All ${analysis.summary.duplicate} lines in this file are already in. Nothing was added.`,
		};

	return {
		bytes,
		sha256,
		detected,
		analysis,
		preview: {
			fileName: input.fileName,
			detected: { broker: detected.broker, kind: detected.kind },
			canApply: problem === null,
			problem,
			summary: analysis.summary,
			span: analysis.span,
			errors: analysis.errors.slice(0, PREVIEW_ERRORS),
			rows: analysis.rows.slice(0, PREVIEW_ROWS),
			moreRows: Math.max(0, analysis.rows.length - PREVIEW_ROWS),
			previous: null,
		},
	};
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Look at a file and say what uploading it would do. Changes nothing — but
 * it is the first step of an upload, so it needs the same level as applying.
 */
export async function previewStatement(input: StatementUpload): Promise<StatementPreview> {
	requireAccountLevel(input.accountId, "edit");
	return (await analyse(input)).preview;
}

/** Put a file in: the verbatim file, its raw rows and what Kosh makes of them — all or nothing. */
export async function applyStatement(input: StatementUpload) {
	requireAccountLevel(input.accountId, "edit");
	const { userId } = requireAccess();
	const { preview, analysis, detected, bytes, sha256 } = await analyse(input);
	if (!preview.canApply || !analysis || !detected)
		throw new ORPCError("BAD_REQUEST", {
			status: 400,
			message: preview.problem?.message ?? "This file can’t be added.",
			data: { code: preview.problem?.code },
		});

	return db.$transaction(async () => {
		const file = await db.importFiles.create({
			accountId: input.accountId,
			fileName: input.fileName,
			sizeBytes: bytes.length,
			sha256,
			content: bytes,
			uploadedByUserId: userId,
		});
		const batch = await db.importBatches.create({
			accountId: input.accountId,
			kind: detected.kind === "dividends" ? "manual_entry" : detected.kind,
			status: "applied",
			contentSha256: sha256,
			uploadedByUserId: userId,
			appliedAt: Date.now(),
			stats: analysis.summary,
			importFileId: file.id,
			fileName: input.fileName,
			broker: detected.broker,
			spanFrom: analysis.span?.from ?? null,
			spanTo: analysis.span?.to ?? null,
			meta: analysis.meta,
		});
		await analysis.write(batch.id);
		await onLedgerChanged(input.accountId);
		return {
			batchId: batch.id,
			added: analysis.summary.new,
			duplicates: analysis.summary.duplicate,
			questions: analysis.summary.questions,
		};
	});
}

/**
 * Undo an upload as a unit: a retraction event; the batch marked retracted;
 * every event it produced superseded; every row it produced — and every
 * answer given about its lines — marked not live, so the same file can be
 * uploaded again later. Deletes nothing.
 *
 * An owner can undo any upload; someone who can edit, only their own.
 */
export async function undoUpload(input: { batchId: string; reason?: string }): Promise<void> {
	const { userId } = requireAccess();
	// Scoped: a batch of an account the caller cannot see is "not found".
	const batch = await db.importBatches
		.where({ id: input.batchId })
		.select("id", "accountId", "status", "uploadedByUserId", "fileName")
		.takeOptional();
	if (!batch) throw new ORPCError("NOT_FOUND", { status: 404, message: "Upload not found" });
	const level = requireAccountLevel(batch.accountId, "edit");
	if (level !== "owner" && batch.uploadedByUserId !== userId)
		throw new ORPCError("FORBIDDEN", {
			status: 403,
			message: "You can undo uploads you made. An owner can undo this one.",
		});
	if (batch.status === "retracted")
		throw new ORPCError("BAD_REQUEST", { status: 400, message: "This upload was already undone." });

	await db.$transaction(async () => {
		const retraction = await db.events.create({
			accountId: batch.accountId,
			kind: "retraction",
			payload: { batchId: batch.id, fileName: batch.fileName },
			actor: "user",
			userId,
			occurredAt: Date.now(),
			reason: input.reason?.trim() || "Upload undone",
		});
		// Everything this batch produced carries its id in the event payload —
		// including answers people gave about its lines.
		await db.events.where({
			kind: { in: ["trade_recognized", "cash_flow_classified", "user_resolution"] },
			supersededByEventId: null,
		}).whereSql`payload->>'batchId' = ${batch.id}`.update({
			supersededByEventId: retraction.id,
		});

		// Whatever those events produced is no longer part of the ledger.
		await db.$query`
			UPDATE trades SET is_live = false
			WHERE recognized_event_id IN (SELECT id FROM events WHERE superseded_by_event_id = ${retraction.id})`;
		await db.$query`
			UPDATE cash_flows SET is_live = false
			WHERE classified_event_id IN (SELECT id FROM events WHERE superseded_by_event_id = ${retraction.id})`;
		await db.rawTrades.where({ batchId: batch.id }).update({ isLive: false });
		await db.rawLedgerLines.where({ batchId: batch.id }).update({ isLive: false });
		await db.rawHoldingsSnapshots.where({ batchId: batch.id }).update({ isLive: false });
		await db.importBatches
			.where({ id: batch.id })
			.update({ status: "retracted", retractionEventId: retraction.id });
		await onLedgerChanged(batch.accountId);
	});
}

/** An account's uploads, newest first, with who made each and whether the caller may undo it. */
export async function listUploads(accountId: string): Promise<Upload[]> {
	const level = requireAccountLevel(accountId, "view");
	const { userId } = requireAccess();
	const batches = await db.importBatches
		.where({ accountId, status: { in: ["applied", "retracted"] } })
		.order({ createdAt: "DESC" })
		.select(
			"id",
			"kind",
			"status",
			"fileName",
			"broker",
			"appliedAt",
			"createdAt",
			"uploadedByUserId",
			"stats",
			"spanFrom",
			"spanTo",
		);
	const users = await usersById(batches.map((b) => b.uploadedByUserId));
	const canEdit = atLeast(level, "edit");
	return batches.map((b) => {
		const mine = b.uploadedByUserId === userId;
		const live = b.status === "applied";
		const allowed = live && (level === "owner" || (canEdit && mine));
		return {
			batchId: b.id,
			fileName: b.fileName,
			kind: b.kind,
			broker: b.broker,
			status: live ? ("applied" as const) : ("retracted" as const),
			at: b.appliedAt ?? b.createdAt,
			byName: users.get(b.uploadedByUserId)?.name ?? "Someone",
			byMe: mine,
			added: Number((b.stats as { new?: number } | null)?.new ?? 0),
			span: b.spanFrom && b.spanTo ? { from: b.spanFrom, to: b.spanTo } : null,
			canUndo: allowed,
			undoBlocked:
				live && canEdit && !allowed
					? "You can undo uploads you made. An owner can undo this one."
					: null,
		};
	});
}
