import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { DivergingBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconClock } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { GROUPS } from "@frontend/copy/groups.copy";
import { FeeEffectNote } from "@frontend/modules/money/components/FeeEffectNote";
import type { ReactNode } from "react";
import { leaningOf } from "../groups.utils";
import {
	AheadAmount,
	AheadPoints,
	accountsLine,
	type ComparedRow,
	marksAgree,
	RowLink,
	RowMore,
	reasonOf,
	YearMarks,
} from "./ComparedParts";
import { GroupTile } from "./GroupTile";

/** Group · money now · return · NIFTY · ahead or behind · years ahead · more. */
const COLUMNS = "minmax(0, 1fr) 108px 56px 52px 216px 88px 40px";

const rowSx = {
	display: "grid",
	gridTemplateColumns: COLUMNS,
	columnGap: 1.5,
	alignItems: "center",
	px: 2.5,
} as const;

const right = { textAlign: "right" } as const;

const Head = ({ children, align }: { children: ReactNode; align?: "right" }) => (
	<Typography
		role="columnheader"
		variant="eyebrow"
		component="span"
		sx={[{ fontSize: "0.6875rem", letterSpacing: "0.05em", whiteSpace: "nowrap" }, align === "right" && right]}
	>
		{children}
	</Typography>
);

interface ComparedTableProps {
	rows: readonly ComparedRow[];
	/** The largest gap among ranked groups: the longest bar. */
	widest: number;
	onMore: (row: ComparedRow, anchor: HTMLElement) => void;
	/** Notes that close the card: how to read it, and that there is no total. */
	footer?: ReactNode;
}

/**
 * The comparison on desktop: one row per group, furthest ahead first, each
 * against NIFTY on its own money. A row opens the Overview for that group.
 * There is no total row — groups can share accounts.
 */
export const ComparedTable = ({ rows, widest, onMore, footer }: ComparedTableProps) => (
	<Box role="table" aria-label={GROUPS.table.label}>
		<Box role="rowgroup">
			<Box
				role="row"
				sx={[rowSx, (theme) => ({ minHeight: 36, bgcolor: theme.vars.palette.kosh.surface2 })]}
			>
				<Head>{GROUPS.table.group}</Head>
				<Head align="right">{GROUPS.table.moneyNow}</Head>
				<Head align="right">{GROUPS.table.return}</Head>
				<Head align="right">{GROUPS.table.nifty}</Head>
				<Head>{GROUPS.table.aheadOrBehind}</Head>
				<Head>{GROUPS.table.yearsAhead}</Head>
				<Box role="columnheader" component="span" sx={visuallyHidden}>
					{GROUPS.table.more}
				</Box>
			</Box>
		</Box>
		<Box role="rowgroup">
			{rows.map((row) => (
				<TableRow
					key={row.group.id}
					row={row}
					widest={widest}
					onMore={(anchor) => onMore(row, anchor)}
				/>
			))}
		</Box>
		{footer}
	</Box>
);

const visuallyHidden = {
	position: "absolute",
	width: "1px",
	height: "1px",
	overflow: "hidden",
	clipPath: "inset(50%)",
	whiteSpace: "nowrap",
} as const;

interface TableRowProps {
	row: ComparedRow;
	widest: number;
	onMore: (anchor: HTMLElement) => void;
}

const TableRow = ({ row, widest, onMore }: TableRowProps) => {
	const { figures, standing } = row;
	const reason = reasonOf(row);
	const accounts = accountsLine(row.memberLabels);

	let rest: ReactNode;
	if (standing === "pending")
		rest = (
			<Box role="cell" aria-colspan={5} aria-busy sx={{ gridColumn: "span 5" }}>
				<Skeleton width="70%" />
			</Box>
		);
	else if (standing === "ranked" && figures && figures.aheadPoints !== null) {
		const leaning = leaningOf(figures.aheadPoints);
		rest = (
			<>
				<Box role="cell" sx={right}>
					<Money value={figures.value} sx={{ fontWeight: 700 }} />
				</Box>
				<Box role="cell" sx={right}>
					<Percent value={figures.xirr} sx={{ fontWeight: 700 }} />
					<FeeEffectNote fees={figures.fees} form="short" />
				</Box>
				<Box role="cell" sx={right}>
					<Percent value={figures.benchmarkXirr} />
				</Box>
				<Box role="cell" sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
					<DivergingBar value={figures.aheadPoints} max={widest} width={64} />
					<Box sx={{ minWidth: 0 }}>
						<Typography component="div" variant="body2" noWrap sx={{ color: "text.primary" }}>
							<AheadPoints points={figures.aheadPoints} />
							{leaning === "level" && ` ${GROUPS.level}`}
						</Typography>
						<Typography component="div" variant="caption" noWrap>
							<AheadAmount amount={figures.aheadAmount} />
						</Typography>
					</Box>
				</Box>
				<Box role="cell" sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 8px" }}>
					{figures.yearsCounted === 0 ? (
						<Typography variant="caption">{GROUPS.noFullYear}</Typography>
					) : (
						<>
							{marksAgree(row) && <YearMarks years={row.years} />}
							<Typography variant="caption" noWrap>
								{GROUPS.yearsOf(figures.yearsAhead, figures.yearsCounted)}
							</Typography>
						</>
					)}
				</Box>
			</>
		);
	} else
		rest = (
			<>
				{/* Money already in the group is a fact even when it cannot be ranked; nothing uploaded is a dash, not a zero. */}
				<Box role="cell" sx={right}>
					<Money value={standing === "none" ? null : figures?.value} sx={{ fontWeight: 700 }} />
				</Box>
				<Box
					role="cell"
					aria-colspan={4}
					sx={{ gridColumn: "span 4", display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, py: 0.5 }}
				>
					{standing === "short" && (
						<Tag tone="pending" icon={<IconClock />}>
							{GROUPS.shortHistory.title}
						</Tag>
					)}
					<Typography variant="caption" sx={{ minWidth: 0 }}>
						{reason}
					</Typography>
				</Box>
			</>
		);

	return (
		<Box
			role="row"
			sx={[
				rowSx,
				(theme) => ({
					position: "relative",
					minHeight: 64,
					py: 0.75,
					borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
					transition: theme.transitions.create("background-color", { duration: 200 }),
					// Not the usual row tint: the bar's track and the kind tag are that colour.
					"&:hover": { bgcolor: theme.vars.palette.kosh.bg },
				}),
			]}
		>
			<Box role="rowheader" sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
				<GroupTile index={row.tile} />
				<Box sx={{ minWidth: 0 }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
						<RowLink row={row} />
						{row.kindLabel && <Tag>{row.kindLabel}</Tag>}
					</Box>
					<Typography variant="caption" component="div" noWrap>
						{accounts}
					</Typography>
				</Box>
			</Box>
			{rest}
			<Box role="cell" sx={{ display: "flex", justifyContent: "flex-end" }}>
				<RowMore row={row} onMore={onMore} />
			</Box>
		</Box>
	);
};
