import { db } from "@backend/db/db";
import { getMarketState } from "@backend/modules/market-data/services/prices.market.service";
import { requestMarketSync } from "@backend/modules/market-data/services/sync.market.service";
import { getGroupsCompared, getWhatIf } from "@backend/modules/metrics/services/groups.metrics.service";
import { getHoldings, getScript } from "@backend/modules/metrics/services/holdings.metrics.service";
import { marketSyncEnabled } from "@backend/modules/metrics/services/ledger_changed";
import { getReturns } from "@backend/modules/metrics/services/returns.metrics.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import {
	groupsComparedZod,
	holdingsInputZod,
	holdingsZod,
	marketStatusZod,
	moneyInputZod,
	periodZod,
	returnsZod,
	scriptInputZod,
	scriptZod,
	whatIfInputZod,
	whatIfZod,
} from "@connected-repo/zod-schemas/kosh/money.zod";
import { z } from "zod";

// Value, returns and "the same money elsewhere". Every endpoint takes a
// selection of accounts and works only over the ones the caller can see —
// the selection is resolved against their access, and the tables underneath
// are scoped to it as well.

// Value, return, the same money in NIFTY and gold, and what moved it.
const returns = rpcPortfolioProcedure
	.input(moneyInputZod)
	.output(returnsZod)
	.handler(({ input }) => getReturns(input.scope, input.period));

// Every share and fund held, each against NIFTY on the same buys and sells.
const holdings = rpcPortfolioProcedure
	.input(holdingsInputZod)
	.output(holdingsZod)
	.handler(({ input }) => getHoldings(input.scope, input.includeSold));

// One share or fund: where it is held, its buys and sells, its price.
const script = rpcPortfolioProcedure
	.input(scriptInputZod)
	.output(scriptZod)
	.handler(({ input }) => getScript(input.scope, input.instrumentId));

// The caller's groups, side by side.
const groups = rpcPortfolioProcedure
	.input(z.object({ period: periodZod.default("all") }))
	.output(groupsComparedZod)
	.handler(({ input }) => getGroupsCompared(input.period));

const whatIf = rpcPortfolioProcedure
	.input(whatIfInputZod)
	.output(whatIfZod)
	.handler(({ input }) => getWhatIf(input.groupId, input.period));

// Where prices stand, and a nudge to fetch what is missing. Fetching is a
// background job shared by everyone; asking for it twice does nothing extra.
const market = rpcPortfolioProcedure.output(marketStatusZod).handler(async () => {
	const state = await getMarketState();
	const newest = await db.priceBars.order({ barDate: "DESC" }).select("barDate").takeOptional();
	// Something is held that the price files have never been gone through for.
	const waiting = await db.$query<{ n: string }>`
		SELECT count(*)::text AS n FROM instruments i
		WHERE i.priced_through IS NULL AND i.slug IS NULL
			AND EXISTS (SELECT 1 FROM trades t WHERE t.instrument_id = i.id AND t.is_live)`;
	const loading = Number(waiting.rows[0]?.n ?? 0) > 0;
	if (loading && marketSyncEnabled()) requestMarketSync();
	return {
		pricesAsOf: newest?.barDate ?? null,
		lastSyncAt: state.lastSyncAt,
		// The detail of a failed fetch (addresses, symbols, error text) is for
		// the server's log; people are told only that it did not finish.
		note: state.lastSyncOk ? state.lastSyncNote : null,
		trouble: state.lastSyncOk ? null : SYNC_TROUBLE,
		loading,
	};
});

const SYNC_TROUBLE = "Kosh couldn’t reach the exchange or the fund-price service on its last try";

export const moneyRouter = { returns, holdings, script, groups, whatIf, market };
