import { formatDate, formatDay, formatMonth, formatWhen } from "@connected-repo/ui-mui/format/date";
import { formatMoney, groupIndian } from "@connected-repo/ui-mui/format/money";
import type { Broker } from "@connected-repo/zod-schemas/enums.zod";
import {
	type AppliedAction,
	type History,
	LINE_ANSWERS,
	type LineAnswer,
	type Question,
	type StatementKind,
	type StatementPreview,
	type Upload,
} from "@connected-repo/zod-schemas/kosh/statements.zod";
import { BROKER_LABEL } from "@frontend/copy/levels.copy";
import { HISTORY, QUESTIONS, SPLITS, UPLOAD, UPLOADS } from "@frontend/copy/statements.copy";

/**
 * The thinking behind the "Statements and questions" tab that needs no
 * React: turning a file into what the server takes, and API answers into
 * the sentences on screen. Unit tested in `statements.utils.test.ts`.
 */

// ─── Files ──────────────────────────────────────────────────────────────

/** The most the server takes: 16,000,000 base64 characters is 12 MB of file. */
export const MAX_FILE_BYTES = 12_000_000;

/** What the file picker offers: the two formats the server reads. */
export const ACCEPTED_FILES =
	".csv,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Bytes → base64, in slices so a large file does not overflow the call stack. */
export const bytesToBase64 = (bytes: Uint8Array): string => {
	const SLICE = 0x8000;
	let binary = "";
	for (let i = 0; i < bytes.length; i += SLICE)
		binary += String.fromCharCode(...bytes.subarray(i, i + SLICE));
	return btoa(binary);
};

/** A picked file as the server wants it (`statementUploadZod.contentBase64`). */
export const fileToBase64 = async (file: Blob): Promise<string> =>
	bytesToBase64(new Uint8Array(await file.arrayBuffer()));

/** Why a file cannot even be sent, or null when it can. */
export const fileProblem = (file: { size: number }): "empty" | "too_big" | null => {
	if (file.size === 0) return "empty";
	return file.size > MAX_FILE_BYTES ? "too_big" : null;
};

// ─── Brokers ────────────────────────────────────────────────────────────

/**
 * Brokers whose statements the server has a reader for
 * (`packages/broker-parsers/src/detect.ts`). An account at any other named
 * broker cannot take an upload yet; one at "another broker" takes these.
 */
export const BROKERS_READ: readonly Broker[] = ["zerodha"];

/**
 * Whether Kosh reads this broker's own files as downloaded. Every account
 * can be uploaded to either way — one at a broker Kosh has no reader for
 * takes Kosh's own layout.
 */
export const readsOwnFiles = (broker: Broker): boolean => broker === "manual" || BROKERS_READ.includes(broker);
/** @deprecated name kept for callers; see `readsOwnFiles`. */
export const canUploadTo = readsOwnFiles;

/** What the server calls the "broker" of a file in Kosh's own layout (`packages/broker-parsers/src/detect.ts`). */
export const OWN_LAYOUT = "template";

/** "zerodha" (as the server names a detected broker) → "Zerodha". */
export const brokerLabelOf = (slug: string): string =>
	slug in BROKER_LABEL && slug !== "manual"
		? BROKER_LABEL[slug as Broker]
		: slug.charAt(0).toUpperCase() + slug.slice(1);

/** The brokers Kosh reads, as words: "Zerodha". */
export const readableBrokers = (): string => listWords(BROKERS_READ.map((b) => BROKER_LABEL[b]));

// ─── Amounts, quantities, dates ─────────────────────────────────────────

