import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate, formatWhen } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { PROFILE } from "@frontend/copy/profile.copy";
import { useMarketStatus } from "@frontend/modules/money/money.queries";

/**
 * How fresh the prices are, and whether the last fetch had trouble — the
 * one place that says where every figure's "today" comes from.
 */
export const FeedsCard = () => {
	const { data, isPending, isError, refetch } = useMarketStatus();

	return (
		<SectionCard title={PROFILE.feedsTitle}>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
				<Typography variant="body2" sx={{ color: "text.secondary" }}>
					{PROFILE.feedsLead}
				</Typography>
				{isPending ? (
					<Skeleton variant="rounded" height={56} />
				) : isError || !data ? (
					<Banner
						tone="bad"
						action={
							<Button color="inherit" onClick={() => void refetch()}>
								{PROFILE.retry}
							</Button>
						}
					>
						{PROFILE.feedsFailed}
					</Banner>
				) : (
					<>
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 2, md: 5 } }}>
							<Stat
								label={PROFILE.pricesAsOf}
								value={data.pricesAsOf ? formatDate(data.pricesAsOf) : "—"}
								hint={data.pricesAsOf ? undefined : PROFILE.noPricesYet}
							/>
							<Stat
								label={PROFILE.lastFetched}
								value={data.lastSyncAt ? formatWhen(data.lastSyncAt) : "—"}
								hint={data.lastSyncAt ? undefined : PROFILE.neverFetched}
							/>
						</Box>
						{data.loading && <Banner tone="info">{PROFILE.fetching}</Banner>}
						{data.trouble && (
							<Banner tone="warn" title={PROFILE.trouble}>
								{data.trouble}. {PROFILE.troubleHint}
							</Banner>
						)}
					</>
				)}
			</Box>
		</SectionCard>
	);
};
