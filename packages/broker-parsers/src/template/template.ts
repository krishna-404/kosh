import type { CashFlowClassification } from "@connected-repo/zod-schemas/enums.zod";
import { dec6, dec6ToString } from "../decimal6.js";
import { findHeaderRow, isBlankRow, type Table } from "../table.js";
import { isDecimalString, isValidDate, isValidIsin, type ParseResult, type RowError } from "../types.js";
import type { ZerodhaLedgerLine, ZerodhaLedgerMeta } from "../zerodha/ledger.js";
import type { ZerodhaTrade, ZerodhaTradebookMeta } from "../zerodha/tradebook.js";

/**
 * Kosh's own layout: two plain tables anyone can fill in from any broker's
 * statement, for accounts at brokers Kosh has no reader for yet.
 *
 *   Trades:  date | type | symbol | isin | quantity | price   (+ exchange, reference)
 *   Cash:    date | description | money in | money out | balance   (+ what)
 *
 * They are read into the same row shapes the Zerodha readers produce, so
 * everything after reading — duplicates, questions, undo — is the same code.
 * Column order does not matter; extra columns are ignored; a title or notes
 * above the header are fine.
 */
export const TEMPLATE_TRADES_HEADER = ["date", "type", "symbol", "isin", "quantity", "price"] as const;
export const TEMPLATE_CASH_HEADER = ["date", "description", "money in", "money out", "balance"] as const;

/** What a blank template looks like, for the "download the layout" link. */
export const TEMPLATE_TRADES_EXAMPLE = [
	"date,type,symbol,isin,quantity,price,exchange,reference",
	"2024-04-02,buy,INFY,INE009A01021,10,1480.50,NSE,",
	"2024-09-17,sell,INFY,INE009A01021,4,1905.00,NSE,",
].join("\n");
export const TEMPLATE_CASH_EXAMPLE = [
	"date,description,money in,money out,balance,what",
	"2024-04-01,Transfer from my bank,50000,,50000.00,put in",
	"2024-04-03,Paid for shares bought on 2 April,,14832.40,35167.60,for trades",
	"2024-06-30,Account maintenance charge,,354.00,34813.60,charges",
	"2024-09-20,Sent back to my bank,,10000,24813.60,taken out",
].join("\n");

const cell = (row: readonly string[], index: number | undefined): string => (index === undefined ? "" : (row[index] ?? "").trim());

/** 2024-04-02, 02-04-2024, 02/04/2024 or 2 Apr 2024 → 2024-04-02. Day comes first, as it is written in India. */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function readDate(text: string): string | null {
	const t = text.trim();
	let iso: string | null = null;
	let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
	if (m) iso = `${m[1]}-${(m[2] as string).padStart(2, "0")}-${(m[3] as string).padStart(2, "0")}`;
	m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
	if (m) iso = `${m[3]}-${(m[2] as string).padStart(2, "0")}-${(m[1] as string).padStart(2, "0")}`;
	m = /^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ,]+(\d{4})$/.exec(t);
	if (m) {
		const month = MONTHS.indexOf((m[2] as string).toLowerCase());
		if (month >= 0) iso = `${m[3]}-${String(month + 1).padStart(2, "0")}-${(m[1] as string).padStart(2, "0")}`;
	}
	return iso !== null && isValidDate(iso) ? iso : null;
}

/** "1,48,050.50", "₹ 1480.5" or "" → a plain decimal string ("" stays ""). Null when it is not a number. */
export function readNumber(text: string): string | null {
	const t = text.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
	if (t === "") return "";
	return isDecimalString(t) ? t : null;
}

/** A short, stable id for a trade that came with none: the same row in the same file always gets the same one. */
function fingerprint(text: string): string {
	let h = 0xcbf29ce484222325n;
	for (let i = 0; i < text.length; i++) {
		h ^= BigInt(text.charCodeAt(i));
		h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
	}
	return h.toString(16).padStart(16, "0");
}

const SIDES: Record<string, "buy" | "sell"> = { buy: "buy", b: "buy", bought: "buy", purchase: "buy", sell: "sell", s: "sell", sold: "sell", sale: "sell", redeem: "sell" };

