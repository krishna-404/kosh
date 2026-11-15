import { findHeaderRow, type Sheet } from "./table.js";

/**
 * Recognise a statement from its contents, so nobody has to say what kind
 * of file they are uploading. Each rule is the set of header columns that
 * only that export has; the first sheet that carries one wins.
 *
 * Adding a broker or an export = adding a rule here and a parser beside it.
 */
export type DetectedBroker = "zerodha";
export type DetectedKind = "tradebook" | "ledger" | "holdings" | "dividends";

export interface DetectedStatement {
	broker: DetectedBroker;
	kind: DetectedKind;
	/** Which sheet the statement is on. */
	sheet: string;
}

interface Rule {
	broker: DetectedBroker;
	kind: DetectedKind;
	/** Normalised header cells that must all be present in one row. */
	header: readonly string[];
}

const RULES: readonly Rule[] = [
	{
		broker: "zerodha",
		kind: "tradebook",
		header: ["symbol", "isin", "trade_date", "trade_type", "quantity", "price", "trade_id"],
	},
	{
		broker: "zerodha",
		kind: "ledger",
		header: ["particulars", "posting_date", "voucher_type", "debit", "credit", "net_balance"],
	},
	{
		broker: "zerodha",
		kind: "dividends",
		header: ["symbol", "isin", "ex-date", "quantity", "dividend per share", "net dividend amount"],
	},
	{
		broker: "zerodha",
		kind: "holdings",
		header: ["symbol", "isin", "quantity available", "average price"],
	},
];

export function detectStatement(sheets: readonly Sheet[]): DetectedStatement | null {
	for (const rule of RULES)
		for (const sheet of sheets)
			if (findHeaderRow(sheet.rows, rule.header))
				return { broker: rule.broker, kind: rule.kind, sheet: sheet.name };
	return null;
}
