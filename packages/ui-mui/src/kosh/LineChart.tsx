import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { radii } from "../theme/tokens";

/**
 * Value over time for a few series on ONE axis — "this account" against the
 * same money in NIFTY and in gold.
 *
 * The rules it keeps (they are why it looks the way it does):
 *  - one y-axis, always; clean tick values; hairline solid gridlines
 *  - 2px lines; identity is never colour alone — a legend names every series
 *    and each line ends in a dot the tooltip and legend key repeat
 *  - text is ink, never the series colour
 *  - pointer, touch and keyboard all reach the same readout: a crosshair that
 *    snaps to the nearest day and lists every series there
 *  - every number is also in a table (`labels.showTable`)
 *
 * Presentational: it formats nothing itself and holds no words of its own.
 */

/** Which token colours a line. The order is fixed: a series keeps its colour whatever else is shown. */
export type SeriesTone = "you" | "nifty" | "gold" | "alt";

export interface LineSeries {
	key: string;
	name: string;
	tone: SeriesTone;
	/** One per date; null where the series has no value yet. */
	values: readonly (number | null)[];
	/** The series the chart is about is drawn last, on top. */
	emphasis?: boolean;
}

export interface LineChartLabels {
	/** What the chart shows, in a sentence, for screen readers. */
	summary: string;
	showTable: string;
	hideTable: string;
	/** Heading of the table's date column. */
	date: string;
}

export interface LineChartProps {
	/** ISO dates (YYYY-MM-DD), oldest first. */
	dates: readonly string[];
	series: readonly LineSeries[];
	labels: LineChartLabels;
	/** A value in full, for the tooltip and the table ("₹84,20,000"). */
	formatValue: (value: number) => string;
	/** A value on the axis, short ("₹80 L"). */
	formatTick: (value: number) => string;
	/** A date in the tooltip and the table ("3 Nov 2026"). */
	formatDate: (isoDate: string) => string;
	/** Plot height in px. */
	height?: number;
	/** Leave the legend out when rows right beside the chart already name every series. */
	hideLegend?: boolean;
	sx?: SxProps<Theme>;
}

const toneColor = (theme: Theme, tone: SeriesTone): string => {
	const k = theme.vars.palette.kosh;
	return { you: k.seriesYou, nifty: k.seriesNifty, gold: k.seriesGold, alt: k.seriesAlt }[tone];
};

const PAD = { top: 12, right: 14, bottom: 26, left: 56 } as const;

/** Round steps (1, 2, 2.5, 5 × 10ⁿ) that give about `count` ticks from 0 or the low end up. */
export const niceTicks = (min: number, max: number, count = 4): number[] => {
	if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
	if (max <= min) return [min];
	const raw = (max - min) / count;
	const power = 10 ** Math.floor(Math.log10(raw));
	const step = ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
	const start = Math.floor(min / step) * step;
	const ticks: number[] = [];
	for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)));
	return ticks;
};

/** The first index of each calendar year in `dates`, thinned so labels never touch. */
const yearMarks = (dates: readonly string[], plotWidth: number): { index: number; year: string }[] => {
	const marks: { index: number; year: string }[] = [];
	for (let i = 1; i < dates.length; i++) {
		const year = (dates[i] as string).slice(0, 4);
		if (year !== (dates[i - 1] as string).slice(0, 4)) marks.push({ index: i, year });
	}
	const every = Math.max(1, Math.ceil(marks.length / Math.max(1, Math.floor(plotWidth / 56))));
	return marks.filter((_, i) => (marks.length - 1 - i) % every === 0);
};

