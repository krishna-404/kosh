import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv.js";
import { detectStatement } from "../detect.js";
import { validateZerodhaLedgerBalances } from "../zerodha/ledger-validator.js";
import {
	parseTemplateCash,
	parseTemplateTrades,
	readDate,
	readNumber,
	TEMPLATE_CASH_EXAMPLE,
	TEMPLATE_TRADES_EXAMPLE,
} from "./template.js";

const table = (text: string) => {
	const csv = parseCsv(text);
	return [csv.header, ...csv.records];
};

describe("Kosh's own layout", () => {
	it("reads dates and amounts the way people write them", () => {
		for (const text of ["2024-04-02", "02-04-2024", "2/4/2024", "02.04.2024", "2 Apr 2024", "02-April-2024"]) expect(readDate(text)).toBe("2024-04-02");
		expect(readDate("31-02-2024")).toBeNull();
		expect(readDate("April")).toBeNull();
		expect(readNumber("1,48,050.50")).toBe("148050.50");
		expect(readNumber("₹ 1480.5")).toBe("1480.5");
		expect(readNumber("")).toBe("");
		expect(readNumber("ten")).toBeNull();
	});

	it("is recognised from its columns, like any other statement", () => {
		expect(detectStatement([{ name: "csv", rows: table(TEMPLATE_TRADES_EXAMPLE) }])).toMatchObject({ broker: "template", kind: "tradebook" });
		expect(detectStatement([{ name: "csv", rows: table(TEMPLATE_CASH_EXAMPLE) }])).toMatchObject({ broker: "template", kind: "ledger" });
	});

	it("reads the example trades", () => {
		const { rows, errors, meta } = parseTemplateTrades(table(TEMPLATE_TRADES_EXAMPLE));
		expect(errors).toEqual([]);
		expect(rows).toEqual([
			expect.objectContaining({ symbol: "INFY", isin: "INE009A01021", tradeDate: "2024-04-02", side: "buy", quantity: "10", price: "1480.50", exchange: "NSE" }),
			expect.objectContaining({ tradeDate: "2024-09-17", side: "sell", quantity: "4" }),
		]);
		expect(meta.tradeDateSpan).toEqual({ from: "2024-04-02", to: "2024-09-17" });
	});

	it("gives each trade an id that is the same every time, and different for a second identical fill", () => {
		const text = ["Date,Type,Symbol,ISIN,Quantity,Price", "02-04-2024,Buy,infy,,10,1480.5", "02-04-2024,Buy,infy,,10,1480.5", "03-04-2024,sold,INFY,,5,1500"].join("\n");
		const first = parseTemplateTrades(table(text)).rows.map((r) => r.brokerTradeId);
		const again = parseTemplateTrades(table(text)).rows.map((r) => r.brokerTradeId);
		expect(first).toEqual(again);
		expect(new Set(first).size).toBe(3);
		// No ISIN is allowed: the trade is still read, and asked about later.
		expect(parseTemplateTrades(table(text)).rows[0]).toMatchObject({ isin: null, symbol: "INFY" });
		// A reference from the broker is used as it is.
		const withRef = parseTemplateTrades(table("date,type,symbol,isin,quantity,price,reference\n2024-04-02,buy,INFY,,1,1,CN-77")).rows[0];
		expect(withRef?.brokerTradeId).toBe("CN-77");
	});

	it("says what is wrong with a line, in words", () => {
		const { rows, errors } = parseTemplateTrades(
			table(
				["date,type,symbol,isin,quantity,price", "sometime,buy,INFY,,1,1", "2024-04-02,hold,INFY,,1,1", "2024-04-02,buy,INFY,NOTANISIN,1,1", "2024-04-02,buy,INFY,,0,1", "2024-04-02,buy,,,1,1"].join(
					"\n",
				),
			),
		);
		expect(rows).toEqual([]);
		expect(errors.map((e) => [e.row, e.code])).toEqual([
			[1, "bad_date"],
			[2, "bad_enum"],
			[3, "bad_isin"],
			[4, "bad_number"],
			[5, "missing_field"],
		]);
	});

	it("reads the example cash table, and its balances add up", () => {
		const parsed = parseTemplateCash(table(TEMPLATE_CASH_EXAMPLE));
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows.map((r) => [r.postingDate, r.debit, r.credit, r.what])).toEqual([
			["2024-04-01", "0.000000", "50000.000000", "external_deposit"],
			["2024-04-03", "14832.400000", "0.000000", "trade_settlement"],
			["2024-06-30", "354.000000", "0.000000", "charge"],
			["2024-09-20", "10000.000000", "0.000000", "external_withdrawal"],
		]);
		expect(parsed.meta).toMatchObject({ openingBalance: "0.000000", closingBalance: "24813.600000" });
		expect(validateZerodhaLedgerBalances(parsed.rows, parsed.meta).errors).toEqual([]);
	});

	it("starts from whatever was already in the account, and catches a balance that does not follow", () => {
		const later = parseTemplateCash(table("date,description,money in,money out,balance\n2025-01-05,More from my bank,\"1,000\",,25813.60\n2025-01-09,Something,,13.60,25800"));
		expect(later.meta.openingBalance).toBe("24813.600000");
		expect(later.rows.map((r) => r.what)).toEqual([null, null]); // no "what": each will be asked about
		expect(validateZerodhaLedgerBalances(later.rows, later.meta).errors).toEqual([]);

		const wrong = parseTemplateCash(table("date,description,money in,money out,balance\n2025-01-05,A,1000,,1000\n2025-01-09,B,,100,950"));
		expect(validateZerodhaLedgerBalances(wrong.rows, wrong.meta).errors).toHaveLength(1);

		const bad = parseTemplateCash(table("date,description,money in,money out,balance\n2025-01-05,A,1000,500,1000\n2025-01-06,B,,,10\n2025-01-07,,5,,15\n2025-01-08,C,5,,"));
		expect(bad.errors.map((e) => e.row)).toEqual([1, 2, 3, 4]);
	});
});
