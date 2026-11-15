import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { formatMoney, toNumber } from "@connected-repo/ui-mui/format/money";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { CompareBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconCalc, IconTrend } from "@connected-repo/ui-mui/kosh/icons";
import { LineChart, type LineSeries } from "@connected-repo/ui-mui/kosh/LineChart";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import {
	aheadParts,
	aheadPhrase,
	aheadSentence,
	aheadTone,
	benchmarkTone,
	countFlows,
	sameMoneyLine,
} from "../../account.utils";
import { useTabLink } from "../../components/useTabLink";

type Tone = LineSeries["tone"];

interface Row {
	key: string;
	name: string;
	/** For the narrow label column on a phone. */
	short: string;
	tone: Tone;
	value: string | null;
	rate: number | null;
	emphasis: boolean;
}

/** The line key beside a name: the same colour the chart draws that series in. */
const LineKey = ({ tone }: { tone: Tone }) => (
	<Box
		component="span"
		aria-hidden
		sx={(theme) => {
			const k = theme.vars.palette.kosh;
			return {
				display: "inline-block",
				width: 22,
				height: "3.5px",
				flex: "none",
				borderRadius: 2,
				bgcolor: { you: k.seriesYou, nifty: k.seriesNifty, gold: k.seriesGold, alt: k.seriesAlt }[tone],
			};
		}}
	/>
);

/** Value today and the yearly rate, in two columns that line up down the rows. */
const Figures = ({ value, rate, withRate }: { value: ReactNode; rate: ReactNode; withRate: boolean }) => (
	<Box
		component="span"
		sx={{
			display: "inline-grid",
			gridTemplateColumns: withRate
				? { xs: "minmax(66px, auto) 50px", md: "minmax(104px, auto) 62px" }
				: { xs: "minmax(66px, auto)", md: "minmax(104px, auto)" },
			columnGap: { xs: 1, md: 2 },
			alignItems: "baseline",
			textAlign: "right",
		}}
	>
		<span>{value}</span>
		{withRate && <span>{rate}</span>}
	</Box>
);

/**
 * "If the same money had gone elsewhere": this account against each
 * benchmark on the very same deposits and withdrawals — the chart, one row
 * each with what it would be worth and its rate, and the difference in rupees.
 */
export const SameMoneyCard = ({ returns }: { returns: Returns }) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const { linkTo } = useTabLink();

	// Under a year, yearly rates would mislead: the rows show values only.
	const withRate = !returns.flags.shortWindow;
	const rows: Row[] = [
		{
			key: "you",
			name: ACCOUNT.thisAccount,
			short: ACCOUNT.thisShort,
			tone: "you",
			value: returns.value,
			rate: returns.xirr,
			emphasis: true,
		},
		...returns.benchmarks.map((benchmark) => ({
			key: benchmark.slug,
			name: benchmark.name,
			short: benchmark.name,
			tone: benchmarkTone(benchmark.slug),
			value: benchmark.value,
			rate: benchmark.xirr,
			emphasis: false,
		})),
	];
	const longest = Math.max(0, ...rows.map((row) => (row.value === null ? 0 : toNumber(row.value))));

	const series: LineSeries[] = [
		{ key: "you", name: ACCOUNT.thisAccount, tone: "you", emphasis: true, values: returns.chart.you },
		...returns.chart.benchmarks.map((line) => ({
			key: line.slug,
			name: returns.benchmarks.find((b) => b.slug === line.slug)?.name ?? line.slug,
			tone: benchmarkTone(line.slug),
			values: line.values,
		})),
	];

	const ahead = aheadParts(returns.benchmarks);
	const notes = returns.benchmarks.flatMap((benchmark) => [
		...(benchmark.value === null ? [ACCOUNT.noValueToday(benchmark.name)] : []),
		...(benchmark.availableFrom ? [ACCOUNT.pricesStart(benchmark.name, formatDate(benchmark.availableFrom))] : []),
	]);

	return (
		<SectionCard>
			<Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.25 } }}>
				<Box>
					<Typography variant="eyebrow" component="div">
						{ACCOUNT.sameMoneyEyebrow}
					</Typography>
					<Typography variant="h2" sx={{ mt: 0.5 }}>
						{ACCOUNT.sameMoneyTitle}
					</Typography>
					<Typography variant="body2" sx={{ mt: 0.5 }}>
						{sameMoneyLine(countFlows(returns.trail.flows, returns.moved.opening))}
					</Typography>
				</Box>

				<LineChart
					dates={returns.chart.dates}
					series={series}
					// On desktop the rows below name every series beside its line colour.
					hideLegend={!phone}
					height={phone ? 200 : 230}
					labels={{
						summary: [
							ACCOUNT.chartSummary(
								rows.flatMap((row) =>
									row.value === null ? [] : [ACCOUNT.chartPart(row.name, formatMoney(row.value))],
								),
							),
							aheadSentence(ahead),
						]
							.filter(Boolean)
							.join(" "),
						showTable: MONEY.chartShowTable,
						hideTable: MONEY.chartHideTable,
						date: MONEY.chartDate,
					}}
					formatValue={(value) => formatMoney(value)}
					formatTick={(value) => formatMoney(value, { notation: "compact" })}
					formatDate={formatDate}
				/>

				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
						<Typography variant="caption" component="div">
							<Figures value={ACCOUNT.rowValueToday} rate={MONEY.aYear} withRate={withRate} />
						</Typography>
					</Box>
					{rows.map((row) => (
						<CompareBar
							key={row.key}
							label={
								phone ? (
									row.short
								) : (
									<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
										<LineKey tone={row.tone} />
										{row.name}
									</Box>
								)
							}
							value={row.value !== null && longest > 0 ? toNumber(row.value) / longest : 0}
							color={row.tone === "you" ? "accent" : row.tone}
							emphasis={row.emphasis}
							figure={
								<Figures
									withRate={withRate}
									value={<Money value={row.value} notation={phone ? "compact" : "full"} />}
									rate={<Percent value={row.rate} tone={row.emphasis ? "auto" : "plain"} />}
								/>
							}
						/>
					))}
					{notes.map((note) => (
						<Typography key={note} variant="caption">
							{note}
						</Typography>
					))}
				</Box>

				{ahead.length > 0 && (
					<Banner
						tone={aheadTone(ahead)}
						icon={aheadTone(ahead) === "good" ? <IconTrend fontSize="inherit" /> : undefined}
					>
						{ACCOUNT.onTheSameMoney}
						{ahead.map((part, index) => (
							<Fragment key={part.slug}>
								{index > 0 && (index === ahead.length - 1 ? " and " : ", ")}
								<b>{aheadPhrase(part)}</b>
							</Fragment>
						))}
						.
					</Banner>
				)}

				<Box sx={{ display: "flex", justifyContent: { md: "flex-end" } }}>
					<Button
						variant="text"
						startIcon={<IconCalc />}
						component={Link}
						to={linkTo("worked-out")}
						fullWidth={phone}
					>
						{phone ? ACCOUNT.seeHowShort : ACCOUNT.seeHow}
					</Button>
				</Box>
			</Box>
		</SectionCard>
	);
};
