import { db } from "@backend/db/db";
import { addDays, todayInIndia } from "@backend/modules/metrics/services/dates.metrics";
import { bumpLedger, getAccountSeries, setFeeSource } from "@backend/modules/metrics/services/series.metrics.service";
import {
	atLeast,
	inList,
	requireAccess,
	requireAccountLevel,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import type { FeeArrangement, FeeOverview } from "@connected-repo/zod-schemas/kosh/income.zod";
import { ORPCError } from "@orpc/server";
import { type FeeTerms, feeCharges } from "./fee_charges";

// What a fund manager or adviser is paid for an account, when the money
// comes from outside the account. Only an owner sets it; everyone who can
// see the account sees it, because it changes what the return means.

const bad = (message: string) => new ORPCError("BAD_REQUEST", { status: 400, message });
const round2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);

const COLUMNS = ["id", "accountId", "kind", "payee", "rate", "amountPerYear", "hurdleRate", "startsOn", "endsOn"] as const;
type Row = {
	id: string;
	accountId: string;
	kind: string;
	payee: string | null;
	rate: string | null;
	amountPerYear: string | null;
	hurdleRate: string | null;
	startsOn: string;
	endsOn: string | null;
};

const shown = (row: Row): FeeArrangement => ({
	id: row.id,
	kind: row.kind as FeeArrangement["kind"],
	payee: row.payee,
	rate: row.rate === null ? null : Number(row.rate),
	amountPerYear: row.amountPerYear,
	hurdleRate: row.hurdleRate === null ? null : Number(row.hurdleRate),
	startsOn: row.startsOn,
	endsOn: row.endsOn,
});
const terms = (row: Row): FeeTerms => ({
	kind: row.kind as FeeTerms["kind"],
	rate: row.rate === null ? null : Number(row.rate),
	amountPerYear: row.amountPerYear === null ? null : Number(row.amountPerYear),
	hurdleRate: row.hurdleRate === null ? null : Number(row.hurdleRate),
	startsOn: row.startsOn,
	endsOn: row.endsOn,
});

// The day-by-day series asks what an account was charged.
setFeeSource(async (accountId, account) => {
	const arrangements = await db.feeArrangements.where({ accountId, isLive: true }).select(...COLUMNS);
	if (arrangements.length === 0) return [];
	const payments = await db.feePayments.where({ accountId, isLive: true }).select("paidOn", "amount");
	return feeCharges({
		terms: arrangements.map(terms),
		payments: payments.map((p) => ({ date: p.paidOn, amount: Number(p.amount) })),
		start: account.start,
		today: account.today,
		valueOn: account.valueOn,
		flows: account.flows,
	});
});

/** The arrangement running today on each of these accounts (for lists of accounts). */
export async function currentArrangements(accountIds: readonly string[]): Promise<Map<string, FeeArrangement>> {
	const out = new Map<string, FeeArrangement>();
	if (accountIds.length === 0) return out;
	const today = todayInIndia();
	const rows = await db.feeArrangements
		.where({ accountId: { in: inList(accountIds) }, isLive: true })
		.order({ startsOn: "ASC" })
		.select(...COLUMNS);
	for (const row of rows) if (row.startsOn <= today && (row.endsOn === null || row.endsOn >= today)) out.set(row.accountId, shown(row));
	return out;
}

export async function getFeeOverview(accountId: string): Promise<FeeOverview> {
	const ctx = requireAccess();
	requireAccountLevel(accountId, "view");
	const account = await db.brokerAccounts.where({ id: accountId }).select("id", "label").take();
	const today = todayInIndia();
	const rows = await db.feeArrangements.where({ accountId, isLive: true }).order({ startsOn: "DESC" }).select(...COLUMNS);
	const current = rows.find((r) => r.startsOn <= today && (r.endsOn === null || r.endsOn >= today)) ?? rows.find((r) => r.startsOn > today);
	const payments = await db.feePayments
		.where({ accountId, isLive: true })
		.order({ paidOn: "DESC" })
		.select("id", "paidOn", "amount", "note");
	const [series] = await getAccountSeries([accountId]);
	const charges = series?.managerFees ?? [];
	return {
		account,
		canChange: atLeast(ctx.accountLevels.get(accountId), "owner"),
		arrangement: current ? shown(current) : null,
		earlier: rows.filter((r) => r.id !== current?.id).map(shown),
		payments: payments.map((p) => ({ id: p.id, paidOn: p.paidOn, amount: p.amount, note: p.note })),
		charges: charges.map((c) => ({ date: c.date, amount: round2(c.amount), accrued: c.accrued })),
		total: round2(charges.reduce((sum, c) => sum + c.amount, 0)),
	};
}

