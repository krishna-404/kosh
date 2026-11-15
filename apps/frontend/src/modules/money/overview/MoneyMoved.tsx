import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { OVERVIEW } from "@frontend/copy/overview.copy";
import { Link as RouterLink } from "react-router";
import { type MovedRow, movedChart, roundsToZero } from "./overview.utils";

interface MoneyMovedProps {
	moved: Returns["moved"];
	/** The day the period starts — named on the opening value. */
	from: string;
	/** Where every cash flow is listed; null when the selection is not one account. */
	cashFlowsPath: string | null;
	/** Draw the waterfall (there is room for it); otherwise the plain list, as on a phone. */
	chart: boolean;
}

const CHART_HEIGHT = 220;
const BAR_WIDTH = 64;
const MIN_BAR = 6;
/** The gap between columns, in theme spacing units and in pixels (the zero line bridges it). */
const GAP = 2.25;
const GAP_PX = GAP * 8;

const labelOf = (row: MovedRow, from: string, moved: Returns["moved"]): string => {
	const detail = OVERVIEW.movedDetail;
	if (row.key === "opening") return `${OVERVIEW.moved.opening} · ${formatDate(from)}`;
	if (row.key === "priceGains") return row.amount < 0 ? OVERVIEW.moved.priceLosses : OVERVIEW.moved.priceGains;
	if (row.key === "putIn" && moved.deposits) return `${OVERVIEW.moved.putIn} · ${detail.deposits(moved.deposits)}`;
	if (row.key === "takenOut") {
		// Dividends are paid straight to the bank: money the accounts earned, and part of what left them.
		const dividends = Number(moved.dividendsToBank ?? 0) > 0;
		const said = [
			moved.withdrawals ? detail.withdrawals(moved.withdrawals) : null,
			dividends ? (moved.withdrawals ? detail.andDividends : detail.dividendsOnly) : null,
		].filter((part): part is string => part !== null);
		return said.length > 0 ? `${OVERVIEW.moved.takenOut} · ${said.join(" ")}` : OVERVIEW.moved.takenOut;
	}
	if (row.key === "dividends" && Number(moved.dividendsToBank ?? 0) > 0)
		return `${OVERVIEW.moved.dividends} · ${detail.toYourBank}`;
	return OVERVIEW.moved[row.key];
};

/** In the list, what prices and payouts did is coloured by its sign; fees are a cost; the rest is plain. */
const listTone = (row: MovedRow) => {
	if (row.key === "fees") return "neg" as const;
	if (row.key === "priceGains" || row.key === "dividends" || row.key === "interest") return "auto" as const;
	return "plain" as const;
};

const Bar = ({ row }: { row: MovedRow }) => {
	const nothing = roundsToZero(row.amount);
	return (
		<Box
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				const fill = {
					opening: k.line2,
					putIn: k.sky,
					// Hatched: money that left, as opposed to money that was lost.
					takenOut: `repeating-linear-gradient(135deg, ${k.coral} 0 5px, ${k.surface} 5px 10px)`,
					priceGains: row.amount < 0 ? k.danger : k.mint,
					dividends: k.sun,
					interest: k.lilac,
					fees: k.coral,
					closing: k.accent,
				}[row.key];
				const height = nothing ? "2px" : `max(${row.size * 100}%, ${MIN_BAR}px)`;
				return {
					position: "absolute",
					left: "50%",
					width: BAR_WIDTH,
					maxWidth: "100%",
					transform: "translateX(-50%)",
					// A sliver at the very top is kept inside the chart.
					bottom: `min(${row.start * 100}%, calc(100% - ${nothing ? 2 : MIN_BAR}px))`,
					height,
					background: nothing ? k.line2 : fill,
					borderRadius: row.level ? "10px 10px 0 0" : "10px",
					transition: theme.transitions.create(["height", "bottom"], { duration: 300 }),
				};
			}}
		/>
	);
};

/**
 * "How the money moved": what went in, what came out, what prices, payouts
 * and fees did, and where that leaves the value today. On desktop a
 * waterfall — each step starts where the last one ended, to scale; on a
 * phone the same rows as a plain list.
 */
export const MoneyMoved = ({ moved, from, cashFlowsPath, chart }: MoneyMovedProps) => {
	const { rows, zero } = movedChart(moved);
	const link = cashFlowsPath && (
		<Link
			component={RouterLink}
			to={cashFlowsPath}
			variant="body2"
			// In the list (a phone, mostly) the link is a full touch target without making the title row taller.
			sx={[{ flex: "none" }, !chart && { display: "inline-flex", alignItems: "center", minHeight: 44, my: -1.5 }]}
		>
			{OVERVIEW.moved.seeCashFlows}
		</Link>
	);

	if (!chart) {
		return (
			<SectionCard title={OVERVIEW.moved.title} action={link}>
				<Box
					component="ul"
					sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}
				>
					{rows.map((row) => (
						<Box
							component="li"
							key={row.key}
							sx={[
								{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1.5 },
								row.key === "closing" &&
									((theme) => ({
										mt: 0.5,
										pt: 1.25,
										borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
									})),
							]}
						>
							<Typography variant="body2" component="span" sx={{ minWidth: 0 }}>
								{labelOf(row, from, moved)}
							</Typography>
							<Money
								value={row.amount}
								sign={row.level ? "auto" : "always"}
								spacedSign
								tone={listTone(row)}
								sx={{ fontWeight: 700, fontSize: "0.8125rem" }}
							/>
						</Box>
					))}
				</Box>
			</SectionCard>
		);
	}

	return (
		<SectionCard
			title={
				<Typography variant="h2" component="span">
					{OVERVIEW.moved.title}
				</Typography>
			}
			action={link}
		>
			<Box
				component="ol"
				sx={{
					listStyle: "none",
					m: 0,
					p: 0,
					pt: 1,
					display: "grid",
					gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
					gap: GAP,
					// From the top, so the bars share one baseline even when a label takes two lines.
					alignItems: "start",
				}}
			>
				{rows.map((row) => (
					<Box
						component="li"
						key={row.key}
						sx={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "2px",
							minWidth: 0,
							textAlign: "center",
						}}
					>
						<Box aria-hidden sx={{ position: "relative", height: CHART_HEIGHT, width: "100%", mb: 0.75 }}>
							{zero > 0 && (
								<Box
									sx={(theme) => ({
										position: "absolute",
										left: -GAP_PX / 2,
										right: -GAP_PX / 2,
										bottom: `${zero * 100}%`,
										borderTop: `1px dashed ${theme.vars.palette.kosh.line2}`,
									})}
								/>
							)}
							<Bar row={row} />
						</Box>
						<Money value={row.amount} sign={row.level ? "auto" : "always"} spacedSign sx={{ fontWeight: 700 }} />
						<Typography variant="caption">{labelOf(row, from, moved)}</Typography>
					</Box>
				))}
			</Box>
		</SectionCard>
	);
};
