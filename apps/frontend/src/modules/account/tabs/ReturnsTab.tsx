import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { MONEY } from "@frontend/copy/money.copy";
import { Caveats } from "@frontend/modules/money/components/Caveats";
import { useReturns } from "@frontend/modules/money/money.queries";
import { useScope } from "@frontend/modules/money/scope";
import { useMemo } from "react";
import type { AccountInfo } from "../account.types";
import { PeriodRow } from "../components/PeriodRow";
import { LoadFailed, NothingYet, Refreshing } from "../components/TabStates";
import { AboutAccount, BiggestHoldings, QuestionsCard } from "./returns/AsideCards";
import { ReturnStats } from "./returns/ReturnStats";
import { SameMoneyCard } from "./returns/SameMoneyCard";

const card = { borderRadius: 2.5 } as const;

/**
 * Returns: what the account is worth, what went in and came out, the yearly
 * rate that connects them — and what the very same money would be worth in
 * NIFTY 50 and in gold. Beside it: questions still open, the biggest
 * holdings, and how the reader came to see this account.
 */
export const ReturnsTab = ({ info }: { info: AccountInfo }) => {
	const { period } = useScope();
	const scope = useMemo(() => ({ kind: "account" as const, id: info.account.id }), [info.account.id]);
	const returns = useReturns(scope, period);
	const data = returns.data;

	// The aside is true of the account whatever the figures are doing, so it
	// stays put while they load, fail, or have nothing to show yet.
	const aside = (
		<Box
			component="aside"
			sx={{
				width: { lg: 330 },
				flex: "none",
				display: "grid",
				gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "minmax(0, 1fr)" },
				alignItems: "start",
				gap: 2,
			}}
		>
			{data && data.flags.questionsWaiting > 0 && (
				<Box sx={{ gridColumn: { sm: "1 / -1", lg: "auto" } }}>
					<QuestionsCard info={info} count={data.flags.questionsWaiting} />
				</Box>
			)}
			{data && !data.flags.empty && <BiggestHoldings accountId={info.account.id} />}
			<AboutAccount info={info} />
		</Box>
	);

	return (
		<>
			<PeriodRow>
				{data?.pricesAsOf && !data.flags.empty && (
					<Typography variant="caption">{MONEY.pricesAsOf(formatDate(data.pricesAsOf))}</Typography>
				)}
			</PeriodRow>
			<Box
				sx={{
					display: "flex",
					flexDirection: { xs: "column", lg: "row" },
					alignItems: { lg: "flex-start" },
					gap: { xs: 2, lg: 2.5 },
				}}
			>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					{returns.isPending ? (
						<Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
							<Skeleton variant="rounded" height={104} sx={card} />
							<Skeleton variant="rounded" height={520} sx={card} />
						</Box>
					) : !data ? (
						<LoadFailed
							error={returns.error}
							fallback={MONEY.loadFailed}
							onRetry={() => void returns.refetch()}
						/>
					) : data.flags.empty ? (
						<NothingYet info={info} />
					) : (
						<Refreshing on={returns.isPlaceholderData}>
							{returns.isError && (
								<LoadFailed
									error={returns.error}
									fallback={MONEY.loadFailed}
									onRetry={() => void returns.refetch()}
								/>
							)}
							<ReturnStats returns={data} />
							{/* Questions are said in their own card, beside. */}
							<Caveats flags={data.flags} hideQuestions />
							<SameMoneyCard returns={data} />
						</Refreshing>
					)}
				</Box>
				{aside}
			</Box>
		</>
	);
};
