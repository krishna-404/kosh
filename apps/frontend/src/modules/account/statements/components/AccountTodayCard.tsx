import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { MONEY } from "@frontend/copy/money.copy";
import { STATEMENTS, TODAY } from "@frontend/copy/statements.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useReturns } from "@frontend/modules/money/money.queries";
import type { ReactNode } from "react";

/** A label and its figure on one line. */
const Line = ({ label, children }: { label: string; children: ReactNode }) => (
	<Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 }}>
		<Typography variant="body2" component="dt">
			{label}
		</Typography>
		<Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>
			{children}
		</Typography>
	</Box>
);

/**
 * "This account today": its value, its return, and the same money in
 * NIFTY 50 — so the effect of an upload, an undo or an answer shows up
 * beside where it was made. A figure that cannot honestly be worked out is
 * a dash, with the reason under it.
 */
export const AccountTodayCard = ({ accountId }: { accountId: string }) => {
	const returns = useReturns({ kind: "account", id: accountId });

	if (returns.isPending) return <Skeleton variant="rounded" height={150} sx={{ borderRadius: 2.5 }} />;
	if (returns.isError)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void returns.refetch()}>
						{STATEMENTS.retry}
					</Button>
				}
			>
				{errorWords(returns.error, TODAY.loadFailed)}
			</Banner>
		);

	const { data } = returns;
	const empty = data.flags.empty;
	const nifty = data.benchmarks.find((benchmark) => benchmark.slug === "nifty50");
	const reasons = [
		empty ? TODAY.noStatements : null,
		!empty && data.flags.pricesLoading ? MONEY.pricesLoading : null,
		!empty && data.flags.shortWindow ? MONEY.shortWindow : null,
		!empty && data.flags.accountsWithoutLedger > 0 ? MONEY.noLedger(data.flags.accountsWithoutLedger) : null,
		!empty && data.flags.unpricedHoldings > 0 ? MONEY.unpriced(data.flags.unpricedHoldings) : null,
	].filter((reason): reason is string => reason !== null);

	return (
		<SectionCard title={TODAY.title}>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
				<Box component="dl" sx={{ m: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
					<Line label={TODAY.value}>
						<Money value={empty ? null : data.value} />
					</Line>
					<Line label={MONEY.xirr}>
						<Percent value={empty ? null : data.xirr} tone="auto" />
					</Line>
					{nifty && (
						<Line label={MONEY.sameMoneyIn(nifty.name)}>
							<Percent value={empty ? null : nifty.xirr} />
						</Line>
					)}
				</Box>
				{reasons.map((reason) => (
					<Typography key={reason} variant="caption" component="p" sx={{ m: 0 }}>
						{reason}
					</Typography>
				))}
				{!empty && data.pricesAsOf && (
					<Typography variant="caption" component="p" sx={{ m: 0 }}>
						{MONEY.pricesAsOf(formatDate(data.pricesAsOf))}
					</Typography>
				)}
			</Box>
		</SectionCard>
	);
};