/** "a", "a and b", "a, b and c". */
export const listWords = (items: readonly string[]): string => {
	if (items.length <= 1) return items[0] ?? "";
	return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

/**
 * A ledger amount without its sign (the words around it say which way it
 * went): paise only when there are some — "₹25,000", "₹23.60".
 */
export const ledgerMoney = (amount: string | number): string => {
	const n = Math.abs(Number(amount));
	const hasPaise = Math.round(n * 100) % 100 !== 0;
	return formatMoney(n, { decimals: hasPaise ? 2 : 0, sign: "never" });
};

/** A number of shares: "1200" → "1,200", "12.500" → "12.5". */
export const formatQuantity = (quantity: string | number): string => {
	const n = Number(quantity);
	if (!Number.isFinite(n)) return String(quantity);
	// Six places is finer than any broker's quantity and hides float noise.
	const [whole = "0", fraction = ""] = Math.abs(n).toFixed(6).split(".");
	const trimmed = fraction.replace(/0+$/, "");
	const body = trimmed ? `${groupIndian(whole)}.${trimmed}` : groupIndian(whole);
	return n < 0 ? `−${body}` : body;
};

/** What a holding becomes when one share becomes `oneBecomes`. */
export const quantityAfter = (before: string | number, oneBecomes: number): string =>
	formatQuantity(Number(before) * oneBecomes);

/** "51 became 102" — what a split or bonus did to a holding. */
export const quantityChange = (before: string | number, after: string | number): string =>
	SPLITS.became(formatQuantity(before), formatQuantity(after));

/** A ratio typed by a person: a number above zero the server will take, or null. */
export const parseRatio = (text: string): number | null => {
	const n = Number(text.trim());
	return text.trim() !== "" && Number.isFinite(n) && n > 0 && n <= 10_000 ? n : null;
};

/** "Bonus 1:1" → "1:1", for the tile beside the question. */
export const ratioMark = (announcement: string): string | null =>
	announcement.match(/\b(\d{1,3}\s*:\s*\d{1,3})\b/)?.[1]?.replace(/\s+/g, "") ?? null;

/** How a multiple reads: 2 → "twice", 0.5 → "half", 5 → "5 times". */
export const timesWords = (factor: number): string => {
	if (factor === 2) return "twice";
	if (factor === 0.5) return "half";
	return `${formatQuantity(factor)} times`;
};

/** Today as a calendar date in the viewer's own time zone. */
export const todayIso = (now: Date = new Date()): string => {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Whether a typed day is one the server will take: a whole date, not after `latest`. */
export const isUsableDay = (date: string, latest: string = todayIso()): boolean =>
	/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && date <= latest;

/** "3 Apr 2023 to 15 Apr 2026", or one day when both ends are the same. */
export const spanWords = (span: { from: string; to: string }): string =>
	span.from === span.to ? formatDate(span.from) : `${formatDate(span.from)} to ${formatDate(span.to)}`;

// ─── Questions ──────────────────────────────────────────────────────────

/** Whether a signed ledger amount came into the account or left it. */
export const lineSide = (amount: string): "credit" | "debit" => (Number(amount) > 0 ? "credit" : "debit");

/**
 * The answers that can be true of a line. Money that came in cannot have
 * been taken out to the bank, and the other way round — the server refuses
 * those, so they are not offered.
 */
export const answersFor = (amount: string): LineAnswer[] => {
	const impossible: LineAnswer = lineSide(amount) === "credit" ? "external_withdrawal" : "external_deposit";
	return LINE_ANSWERS.filter((answer) => answer !== impossible);
};

/** The server's own shape for an ISIN: two letters, nine letters or digits, a check digit. */
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

export const cleanIsin = (text: string): string => text.replace(/\s+/g, "").toUpperCase();
export const isIsin = (text: string): boolean => ISIN.test(cleanIsin(text));

/** The heading of a question card, for every kind of question. */
export const questionTitle = (question: Question): string => {
	switch (question.kind) {
		case "ledger_line":
			return QUESTIONS.ledgerLine.title;
		case "opening_balance":
			return QUESTIONS.opening.title;
		case "missing_isin":
			return QUESTIONS.isin.title;
		case "transfer":
			return QUESTIONS.transfer.title;
		case "corporate_action":
			return QUESTIONS.action.title(question.actionType);
		case "holding_mismatch":
			return QUESTIONS.mismatch.title(question.symbol);
	}
};

/** "bought 10 XYZ at ₹250" — a trade the broker listed without an ISIN. */
export const tradeWords = (question: Extract<Question, { kind: "missing_isin" }>): string =>
	(question.side === "buy" ? QUESTIONS.isin.bought : QUESTIONS.isin.sold)(
		formatQuantity(question.quantity),
		question.symbol,
		formatMoney(question.price, { decimals: 2 }),
	);

/** Questions in the order asked, with the ones skipped this visit moved to the end. */
export const orderQuestions = <Q extends { id: string }>(questions: readonly Q[], skipped: readonly string[]): Q[] => [
	...questions.filter((q) => !skipped.includes(q.id)),
	...skipped.flatMap((id) => questions.filter((q) => q.id === id)),
];

// ─── What Kosh read from a file ─────────────────────────────────────────

/** "A Zerodha tradebook, 5 Oct 2025 to 1 Nov 2025." Null when the file was not recognised. */
export const previewHeadline = (preview: StatementPreview): string | null => {
	if (!preview.detected) return null;
	const { broker, kind } = preview.detected;
	const span = preview.span ? spanWords(preview.span) : null;
	// A file in Kosh's own layout comes from no broker in particular.
	return broker === OWN_LAYOUT ? UPLOAD.headlineOwnLayout(kind, span) : UPLOAD.headline(brokerLabelOf(broker), kind, span);
};

export interface PreviewFact {
	key: "new" | "duplicate" | "questions" | "error";
	text: string;
	/** `plain` is simply so; `ask` and `bad` want the person's eye. */
	tone: "plain" | "ask" | "bad";
}

/**
 * What would happen to the file's lines, one sentence each: how many are
 * new, how many are already in (and skipped), how many Kosh will ask about,
 * how many it could not read.
 */
export const previewFacts = (
	summary: StatementPreview["summary"],
	kind: StatementKind | null = null,
): PreviewFact[] => {
	const facts: PreviewFact[] = [];
	if (summary.new > 0) facts.push({ key: "new", text: UPLOAD.facts.new(summary.new), tone: "plain" });
	if (summary.duplicate > 0)
		facts.push({ key: "duplicate", text: UPLOAD.facts.duplicate(summary.duplicate), tone: "plain" });
	if (summary.questions > 0)
		facts.push({ key: "questions", text: UPLOAD.facts.questions(summary.questions), tone: "ask" });
	else if (summary.new > 0)
		// A holdings statement is not asked about line by line: it is checked against Kosh's working.
		facts.push({
			key: "questions",
			text: kind === "holdings" ? UPLOAD.facts.holdingsCheck : UPLOAD.facts.noQuestions,
			tone: "plain",
		});
	if (summary.error > 0) facts.push({ key: "error", text: UPLOAD.facts.error(summary.error), tone: "bad" });
	return facts;
};

export interface ProblemWords {
	title: string;
	body: string;
	/** What to try next, for a file that cannot be read at all. */
	tryThis: string | null;
}

/** Why a file cannot go in, in the wording board's words. Null when it can. */
export const problemWords = (preview: StatementPreview, accountBroker: string | null): ProblemWords | null => {
	const problem = preview.problem;
	if (!problem) return null;
	const { code, message } = problem;
	if (code === "already_uploaded")
		return {
			title: UPLOAD.problemTitle.already_uploaded,
			body: preview.previous ? UPLOAD.alreadyWithFile(preview.previous.fileName, formatDay(preview.previous.at)) : message,
			tryThis: null,
		};
	if (code === "nothing_new")
		return {
			title: UPLOAD.problemTitle.nothing_new,
			// A file with no lines at all is the server's to describe.
			body: preview.summary.duplicate > 0 ? UPLOAD.alreadyLines(preview.summary.duplicate) : message,
			tryThis: null,
		};
	if (code === "wrong_broker")
		return {
			title: preview.detected
				? UPLOAD.wrongBrokerTitle(brokerLabelOf(preview.detected.broker))
				: UPLOAD.problemTitle.wrong_broker,
			body: message,
			tryThis: null,
		};
	return {
		title: UPLOAD.problemTitle[code],
		body: message,
		tryThis: code === "unreadable" || code === "unrecognised" ? UPLOAD.tryThis(accountBroker) : null,
	};
};

// ─── Uploads ────────────────────────────────────────────────────────────

/** "Today 10:42 · you · 214 lines" */
export const uploadLine = (upload: Upload, now: number = Date.now()): string =>
	(upload.status === "retracted" ? UPLOADS.undoneLine : UPLOADS.line)(
		formatWhen(upload.at, now),
		upload.byMe ? UPLOADS.you : upload.byName,
		upload.added,
	);

// ─── How complete the history is ────────────────────────────────────────

export interface HistoryItem {
	key: string;
	/** `ok`: in · `missing`: stands between the figures and the truth · `optional`: nice to have. */
	state: "ok" | "missing" | "optional";
	title: string;
	/** What it means, or what to upload to fix it. */
	detail?: string;
}

/** "2024-03" → "Mar 2024" */
const monthWords = (month: string): string => formatMonth(`${month}-01`);

/** The history, as a checklist: what is in, from when to when, what is missing and how to fix it. */
export const historyChecklist = (history: History): HistoryItem[] => {
	const items: HistoryItem[] = [];
	const { ledger, trades, holdings } = history;
	const hasTrades = trades !== null && trades.count > 0;

	if (ledger === null) {
		items.push({
			key: "ledger",
			state: "missing",
			title: HISTORY.noLedger,
			detail: hasTrades ? `${HISTORY.noLedgerFix} ${HISTORY.noLedgerButTrades}` : HISTORY.noLedgerFix,
		});
	} else {
		items.push({ key: "ledger", state: "ok", title: HISTORY.ledger(spanWords(ledger), ledger.lines) });

		const opening = Number(ledger.openingBalance);
		const amount = ledgerMoney(ledger.openingBalance);
		const from = formatDate(ledger.from);
		if (opening === 0) items.push({ key: "opening", state: "ok", title: HISTORY.startsFromZero });
		else if (ledger.openingExplained)
			items.push({
				key: "opening",
				state: "ok",
				title: HISTORY.openingExplained(amount, from),
				detail: HISTORY.openingExplainedNote,
			});
		else if (opening > 0)
			items.push({
				key: "opening",
				state: "missing",
				title: HISTORY.openingUnexplained(amount, from),
				detail: HISTORY.openingFix,
			});
		else
			items.push({
				key: "opening",
				state: "missing",
				title: HISTORY.openingOverdrawn(amount, from),
				detail: HISTORY.openingOverdrawnFix,
			});

		if (ledger.gaps.length === 0) items.push({ key: "gaps", state: "ok", title: HISTORY.noGaps });
		for (const gap of ledger.gaps)
			items.push({
				key: `gap:${gap.after}:${gap.before}`,
				state: "missing",
				title: HISTORY.gap(formatDate(gap.after), formatDate(gap.before), ledgerMoney(gap.missing)),
				detail: HISTORY.gapFix,
			});
	}

	if (trades !== null && hasTrades)
		items.push({ key: "trades", state: "ok", title: HISTORY.trades(spanWords(trades), trades.count) });
	else if (ledger === null || (trades !== null && trades.missingMonths.length > 0))
		items.push({ key: "trades", state: "missing", title: HISTORY.noTrades, detail: HISTORY.noTradesFix });
	// A ledger with no trade ever paid for: nothing is missing, there is just nothing to hold.
	else items.push({ key: "trades", state: "optional", title: HISTORY.noTrades, detail: HISTORY.noTradesNeeded });
	if (trades !== null && trades.missingMonths.length > 0)
		items.push({
			key: "months",
			state: "missing",
			title: HISTORY.missingMonths(listWords(trades.missingMonths.map(monthWords))),
			detail: HISTORY.missingMonthsFix,
		});

	items.push(
		holdings
			? {
					key: "holdings",
					state: "ok",
					title: HISTORY.holdings(formatDate(holdings.asOf), holdings.lines),
					detail: HISTORY.holdingsNote,
				}
			: { key: "holdings", state: "optional", title: HISTORY.noHoldings, detail: HISTORY.noHoldingsNote },
	);
	return items;
};

/** Whether anything at all is in: a history with nothing has no verdict yet. */
export const historyIsEmpty = (history: History): boolean =>
	history.ledger === null && history.trades === null && history.holdings === null;

// ─── Splits and bonuses ─────────────────────────────────────────────────

/** "28 Oct 2024 · 51 became 102", or that it was left out of this account. */
export const actionLine = (action: AppliedAction): string =>
	action.state === "declined"
		? SPLITS.declinedLine(formatDate(action.exDate))
		: SPLITS.line(formatDate(action.exDate), quantityChange(action.quantityBefore, action.quantityAfter));

/** Who stands behind it: Kosh from the exchange, or a person. */
export const actionBy = (action: AppliedAction): string => {
	if (action.state === "declined") return SPLITS.declinedBy(action.byName);
	if (action.source === "person") return SPLITS.recordedBy(action.byName);
	return action.by === "kosh" ? SPLITS.byKosh : SPLITS.byPerson(action.byName);
};
