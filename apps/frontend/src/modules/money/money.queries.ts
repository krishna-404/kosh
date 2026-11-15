import type { Period, Scope } from "@connected-repo/zod-schemas/kosh/money.zod";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * The money figures, one hook per question. Every one takes the scope (which
 * accounts) and, where it matters, the period — the same pair the address
 * carries (see `scope.ts`). While a new scope or period loads, the figures
 * already on screen stay put (`isPlaceholderData` says they are the old ones).
 */

/** Value, return, the same money elsewhere, how the money moved. */
export const useReturns = (scope: Scope, period: Period = "all") =>
	useQuery(orpc.money.returns.queryOptions({ input: { scope, period }, placeholderData: keepPreviousData }));

/** Each script against NIFTY on its own buys and sells. */
export const useHoldings = (scope: Scope, includeSold = false) =>
	useQuery(orpc.money.holdings.queryOptions({ input: { scope, includeSold }, placeholderData: keepPreviousData }));

/** One script: where it is held, its trades, its price. */
export const useScript = (instrumentId: string | undefined, scope: Scope) =>
	useQuery(
		orpc.money.script.queryOptions({
			input: { instrumentId: instrumentId ?? "", scope },
			enabled: Boolean(instrumentId),
		}),
	);

/** The caller's groups, each judged on its own money. */
export const useGroupsCompared = (period: Period = "all") =>
	useQuery(orpc.money.groups.queryOptions({ input: { period }, placeholderData: keepPreviousData }));

/** One group's deposits and withdrawals, run through the others' returns. */
export const useWhatIf = (groupId: string | null, period: Period = "all") =>
	useQuery(
		orpc.money.whatIf.queryOptions({
			input: { groupId: groupId ?? "", period },
			enabled: groupId !== null,
			placeholderData: keepPreviousData,
		}),
	);

/** How fresh prices are — shown wherever a figure depends on them. */
export const useMarketStatus = () => useQuery(orpc.money.market.queryOptions());

/**
 * After anything that changes what the figures are built from — an upload,
 * an undo, an answer, a split applied, a dividend confirmed, a fee set —
 * refetch every figure on screen, the questions, the uploads, dividends,
 * fees and the lists that carry values.
 */
export const useRefreshMoney = () => {
	const queryClient = useQueryClient();
	return useCallback(
		() =>
			Promise.all(
				[
					orpc.money,
					orpc.questions,
					orpc.imports,
					orpc.ledger,
					orpc.dividends,
					orpc.fees,
					orpc.portfolio,
					orpc.activity,
				].map((router) =>
					queryClient.invalidateQueries({ queryKey: router.key() }),
				),
			),
		[queryClient],
	);
};
