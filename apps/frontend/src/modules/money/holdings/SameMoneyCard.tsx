import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { CompareBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconTrend } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";
import { SCRIPT } from "@frontend/copy/holdings.copy";
import type { ReactNode } from "react";

interface SameMoneyCardProps {
	holding: Holding;
}

/** A value and the yearly return beside it, the same width on every row so the bars share one scale. */
const Figure = ({ value, rate, strong }: { value: string; rate: number | null; strong?: boolean }) => (
	<Box
		component="span"
		sx={{
			display: "inline-grid",
			gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "112px 98px" },
			width: { xs: 100, sm: "auto" },
			columnGap: 1.5,
			justifyItems: "end",
			fontWeight: strong ? 700 : 500,
		}}
	>
		<Money value={value} />
		<Box component="span" sx={{ fontSize: { xs: "0.75rem", sm: "inherit" }, whiteSpace: "nowrap" }}>
			<Percent value={rate} />
			{rate !== null && ` ${SCRIPT.aYear}`}
		</Box>
	</Box>
);

/**
 * The script against the same buys and sells put in NIFTY: what each would
 * be worth today, each one's return a year, and the gap in rupees in a
 * sentence. A script that is sold out has no value to draw, so there the
 * two returns stand side by side instead of bars.
 */
export const SameMoneyCard = ({ holding }: SameMoneyCardProps) => {
	const { value, benchmarkValue, effect } = holding;
	const compared = benchmarkValue !== null && effect !== null;
	const ahead = compared && Number(effect) >= 0;
	const gap = compared ? formatMoney(Math.abs(Number(effect))) : "";
	const longest = Math.max(Number(value), Number(benchmarkValue ?? 0), 0);
	const share = (amount: string) => (longest > 0 ? Math.max(0, Number(amount)) / longest : 0);

	let sentence: ReactNode = null;
	if (compared && holding.sold)
		sentence = ahead ? (
			<>
				{SCRIPT.soldAhead.before}
				<b>{SCRIPT.soldAhead.ahead(gap)}</b>.
			</>
		) : (
			<>
				{SCRIPT.soldBehind.before}
				<b>{SCRIPT.soldBehind.more(gap)}</b>.
			</>
		);
	else if (compared)
		sentence = ahead ? (
			<>
				{SCRIPT.aheadOf.before}
				<b>{SCRIPT.aheadOf.ahead(gap)}</b>
				{SCRIPT.aheadOf.after(formatMoney(benchmarkValue))}
			</>
		) : (
			<>
				{SCRIPT.stillWouldBe.before}
				<b>{formatMoney(benchmarkValue)}</b>
				{" — "}
				<b>{SCRIPT.stillWouldBe.more(gap)}</b>.
			</>
		);

	return (
		<SectionCard>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
				<Box>
					<Typography variant="eyebrow" component="div">
						{SCRIPT.sameMoneyEyebrow}
					</Typography>
					<Typography variant="h2" sx={{ mt: 0.5 }}>
						{SCRIPT.sameMoneyTitle}
					</Typography>
					<Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
						{SCRIPT.sameMoneyBody}
					</Typography>
				</Box>

				{!compared ? (
					<Banner>{SCRIPT.notCompared}</Banner>
				) : (
					<>
						{holding.sold ? (
							<Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
								<Stat label={SCRIPT.thisScript} value={<Percent value={holding.xirr} />} hint={SCRIPT.aYear} />
								<Stat label={SCRIPT.nifty} value={<Percent value={holding.benchmarkXirr} />} hint={SCRIPT.aYear} />
							</Box>
						) : (
							<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
								<CompareBar
									label={SCRIPT.thisScript}
									value={share(value)}
									figure={<Figure value={value} rate={holding.xirr} strong />}
									emphasis
								/>
								<CompareBar
									label={SCRIPT.nifty}
									value={share(benchmarkValue)}
									figure={<Figure value={benchmarkValue} rate={holding.benchmarkXirr} />}
									color="nifty"
								/>
							</Box>
						)}
						<Banner tone={ahead ? "good" : "bad"} icon={ahead ? <IconTrend fontSize="inherit" /> : undefined}>
							{sentence}
						</Banner>
					</>
				)}
			</Box>
		</SectionCard>
	);
};
