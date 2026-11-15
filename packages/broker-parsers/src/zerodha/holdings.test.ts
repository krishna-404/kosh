import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv.js";
import { detectStatement } from "../detect.js";
import type { Table } from "../table.js";
import { parseZerodhaHoldings } from "./holdings.js";

const table = (name: string): Table => {
	const csv = parseCsv(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"));
	return [csv.header, ...csv.records];
};

// The holdings fixture is SYNTHETIC — written from Zerodha's published
// layout, not from a real export. Replace it with an anonymized real one
// when a sample is available.
describe("parseZerodhaHoldings", () => {
	const parsed = parseZerodhaHoldings(table("holdings.synthetic.csv"));

	it("finds the table under the preamble and stops at the totals", () => {
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows.map((r) => r.symbol)).toEqual(["ALPHAX", "BETAY", "GOLDBEES"]);
	});

	it("reads the statement's date from the title", () => {
		expect(parsed.meta.asOf).toBe("2025-12-31");
	});

	it("adds pledged shares to what is held, and does not double-count long-term", () => {
		expect(parsed.rows[0]).toMatchObject({
			isin: "INE000A01011",
			quantity: "150.000000",
			averagePrice: "410.25",
			previousClose: "512.40",
		});
		expect(parsed.rows[2]?.quantity).toBe("300.000000");
	});

	it("reports a row it cannot read instead of guessing", () => {
		const bad = table("holdings.synthetic.csv").map((row) =>
			row[0] === "BETAY" ? row.map((cell, i) => (i === 3 ? "forty" : cell)) : row,
		);
		const result = parseZerodhaHoldings(bad);
		expect(result.rows.map((r) => r.symbol)).toEqual(["ALPHAX", "GOLDBEES"]);
		expect(result.errors).toEqual([
			{ row: 2, code: "bad_number", message: "Invalid quantity available: forty" },
		]);
	});

	it("refuses a table that is not a holdings statement", () => {
		const result = parseZerodhaHoldings(table("tradebook.csv"));
		expect(result.rows).toEqual([]);
		expect(result.errors[0]?.code).toBe("bad_header");
	});
});

describe("detectStatement", () => {
	const detect = (name: string) => detectStatement([{ name: "csv", rows: table(name) }]);

	it("tells the three Zerodha statements apart by their columns", () => {
		expect(detect("tradebook.csv")).toMatchObject({ broker: "zerodha", kind: "tradebook" });
		expect(detect("ledger.csv")).toMatchObject({ broker: "zerodha", kind: "ledger" });
		expect(detect("holdings.synthetic.csv")).toMatchObject({ broker: "zerodha", kind: "holdings" });
	});

	it("looks through every sheet of a workbook", () => {
		expect(
			detectStatement([
				{ name: "Summary", rows: [["Nothing here"]] },
				{ name: "Equity", rows: table("holdings.synthetic.csv") },
			]),
		).toEqual({ broker: "zerodha", kind: "holdings", sheet: "Equity" });
	});

	it("recognises a dividend statement, and nothing in a file it does not know", () => {
		expect(
			detectStatement([
				{
					name: "Equity Dividends",
					rows: [
						["Client ID", "ZZ0000"],
						["Symbol", "ISIN", "Ex-Date", "Quantity", "Dividend Per Share", "Net Dividend Amount"],
					],
				},
			]),
		).toMatchObject({ kind: "dividends" });
		expect(detectStatement([{ name: "csv", rows: [["name", "amount"], ["x", "1"]] }])).toBeNull();
	});
});