export function parseTemplateTrades(table: Table): ParseResult<ZerodhaTrade, ZerodhaTradebookMeta> {
	const header = findHeaderRow(table, TEMPLATE_TRADES_HEADER);
	if (!header)
		return {
			rows: [],
			errors: [{ row: 0, code: "bad_header", message: `Not a trades table: it needs the columns ${TEMPLATE_TRADES_HEADER.join(", ")}` }],
			meta: { tradeDateSpan: null, segments: [] },
		};
	const col = (name: string) => header.columns.get(name);
	const rows: ZerodhaTrade[] = [];
	const errors: RowError[] = [];
	const seen = new Map<string, number>();

	table.slice(header.rowIndex + 1).forEach((record, i) => {
		if (isBlankRow(record)) return;
		const row = i + 1;
		const fail = (code: RowError["code"], message: string): void => {
			errors.push({ row, code, message });
		};

		const tradeDate = readDate(cell(record, col("date")));
		const side = SIDES[cell(record, col("type")).toLowerCase()];
		const symbol = cell(record, col("symbol")).toUpperCase();
		const isin = cell(record, col("isin")).toUpperCase();
		const quantity = readNumber(cell(record, col("quantity")));
		const price = readNumber(cell(record, col("price")));
		const exchangeRaw = cell(record, col("exchange")).toUpperCase();
		const reference = cell(record, col("reference"));

		if (tradeDate === null) return fail("bad_date", `Can’t read the date “${cell(record, col("date"))}” — write it like 2024-04-02 or 02-04-2024`);
		if (!side) return fail("bad_enum", `Type must be buy or sell, not “${cell(record, col("type"))}”`);
		if (symbol === "") return fail("missing_field", "The symbol is missing");
		if (isin !== "" && !isValidIsin(isin)) return fail("bad_isin", `“${isin}” isn’t an ISIN (12 letters and digits, like INE009A01021)`);
		if (quantity === null || quantity === "" || Number(quantity) <= 0) return fail("bad_number", `Can’t read the quantity “${cell(record, col("quantity"))}”`);
		if (price === null || price === "" || Number(price) < 0) return fail("bad_number", `Can’t read the price “${cell(record, col("price"))}”`);

		// Two identical fills on one day are two trades: the second gets a different id.
		const key = `${tradeDate}|${symbol}|${isin}|${side}|${quantity}|${price}`;
		const nth = seen.get(key) ?? 0;
		seen.set(key, nth + 1);
		const id = reference !== "" ? reference : `K${fingerprint(`${key}|${nth}`)}`;
		const fund = isin.startsWith("INF");
		rows.push({
			symbol,
			isin: isin === "" ? null : isin,
			tradeDate,
			exchange: exchangeRaw === "BSE" ? "BSE" : exchangeRaw === "" || exchangeRaw === "NSE" ? "NSE" : "other",
			segment: fund ? "MF" : "EQ",
			series: fund ? "MF" : "EQ",
			side,
			auction: false,
			quantity,
			price,
			brokerTradeId: id,
			brokerOrderId: id,
			executedAt: null,
		});
	});

	const dates = rows.map((r) => r.tradeDate).sort();
	return {
		rows,
		errors,
		meta: {
			tradeDateSpan: dates.length > 0 ? { from: dates[0] as string, to: dates[dates.length - 1] as string } : null,
			segments: [...new Set(rows.map((r) => r.segment))],
		},
	};
}

/** What the optional "what" column can say, and what Kosh takes it to mean. Anything else is asked about. */
const WHAT: Record<string, CashFlowClassification> = {
	"put in": "external_deposit",
	deposit: "external_deposit",
	"money in": "external_deposit",
	"taken out": "external_withdrawal",
	withdrawal: "external_withdrawal",
	"money out": "external_withdrawal",
	charges: "charge",
	charge: "charge",
	fees: "charge",
	fee: "charge",
	interest: "interest",
	"for trades": "trade_settlement",
	trades: "trade_settlement",
	settlement: "trade_settlement",
};

export interface TemplateCashLine extends ZerodhaLedgerLine {
	/** From the "what" column; null when it is blank or not one Kosh knows — the line is then asked about. */
	what: CashFlowClassification | null;
}

export function parseTemplateCash(table: Table): ParseResult<TemplateCashLine, ZerodhaLedgerMeta> {
	const empty: ZerodhaLedgerMeta = { openingBalance: null, closingBalance: null, postingDateSpan: null, voucherTypes: [] };
	const header = findHeaderRow(table, TEMPLATE_CASH_HEADER);
	if (!header)
		return {
			rows: [],
			errors: [{ row: 0, code: "bad_header", message: `Not a cash table: it needs the columns ${TEMPLATE_CASH_HEADER.join(", ")}` }],
			meta: empty,
		};
	const col = (name: string) => header.columns.get(name);
	const rows: TemplateCashLine[] = [];
	const errors: RowError[] = [];

	table.slice(header.rowIndex + 1).forEach((record, i) => {
		if (isBlankRow(record)) return;
		const row = i + 1;
		const fail = (code: RowError["code"], message: string): void => {
			errors.push({ row, code, message });
		};

		const postingDate = readDate(cell(record, col("date")));
		const description = cell(record, col("description"));
		const moneyIn = readNumber(cell(record, col("money in")));
		const moneyOut = readNumber(cell(record, col("money out")));
		const balance = readNumber(cell(record, col("balance")));
		const what = cell(record, col("what")).toLowerCase().replace(/\s+/g, " ");

		if (postingDate === null) return fail("bad_date", `Can’t read the date “${cell(record, col("date"))}” — write it like 2024-04-02 or 02-04-2024`);
		if (moneyIn === null || moneyOut === null) return fail("bad_number", "Can’t read the amount");
		if ((moneyIn === "" || Number(moneyIn) === 0) === (moneyOut === "" || Number(moneyOut) === 0))
			return fail("bad_number", "Give an amount under money in or under money out — one of them, not both");
		if (Number(moneyIn || "0") < 0 || Number(moneyOut || "0") < 0) return fail("bad_number", "Amounts are written without a minus sign");
		if (balance === null || balance === "") return fail("bad_number", "The balance after this line is missing");
		if (description === "") return fail("missing_field", "The description is missing");

		rows.push({
			row,
			particulars: description,
			postingDate,
			costCenter: "",
			voucherType: "",
			debit: dec6ToString(dec6(moneyOut || "0")),
			credit: dec6ToString(dec6(moneyIn || "0")),
			netBalance: dec6ToString(dec6(balance)),
			what: WHAT[what] ?? null,
		});
	});

	const first = rows[0];
	const last = rows[rows.length - 1];
	const dates = rows.map((r) => r.postingDate).sort();
	return {
		rows,
		errors,
		meta: {
			// What was in the account before the first line: its balance, less what the line did.
			openingBalance: first ? dec6ToString(dec6(first.netBalance) + dec6(first.debit) - dec6(first.credit)) : null,
			closingBalance: last ? last.netBalance : null,
			postingDateSpan: dates.length > 0 ? { from: dates[0] as string, to: dates[dates.length - 1] as string } : null,
			voucherTypes: [],
		},
	};
}