async function note(accountId: string, userId: string, kind: "fee_schedule_set" | "fee_charged", payload: Record<string, unknown>) {
	await db.events.create({ accountId, kind, payload, actor: "user", userId, occurredAt: Date.now() });
}

/**
 * Set what the manager is paid from `startsOn`. Whatever was running then
 * ends the day before; anything that would have started later is replaced.
 * Nothing is deleted: replaced rows are kept, marked not live.
 */
export async function setFeeArrangement(input: {
	accountId: string;
	kind: FeeArrangement["kind"];
	payee?: string;
	rate?: number;
	amountPerYear?: string;
	hurdleRate?: number;
	startsOn: string;
	endsOn?: string;
}): Promise<{ id: string }> {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "owner");
	return db.$transaction(async () => {
		const standing = await db.feeArrangements.where({ accountId: input.accountId, isLive: true }).select("id", "startsOn", "endsOn");
		for (const row of standing) {
			if (row.startsOn >= input.startsOn) await db.feeArrangements.where({ id: row.id }).update({ isLive: false });
			else if (row.endsOn === null || row.endsOn >= input.startsOn)
				await db.feeArrangements.where({ id: row.id }).update({ endsOn: addDays(input.startsOn, -1) });
		}
		const created = await db.feeArrangements.create({
			accountId: input.accountId,
			kind: input.kind,
			payee: input.payee ?? null,
			rate: input.kind === "percent_of_assets" || input.kind === "profit_share" ? String(input.rate) : null,
			amountPerYear: input.kind === "fixed" ? (input.amountPerYear ?? null) : null,
			hurdleRate: input.kind === "profit_share" ? String(input.hurdleRate ?? 0) : null,
			startsOn: input.startsOn,
			endsOn: input.endsOn ?? null,
			createdByUserId: userId,
		});
		await note(input.accountId, userId, "fee_schedule_set", { arrangementId: created.id, kind: input.kind });
		await bumpLedger(input.accountId);
		return { id: created.id };
	});
}

/** Stop the arrangement: nothing is charged after `endsOn`. */
export async function endFeeArrangement(input: { accountId: string; endsOn: string }): Promise<void> {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "owner");
	const running = await db.feeArrangements
		.where({ accountId: input.accountId, isLive: true })
		.order({ startsOn: "DESC" })
		.select("id", "startsOn", "endsOn");
	const current = running.find((r) => r.startsOn <= input.endsOn && (r.endsOn === null || r.endsOn >= input.endsOn));
	if (!current) throw bad("There is no arrangement running on that day.");
	await db.$transaction(async () => {
		await db.feeArrangements.where({ id: current.id }).update({ endsOn: input.endsOn });
		for (const later of running) if (later.startsOn > input.endsOn) await db.feeArrangements.where({ id: later.id }).update({ isLive: false });
		await note(input.accountId, userId, "fee_schedule_set", { arrangementId: current.id, ended: input.endsOn });
		await bumpLedger(input.accountId);
	});
}

/** A fee actually paid, for an arrangement billed by invoice. */
export async function addFeePayment(input: { accountId: string; paidOn: string; amount: string; note?: string }): Promise<{ id: string }> {
	const { userId } = requireAccess();
	requireAccountLevel(input.accountId, "owner");
	if (input.paidOn > todayInIndia()) throw bad("That date hasn’t come yet.");
	if (Number(input.amount) <= 0) throw bad("The amount has to be more than zero.");
	const created = await db.feePayments.create({
		accountId: input.accountId,
		paidOn: input.paidOn,
		amount: round2(Number(input.amount)),
		note: input.note ?? null,
		createdByUserId: userId,
	});
	await note(input.accountId, userId, "fee_charged", { paymentId: created.id, amount: created.amount });
	await bumpLedger(input.accountId);
	return { id: created.id };
}

export async function removeFeePayment(paymentId: string): Promise<void> {
	const { userId } = requireAccess();
	const payment = await db.feePayments.where({ id: paymentId, isLive: true }).select("id", "accountId").takeOptional();
	if (!payment) throw new ORPCError("NOT_FOUND", { status: 404, message: "Payment not found" });
	requireAccountLevel(payment.accountId, "owner");
	await db.feePayments.where({ id: payment.id }).update({ isLive: false });
	await note(payment.accountId, userId, "fee_charged", { paymentId: payment.id, removed: true });
	await bumpLedger(payment.accountId);
}
