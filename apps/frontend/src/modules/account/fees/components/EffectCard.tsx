import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { FeeOverview } from "@connected-repo/zod-schemas/kosh/income.zod";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { againstBenchmarkWords, feeEffectWords, feePointsTaken } from "../fees.utils";

interface EffectCardProps {
	overview: FeeOverview;
	/** An arrangement is running today (not stopped, and not one entered for a later day). */
	running: boolean;
	/** Every arrangement on the account is billed by invoice: the charges are the payments. */
	allInvoiced: boolean;
	/** This account's return since it started; undefined while it loads or when it failed. */
	returns: Returns | undefined;
	returnsLoading: boolean;
	onRetryReturns: () => void;
}

/**
 * What the fee has come to: the total so far, and the yearly return before
 * and after fees side by side, with the difference in percentage points —
 * and what that does to the lead over NIFTY on the same money.
 */
export const EffectCard = ({
	overview,
	running,
	allInvoiced,
	returns,
	returnsLoading,
	onRetryReturns,
}: EffectCardProps) => {
	const charged = overview.charges.length;
	const effect = returns?.fees ?? null;
	const before = effect?.xirrBefore ?? null;
	const after = returns?.xirr ?? null;
	const taken = feePointsTaken(before, after);

	const nifty = returns?.benchmarks.find((benchmark) => benchmark.slug === "nifty50");
	const against =
		nifty && nifty.xirr !== null && after !== null
			? againstBenchmarkWords(effect?.aheadPointsBefore ?? null, after - nifty.xirr, nifty.name)
			: null;

	return (
		<SectionCard title={running ? FEES.effect.title : FEES.effect.titleEarlier}>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr)",
					alignItems: "stretch",
					gap: 2,
					"@container (min-width: 560px)": { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)", gap: 2.5 },
				}}
			>
				<Stat
					label={FEES.effect.total}
					value={<Money value={overview.total} />}
					hint={
						charged === 0 ? undefined : allInvoiced ? FEES.effect.payments(charged) : FEES.effect.charges(charged)
					}
					sx={{ alignSelf: "center" }}
				/>

				{charged === 0 ? (
					<Typography variant="body2" sx={{ alignSelf: "center" }}>
						{allInvoiced ? FEES.effect.nothingYetInvoiced : FEES.effect.nothingYet}
					</Typography>
				) : returnsLoading ? (
					<Skeleton variant="rounded" height={92} sx={{ borderRadius: "14px" }} />
				) : !returns ? (
					// The return could not be loaded: said across the whole card, with a way to try again.
					<Banner
						tone="bad"
						sx={{ gridColumn: "1 / -1" }}
						action={
							<Button variant="outlined" onClick={onRetryReturns}>
								{FEES.retry}
							</Button>
						}
					>
						{FEES.effect.returnsFailed}
					</Banner>
				) : (
					<Box
						role="group"
						aria-label={FEES.effect.pair}
						sx={(theme) => ({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
							borderRadius: "14px",
							bgcolor: theme.vars.palette.kosh.surface2,
							"& > * + *": { borderLeft: `1px solid ${theme.vars.palette.kosh.line2}` },
						})}
					>
						<Stat
							label={FEES.effect.before}
							value={<Percent value={before} />}
							hint={FEES.effect.aYear}
							sx={{ p: 1.75 }}
						/>
						<Stat
							label={FEES.effect.after}
							value={<Percent value={after} tone="auto" />}
							hint={
								taken === null ? (
									FEES.effect.aYear
								) : (
									<>
										{FEES.effect.aYear}
										{" · "}
										<Percent value={-taken} sign="always" suffix=" pts" sx={{ fontWeight: 700 }} />
									</>
								)
							}
							sx={{ p: 1.75 }}
						/>
					</Box>
				)}
			</Box>

			{charged > 0 && returns && !returnsLoading && (
				<Typography variant="body2" sx={{ mt: 2, maxWidth: 680 }}>
					{feeEffectWords(before, after)}
					{against && ` ${against}`}
					{returns.flags.shortWindow && ` ${FEES.effect.shortWindow}`}
				</Typography>
			)}
		</SectionCard>
	);
};
