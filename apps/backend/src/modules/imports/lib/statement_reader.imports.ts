import { parseCsv } from "@connected-repo/broker-parsers/csv";
import type { Sheet } from "@connected-repo/broker-parsers/table";
import readXlsxFile from "read-excel-file/node";

/**
 * Turn an uploaded file's bytes into grids of text cells — one per sheet for
 * a spreadsheet, a single one for a CSV. Everything after this (recognising
 * the statement, parsing it) works on those grids and on the CSV text.
 */
export interface ReadStatement {
	format: "csv" | "xlsx";
	sheets: Sheet[];
	/** The file as text, for the CSV-based parsers. Null for a spreadsheet. */
	text: string | null;
}

/** Thrown for a file Kosh cannot open at all; the message is for the person uploading. */
export class UnreadableStatementError extends Error {}

const isZip = (bytes: Buffer): boolean =>
	bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

/** The old binary .xls format (OLE compound file). */
const isLegacyXls = (bytes: Buffer): boolean =>
	bytes.length > 7 && bytes.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"));

const pad = (n: number) => String(n).padStart(2, "0");

/** A spreadsheet cell as the text a CSV of the same sheet would hold. */
const cellText = (value: unknown): string => {
	if (value === null || value === undefined) return "";
	if (value instanceof Date)
		return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
	return String(value).trim();
};

export async function readStatement(bytes: Buffer): Promise<ReadStatement> {
	if (bytes.length === 0) throw new UnreadableStatementError("This file is empty.");
	if (isLegacyXls(bytes))
		throw new UnreadableStatementError(
			"This is an old-style .xls file. Open it and save it as .xlsx or .csv, then upload that.",
		);

	if (isZip(bytes)) {
		try {
			const workbook = await readXlsxFile(bytes);
			return {
				format: "xlsx",
				text: null,
				sheets: workbook.map((sheet) => ({
					name: sheet.sheet,
					rows: sheet.data.map((row) => row.map(cellText)),
				})),
			};
		} catch {
			throw new UnreadableStatementError(
				"Kosh couldn’t open this spreadsheet. If it is password-protected, remove the password and upload it again.",
			);
		}
	}

	// Anything else is read as text. A PDF or an image is not a statement
	// Kosh can read, and decodes to nonsense — say so plainly.
	if (bytes.subarray(0, 5).toString("latin1") === "%PDF-")
		throw new UnreadableStatementError(
			"This is a PDF. Download the statement as CSV or Excel from your broker and upload that.",
		);
	const text = bytes.toString("utf8").replace(/^﻿/, "");
	if (text.includes("\u0000"))
		throw new UnreadableStatementError("Kosh reads .csv and .xlsx statements. This file is neither.");
	const csv = parseCsv(text);
	return { format: "csv", text, sheets: [{ name: "csv", rows: [csv.header, ...csv.records] }] };
}
