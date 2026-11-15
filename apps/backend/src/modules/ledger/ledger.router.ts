import { listCashFlows, listTrades } from "@backend/modules/ledger/services/ledger_read.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import {
	cashFlowPageZod,
	ledgerPageInputZod,
	tradePageZod,
} from "@connected-repo/zod-schemas/kosh/statements.zod";

// One account's ledger, as read: money in and out, and trades. View is enough.

const cashFlows = rpcPortfolioProcedure
	.input(ledgerPageInputZod)
	.output(cashFlowPageZod)
	.handler(({ input }) => listCashFlows(input));

const trades = rpcPortfolioProcedure
	.input(ledgerPageInputZod.omit({ show: true }))
	.output(tradePageZod)
	.handler(({ input }) => listTrades(input));

export const ledgerRouter = { cashFlows, trades };