export const LineChart = ({
	dates,
	series,
	labels,
	formatValue,
	formatTick,
	formatDate,
	height = 230,
	hideLegend = false,
	sx,
}: LineChartProps) => {
	const frame = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(620);
	const [at, setAt] = useState<number | null>(null);
	const [tableOpen, setTableOpen] = useState(false);
	const tableId = useId();

	useEffect(() => {
		const element = frame.current;
		if (!element) return;
		const measure = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const plotWidth = width - PAD.left - PAD.right;
	const plotHeight = height - PAD.top - PAD.bottom;
	const last = dates.length - 1;

	const { ticks, y } = useMemo(() => {
		const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
		const low = all.length > 0 ? Math.min(...all) : 0;
		const high = all.length > 0 ? Math.max(...all) : 1;
		// Money grows from nothing: start at zero unless the series never come near it.
		const from = low > high * 0.5 ? low : Math.min(0, low);
		const steps = niceTicks(from, high);
		const bottom = steps[0] ?? 0;
		const top = steps[steps.length - 1] ?? 1;
		const span = top - bottom || 1;
		return {
			ticks: steps,
			y: (value: number) => PAD.top + plotHeight - ((value - bottom) / span) * plotHeight,
		};
	}, [series, plotHeight]);

	const x = (index: number) => PAD.left + (last > 0 ? (index / last) * plotWidth : plotWidth / 2);
	const years = useMemo(() => yearMarks(dates, plotWidth), [dates, plotWidth]);

	// The series the chart is about goes on top.
	const drawn = useMemo(() => [...series].sort((a, b) => Number(a.emphasis ?? false) - Number(b.emphasis ?? false)), [series]);
	const path = (values: readonly (number | null)[]) => {
		let d = "";
		let pen = false;
		values.forEach((value, i) => {
			if (value === null) {
				pen = false;
				return;
			}
			d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`;
			pen = true;
		});
		return d;
	};
	const lastIndexOf = (values: readonly (number | null)[]) => {
		for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
		return -1;
	};

	const nearest = (clientX: number): number | null => {
		const element = frame.current;
		if (!element || last < 0) return null;
		const offset = clientX - element.getBoundingClientRect().left - PAD.left;
		return Math.min(last, Math.max(0, Math.round((offset / Math.max(1, plotWidth)) * last)));
	};
	const onPointer = (event: PointerEvent<HTMLDivElement>) => setAt(nearest(event.clientX));
	const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
		if (last < 0) return;
		const step = event.shiftKey ? Math.max(1, Math.round(last / 10)) : 1;
		const from = at ?? last;
		const next: Record<string, number> = {
			ArrowLeft: Math.max(0, from - step),
			ArrowRight: Math.min(last, from + step),
			Home: 0,
			End: last,
		};
		if (event.key === "Escape") setAt(null);
		else if (event.key in next) {
			event.preventDefault();
			setAt(next[event.key] as number);
		}
	};

	const tipLeft = at === null ? 0 : x(at);
	const tipOnLeft = tipLeft > width * 0.6;
	// The table keeps every number reachable without the chart; a long history is thinned to ~24 rows.
	const tableRows = useMemo(() => {
		const every = Math.max(1, Math.ceil(dates.length / 24));
		return dates.map((_, i) => i).filter((i) => i === last || i % every === 0);
	}, [dates, last]);

	if (dates.length === 0 || series.length === 0) return null;

	return (
		<Box sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
			{!hideLegend && series.length > 1 && (
				<Box component="ul" sx={{ display: "flex", flexWrap: "wrap", gap: 2, p: 0, m: 0, mb: 1, listStyle: "none" }}>
					{series.map((s) => (
						<Box component="li" key={s.key} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
							<Box
								aria-hidden
								sx={(theme) => ({ width: 16, height: 3, borderRadius: `${radii.pill}px`, bgcolor: toneColor(theme, s.tone) })}
							/>
							<Typography variant="caption" sx={{ color: "text.secondary", fontWeight: s.emphasis ? 700 : 500 }}>
								{s.name}
							</Typography>
						</Box>
					))}
				</Box>
			)}

			<Box
				ref={frame}
				role="img"
				aria-label={labels.summary}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the chart is explored with the arrow keys
				tabIndex={0}
				onPointerMove={onPointer}
				onPointerDown={onPointer}
				onPointerLeave={() => setAt(null)}
				onBlur={() => setAt(null)}
				onKeyDown={onKey}
				sx={(theme) => ({
					position: "relative",
					height,
					touchAction: "pan-y",
					outline: "none",
					borderRadius: `${radii.input}px`,
					"&:focus-visible": { boxShadow: `0 0 0 2px ${theme.vars.palette.kosh.accent}` },
				})}
			>
				<Box component="svg" width={width} height={height} aria-hidden sx={{ display: "block", overflow: "visible" }}>
					{ticks.map((tick) => (
						<g key={tick}>
							<Box
								component="line"
								x1={PAD.left}
								x2={width - PAD.right}
								y1={y(tick)}
								y2={y(tick)}
								sx={(theme) => ({ stroke: theme.vars.palette.kosh.line, strokeWidth: 1 })}
							/>
							<Box
								component="text"
								x={PAD.left - 8}
								y={y(tick)}
								textAnchor="end"
								dominantBaseline="middle"
								sx={(theme) => ({ ...theme.typography.caption, fill: theme.vars.palette.kosh.ink3, fontVariantNumeric: "tabular-nums" })}
							>
								{formatTick(tick)}
							</Box>
						</g>
					))}
					{years.map(({ index, year }) => (
						<Box
							component="text"
							key={year}
							x={x(index)}
							y={height - 6}
							textAnchor="middle"
							sx={(theme) => ({ ...theme.typography.caption, fill: theme.vars.palette.kosh.ink3, fontVariantNumeric: "tabular-nums" })}
						>
							{year}
						</Box>
					))}
					{drawn.map((s) => (
						<Box
							component="path"
							key={s.key}
							d={path(s.values)}
							sx={(theme) => ({
								fill: "none",
								stroke: toneColor(theme, s.tone),
								strokeWidth: 2,
								strokeLinejoin: "round",
								strokeLinecap: "round",
							})}
						/>
					))}
					{at !== null && (
						<Box
							component="line"
							x1={x(at)}
							x2={x(at)}
							y1={PAD.top}
							y2={PAD.top + plotHeight}
							sx={(theme) => ({ stroke: theme.vars.palette.kosh.line2, strokeWidth: 1 })}
						/>
					)}
					{drawn.map((s) => {
						// A dot at the day being read, or at the line's end; ringed so crossing lines stay apart.
						const index = at !== null && s.values[at] !== null ? at : lastIndexOf(s.values);
						const value = index >= 0 ? s.values[index] : null;
						if (value === null || value === undefined) return null;
						return (
							<Box
								component="circle"
								key={s.key}
								cx={x(index)}
								cy={y(value)}
								r={4}
								sx={(theme) => ({ fill: toneColor(theme, s.tone), stroke: theme.vars.palette.kosh.surface, strokeWidth: 2 })}
							/>
						);
					})}
				</Box>

				{at !== null && (
					<Box
						aria-hidden
						sx={(theme) => ({
							position: "absolute",
							top: PAD.top,
							left: tipOnLeft ? undefined : tipLeft + 10,
							right: tipOnLeft ? width - tipLeft + 10 : undefined,
							minWidth: 150,
							px: 1.25,
							py: 1,
							borderRadius: `${radii.input}px`,
							bgcolor: theme.vars.palette.kosh.surface,
							border: `1px solid ${theme.vars.palette.kosh.line}`,
							boxShadow: theme.vars.palette.kosh.shadowPop,
							pointerEvents: "none",
							zIndex: 1,
						})}
					>
						<Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 0.5 }}>
							{formatDate(dates[at] as string)}
						</Typography>
						{series.map((s) => {
							const value = s.values[at];
							return (
								<Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.125 }}>
									<Box sx={(theme) => ({ width: 12, height: 3, borderRadius: `${radii.pill}px`, bgcolor: toneColor(theme, s.tone), flex: "none" })} />
									<Typography variant="numeric" sx={{ fontWeight: 700, color: "text.primary" }}>
										{value === null || value === undefined ? "—" : formatValue(value)}
									</Typography>
									<Typography variant="caption" noWrap sx={{ color: "text.secondary" }}>
										{s.name}
									</Typography>
								</Box>
							);
						})}
					</Box>
				)}
			</Box>

			{/* What the crosshair is on, for screen readers following with the arrow keys. */}
			<Box aria-live="polite" sx={visuallyHidden}>
				{at !== null &&
					`${formatDate(dates[at] as string)}: ${series
						.map((s) => `${s.name} ${s.values[at] === null || s.values[at] === undefined ? "—" : formatValue(s.values[at] as number)}`)
						.join(", ")}`}
			</Box>

			<ButtonBase
				aria-expanded={tableOpen}
				aria-controls={tableId}
				onClick={() => setTableOpen((open) => !open)}
				sx={(theme) => ({
					...theme.typography.caption,
					mt: 0.5,
					px: 1,
					minHeight: 32,
					borderRadius: `${radii.pill}px`,
					color: theme.vars.palette.kosh.accentText,
					fontWeight: 600,
					"&:focus-visible": { boxShadow: `0 0 0 2px ${theme.vars.palette.kosh.accent}` },
				})}
			>
				{tableOpen ? labels.hideTable : labels.showTable}
			</ButtonBase>
			<Box id={tableId} hidden={!tableOpen} sx={{ maxHeight: 280, overflow: "auto", mt: 0.5 }}>
				<Box
					component="table"
					sx={(theme) => ({
						width: "100%",
						borderCollapse: "collapse",
						"& th, & td": {
							...theme.typography.caption,
							textAlign: "right",
							padding: theme.spacing(0.75, 1),
							borderBottom: `1px solid ${theme.vars.palette.kosh.line}`,
							fontVariantNumeric: "tabular-nums",
							whiteSpace: "nowrap",
						},
						"& th:first-of-type, & td:first-of-type": { textAlign: "left" },
						"& thead th": { color: theme.vars.palette.text.secondary, fontWeight: 600, position: "sticky", top: 0, bgcolor: theme.vars.palette.kosh.surface },
					})}
				>
					<thead>
						<tr>
							<th scope="col">{labels.date}</th>
							{series.map((s) => (
								<th scope="col" key={s.key}>
									{s.name}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{tableRows.map((i) => (
							<tr key={dates[i]}>
								<th scope="row">{formatDate(dates[i] as string)}</th>
								{series.map((s) => (
									<td key={s.key}>{s.values[i] === null || s.values[i] === undefined ? "—" : formatValue(s.values[i] as number)}</td>
								))}
							</tr>
						))}
					</tbody>
				</Box>
			</Box>
		</Box>
	);
};

const visuallyHidden = {
	position: "absolute",
	width: 1,
	height: 1,
	overflow: "hidden",
	clip: "rect(0 0 0 0)",
	clipPath: "inset(50%)",
	whiteSpace: "nowrap",
} as const;
