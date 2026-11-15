import {
	addFeePayment,
	endFeeArrangement,
	getFeeOverview,
	removeFeePayment,
	setFeeArrangement,
} from "@backend/modules/fees/services/fees.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import { feeOverviewZod, feePaymentInputZod, feeSetInputZod } from "@connected-repo/zod-schemas/kosh/income.zod";
import { z } from "zod";

// A fund manager's fee on one account. Anyone who can see the account sees
// it (it changes what the return means); only an owner sets or changes it.

const ok = z.object({ ok: z.literal(true) });
const created = z.object({ id: z.string() });

const overview = rpcPortfolioProcedure
	.input(z.object({ accountId: z.string() }))
	.output(feeOverviewZod)
	.handler(({ input }) => getFeeOverview(input.accountId));

const set = rpcPortfolioProcedure
	.input(feeSetInputZod)
	.output(created)
	.handler(({ input }) => setFeeArrangement(input));

const end = rpcPortfolioProcedure
	.input(z.object({ accountId: z.string(), endsOn: z.iso.date() }))
	.output(ok)
	.handler(async ({ input }) => {
		await endFeeArrangement(input);
		return { ok: true as const };
	});

const addPayment = rpcPortfolioProcedure
	.input(feePaymentInputZod)
	.output(created)
	.handler(({ input }) => addFeePayment(input));

const removePayment = rpcPortfolioProcedure
	.input(z.object({ paymentId: z.string() }))
	.output(ok)
	.handler(async ({ input }) => {
		await removeFeePayment(input.paymentId);
		return { ok: true as const };
	});

export const feesRouter = { overview, set, end, addPayment, removePayment };
