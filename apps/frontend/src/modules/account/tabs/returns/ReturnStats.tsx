import { formatMonth } from "@connected-repo/ui-mui/format/date";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { FeeEffectNote } from "@frontend/modules/money/components/FeeEffectNote";
import { countFlows } from "../../account.utils";

/**
 * The four figures at the top of Returns: what it is worth, what went in,
 * what came out, and the yearly rate that connects them. With under a year
 * of history a yearly rate would mislead, so the growth so far stands in.
 */
export const ReturnStats = ({ returns }: { returns: Returns }) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const flows = countFlows(returns.trail.flows, returns.moved.opening);
	const since = formatMonth(returns.window.from);
	const short = returns.flags.shortWindow;
	const rate = short ? returns.growth : returns.xirr;

	return (
		<SectionCard>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "minmax(0, 1fr) minmax(0, 1fr)", md: "repeat(4, minmax(0, 1fr))" },
					gap: 2,
				}}
			>
				<Stat
					size={phone ? "lg" : "md"}
					label={ACCOUNT.valueToday}
					value={<Money value={returns.value} figure={phone} />}
					sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
				/>
				<Stat
					label={ACCOUNT.putIn}
					value={<Money value={returns.moved.putIn} />}
					// A count that was cut short is left out rather than understated.
					hint={
						returns.moved.deposits !== undefined
							? ACCOUNT.deposits(returns.moved.deposits)
							: flows.capped
								? undefined
								: ACCOUNT.deposits(flows.deposits)
					}
					sx={{ order: { xs: 3, md: 0 } }}
				/>
				<Stat
					label={ACCOUNT.takenOut}
					value={<Money value={returns.moved.takenOut} />}
					hint={
						// The server counts withdrawals proper; dividends (paid straight to the bank) are said apart.
						returns.moved.withdrawals !== undefined
							? ACCOUNT.takenOutHint(returns.moved.withdrawals, Number(returns.moved.dividendsToBank ?? 0) > 0)
							: flows.capped
								? undefined
								: ACCOUNT.withdrawals(flows.withdrawals)
					}
					sx={{ order: { xs: 4, md: 0 } }}
				/>
				<Stat
					label={short ? ACCOUNT.growthSoFar : ACCOUNT.returnXirr}
					value={<Percent value={rate} tone="auto" />}
					hint={
						<>
							{rate === null ? ACCOUNT.noRate : short ? ACCOUNT.growthFrom(since) : ACCOUNT.aYearFrom(since)}
							<FeeEffectNote fees={returns.fees} form="short" />
						</>
					}
					sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, order: { xs: 2, md: 0 } }}
				/>
			</Box>
		</SectionCard>
	);
};
