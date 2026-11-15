import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { LineChart } from "@connected-repo/ui-mui/kosh/LineChart";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import type { Script } from "@connected-repo/zod-schemas/kosh/money.zod";
import { SCRIPT } from "@frontend/copy/holdings.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { priceWords } from "./holdings.utils";

interface PriceCardProps {
	name: string;
	chart: Script["chart"];
}

/** The script's closing price since it was first bought — one line, so the title names it. */
export const PriceCard = ({ name, chart }: PriceCardProps) => {
	const first = chart.closes[0];
	const last = chart.closes[chart.closes.length - 1];
	const from = chart.dates[0];
	const to = chart.dates[chart.dates.length - 1];
	const drawable = first !== undefined && last !== undefined && from !== undefined && to !== undefined;
	return (
		<SectionCard title={SCRIPT.priceTitle} subtitle={drawable ? SCRIPT.priceBody : undefined}>
			{drawable ? (
				<LineChart
					dates={chart.dates}
					series={[{ key: "price", name: SCRIPT.priceSeries, tone: "you", emphasis: true, values: chart.closes }]}
					labels={{
						summary: SCRIPT.priceSummary(name, formatDate(from), formatDate(to), priceWords(first), priceWords(last)),
						showTable: MONEY.chartShowTable,
						hideTable: MONEY.chartHideTable,
						date: MONEY.chartDate,
					}}
					formatValue={priceWords}
					formatTick={priceWords}
					formatDate={formatDate}
					// The chart's read-aloud line is placed against its nearest positioned box; without
					// one here it is sized against the page and makes the page scroll sideways.
					sx={{ position: "relative" }}
				/>
			) : (
				<Typography variant="body2" sx={{ color: "text.secondary" }}>
					{SCRIPT.noPrices}
				</Typography>
			)}
		</SectionCard>
	);
};
