import {
	changeDividend,
	confirmDividends,
	declineDividend,
	listDividends,
	recordDividend,
	reopenDividend,
} from "@backend/modules/dividends/services/dividends.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import {
	changeDividendInputZod,
	confirmDividendsInputZod,
	dividendListZod,
	recordDividendInputZod,
} from "@connected-repo/zod-schemas/kosh/income.zod";
import { z } from "zod";

// Dividends on one account. Anyone who can see the account sees them;
// confirming, changing and adding need edit.

const ok = z.object({ ok: z.literal(true) });
const one = z.object({ dividendId: z.string() });

const list = rpcPortfolioProcedure
	.input(z.object({ accountId: z.string() }))
	.output(dividendListZod)
	.handler(({ input }) => listDividends(input.accountId));

const confirm = rpcPortfolioProcedure
	.input(confirmDividendsInputZod)
	.output(z.object({ confirmed: z.number().int() }))
	.handler(({ input }) => confirmDividends(input));

const change = rpcPortfolioProcedure
	.input(changeDividendInputZod)
	.output(ok)
	.handler(async ({ input }) => {
		await changeDividend(input);
		return { ok: true as const };
	});

const notReceived = rpcPortfolioProcedure
	.input(one)
	.output(ok)
	.handler(async ({ input }) => {
		await declineDividend(input.dividendId);
		return { ok: true as const };
	});

const reopen = rpcPortfolioProcedure
	.input(one)
	.output(ok)
	.handler(async ({ input }) => {
		await reopenDividend(input.dividendId);
		return { ok: true as const };
	});

const record = rpcPortfolioProcedure
	.input(recordDividendInputZod)
	.output(z.object({ id: z.string() }))
	.handler(({ input }) => recordDividend(input));

export const dividendsRouter = { list, confirm, change, notReceived, reopen, record };
