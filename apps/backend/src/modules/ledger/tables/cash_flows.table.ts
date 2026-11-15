import { BaseTable } from "@backend/db/base_table";
import { getRequestContext } from "@backend/lib/request-context";

/**
 * THE fund-flow table — XIRR reads exactly this. `amount` is signed:
 * + into the account, − out of it. Only classification IN
 * ('external_deposit','external_withdrawal') enters money-weighted returns;
 * internal transfers must be paired via transferPairId so they net out at
 * group level. Every row traces to a raw ledger line
 * (sourceLedgerLineId — null for synthetic flows) and to its
 * `cash_flow_classified` event. inrAmount/fxRateUsed freeze the INR view at
 * classification time. See docs/kosh/02-domain-model.md §5.
 */
export class CashFlowTable extends BaseTable {
	readonly table = "cash_flows";

	columns = this.setColumns(
		(t) => ({
			id: t.ulidWithDefault().primaryKey(),
			accountId: t.ulid().foreignKey("broker_accounts", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			flowDate: t.date(),
			amount: t.moneyAmount(),
			currency: t.string(3),
			classification: t.cashFlowClassificationEnum(),
			// Links the two legs of an internal transfer (both rows point at
			// each other; pairing enforced at the service layer).
			transferPairId: t
				.ulid()
				.foreignKey("cash_flows", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
			sourceLedgerLineId: t
				.ulid()
				.foreignKey("raw_ledger_lines", "id", {
					onUpdate: "RESTRICT",
					onDelete: "RESTRICT",
				})
				.nullable(),
			classifiedEventId: t.ulid().foreignKey("events", "id", {
				onUpdate: "RESTRICT",
				onDelete: "RESTRICT",
			}),
			inrAmount: t.moneyAmount(),
			fxRateUsed: t.rate8().nullable(),
			/** False once the upload or answer that produced the row is undone. */
			isLive: t.boolean().default(true),
			/** `ledger_line`, or `opening_balance` (what the account held before the first line). */
			origin: t.string(24).default("ledger_line"),

			...t.timestampsAsNumbers(),
		}),
		(t) => [
			t.index(["accountId", "flowDate"]),
			// XIRR pulls external flows for an account set over a date range.
			t.index(["accountId", "classification", "flowDate"]),
		],
	);

	// Default access scope: only rows of accounts the caller can see.
	// Bypass with `.unscope('default')` only for code that has done its own check.
	scopes = this.setScopes({
		default: (q) => {
			const ctx = getRequestContext();
			return ctx ? q.where({ accountId: { in: [...ctx.accountIds] } }) : q;
		},
	});
}
