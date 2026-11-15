/**
 * A statement as a grid of text cells — what both a CSV and a spreadsheet
 * sheet reduce to. Detection and the spreadsheet-based parsers work on this
 * so they do not care which of the two a broker happened to export.
 */
export type Table = string[][];

export interface Sheet {
	/** The sheet's name; "csv" for a CSV file. */
	name: string;
	rows: Table;
}

/** Lower-case, trim and collapse inner whitespace: "Quantity  Available " → "quantity available". */
export const normaliseCell = (cell: string | undefined): string =>
	(cell ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export interface HeaderMatch {
	/** Index of the header row in the table. */
	rowIndex: number;
	/** Normalised header text → column index. */
	columns: Map<string, number>;
}

/**
 * Find the header row by content, not position. Broker spreadsheets carry a
 * preamble (a guide link, a client block, a title) before the real header,
 * and its length changes between exports.
 */
export function findHeaderRow(
	table: Table,
	required: readonly string[],
	searchRows = 40,
): HeaderMatch | null {
	const limit = Math.min(table.length, searchRows);
	for (let rowIndex = 0; rowIndex < limit; rowIndex++) {
		const columns = new Map<string, number>();
		(table[rowIndex] ?? []).forEach((cell, i) => {
			const key = normaliseCell(cell);
			if (key && !columns.has(key)) columns.set(key, i);
		});
		if (required.every((name) => columns.has(name))) return { rowIndex, columns };
	}
	return null;
}

/** A row with nothing in it. */
export const isBlankRow = (row: readonly string[]): boolean =>
	row.every((cell) => (cell ?? "").trim() === "");
