import { dec6, dec6ToString } from "../decimal6.js";
import { findHeaderRow, isBlankRow, normaliseCell, type Table } from "../table.js";
import { isDecimalString, isValidDate, isValidIsin, type ParseResult, type RowError } from "../types.js";

/**
 * Zerodha Console holdings statement (the "Equity" sheet of the holdings
 * XLSX, or the same table saved as CSV) → what the broker says is held.
 *
 * Kosh never takes positions from this file — positions come from trades.
 * It is the cross-check: what Kosh works out should match what the broker
 * reports, and where it does not, something (a split, a bonus, a transfer,
 * a missing tradebook) needs explaining.
 *
 * ⚠ Written from the published layout, not from a real export (none has been
 * provided yet — docs/research/broker-exports.md). The header is located by
 * content and only the columns below are required, so extra or reordered
 * columns do not break it; the fixture is synthetic and says so.
 *
 * Header (as published):
 *   Symbol | ISIN | Sector | Quantity Available | Quantity Discrepant |
 *   Quantity Long Term | Quantity Pledged (Margin) | Quantity Pledged (Loan) |
 *   Average Price | Previous Closing Price | Unrealized P&L | Unrealized P&L Pct.
 */
export interface ZerodhaHolding {
	/** 1-based index among the data rows. */
	row: number;
	symbol: string;
	isin: string | null;
	/**
	 * Everything held: available + discrepant + pledged. ("Long term" is a
	 * part of available, not in addition to it.)
	 */
	quantity: string;
	averagePrice: string | null;
	/** The broker's own previous close, when the file gives one. */
	previousClose: string | null;
}

export interface ZerodhaHoldingsMeta {
	/** The date the statement is for, when the file states it. YYYY-MM-DD. */
	asOf: string | null;
}

const REQUIRED = ["symbol", "isin", "quantity available", "average price"] as const;
const EXTRA_QUANTITY = [
	"quantity discrepant",
	"quantity pledged (margin)",
	"quantity pledged (loan)",
] as const;

const AS_OF = /as on\s+(\d{4}-\d{2}-\d{2})/i;

export function parseZerodhaHoldings(
	table: Table,
): ParseResult<ZerodhaHolding, ZerodhaHoldingsMeta> {
	const errors: RowError[] = [];
	const header = findHeaderRow(table, REQUIRED);
	if (!header) {
		errors.push({
			row: 0,
			code: "bad_header",
			message: `Not a Zerodha holdings statement: missing column(s) ${REQUIRED.join(", ")}`,
		});
		return { rows: [], errors, meta: { asOf: null } };
	}

	// "Equity Holdings Statement as on 2026-11-13" sits somewhere above the header.
	let asOf: string | null = null;
	for (const row of table.slice(0, header.rowIndex))
		for (const cell of row) {
			const match = AS_OF.exec(cell ?? "");
			if (match?.[1] && isValidDate(match[1])) asOf = match[1];
		}

	const cell = (row: readonly string[], name: string): string => {
		const index = header.columns.get(name);
		return index === undefined ? "" : (row[index] ?? "").trim();
	};

	const rows: ZerodhaHolding[] = [];
	let n = 0;
	for (const record of table.slice(header.rowIndex + 1)) {
		if (isBlankRow(record)) continue;
		const symbol = cell(record, "symbol");
		// Totals and footnotes follow the table; they have no ISIN column value
		// and no symbol that looks like one.
		if (symbol === "" || /^total/i.test(normaliseCell(symbol))) continue;
		n++;
		const fail = (code: RowError["code"], message: string) =>
			errors.push({ row: n, code, message });

		const isin = cell(record, "isin");
		if (isin !== "" && !isValidIsin(isin)) {
			fail("bad_isin", `Invalid ISIN: ${isin}`);
			continue;
		}
		let quantity = 0n;
		let bad = false;
		for (const name of ["quantity available", ...EXTRA_QUANTITY]) {
			const value = cell(record, name);
			if (value === "") continue;
			if (!isDecimalString(value)) {
				fail("bad_number", `Invalid ${name}: ${value}`);
				bad = true;
				break;
			}
			quantity += dec6(value);
		}
		if (bad) continue;
		const averagePrice = cell(record, "average price");
		if (averagePrice !== "" && !isDecimalString(averagePrice)) {
			fail("bad_number", `Invalid average price: ${averagePrice}`);
			continue;
		}
		const previousClose = cell(record, "previous closing price");

		rows.push({
			row: n,
			symbol,
			isin: isin === "" ? null : isin,
			quantity: dec6ToString(quantity),
			averagePrice: averagePrice === "" ? null : averagePrice,
			previousClose: isDecimalString(previousClose) ? previousClose : null,
		});
	}

	return { rows, errors, meta: { asOf } };
}
