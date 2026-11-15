import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { ButtonBase } from "@connected-repo/ui-mui/form/ButtonBase";
import { DivergingBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconChevronDown } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";
import { HOLDINGS, KIND_OF_ONE } from "@frontend/copy/holdings.copy";
import { scriptPath } from "@frontend/copy/nav.copy";
import type { ReactNode } from "react";
import { heldInWords, pointsOf, pointsWords, type Sort, type SortKey, standingOf } from "./holdings.utils";
import { linkedRow, RowLink } from "./RowLink";

/**
 * The board's columns. Below a wide desktop there is no room for all six,
 * so "held in" moves under the name and the bar gives way to its figure.
 */
const rowGrid = {
	display: "grid",
	gridTemplateColumns: {
		md: "minmax(0,1fr) 104px 64px 96px 100px",
		lg: "minmax(0,1fr) 150px 110px 64px 200px 100px",
	},
	columnGap: 1.5,
	alignItems: "center",
	px: 2.5,
} as const;

const wideOnly = { display: { md: "none", lg: "block" } } as const;
const right = { textAlign: "right" } as const;

interface HoldingsTableProps {
	/** The rows to draw, already filtered, ordered and cut to length. */
	rows: readonly Holding[];
	/** The biggest gap against NIFTY among all the rows — the longest bar. */
	largestGap: number;
	sort: Sort;
	onSort: (key: SortKey) => void;
	/** The scope, as a query string, carried to each script's page. */
	search: string;
	/** "Showing 9 of 41", the sold checkbox, "Show all". */
	footer: ReactNode;
}

/**
 * Desktop: one row per script — where it is held, what it is worth, its
 * return, and how it stands against the same money in NIFTY. Laid out on a
 * grid with table roles, so the whole row can be one link and it still reads
 * row by row, column by column.
 */
export const HoldingsTable = ({ rows, largestGap, sort, onSort, search, footer }: HoldingsTableProps) => (
	<Box>
		<Box role="table" aria-label={HOLDINGS.tableLabel}>
			<Box role="rowgroup">
				<Box
					role="row"
					sx={[
						rowGrid,
						(theme) => ({
							minHeight: 44,
							bgcolor: theme.vars.palette.kosh.surface2,
							color: theme.vars.palette.kosh.ink2,
							fontSize: "0.75rem",
							fontWeight: 700,
							letterSpacing: "0.05em",
							textTransform: "uppercase",
						}),
					]}
				>
					<Box role="columnheader">{HOLDINGS.columns.script}</Box>
					<Box role="columnheader" sx={wideOnly}>
						{HOLDINGS.columns.heldIn}
					</Box>
					<SortHeader column="value" label={HOLDINGS.columns.value} sort={sort} onSort={onSort} />
					<SortHeader column="return" label={HOLDINGS.columns.returns} sort={sort} onSort={onSort} />
					<Box role="columnheader" sx={{ textAlign: { md: "right", lg: "left" } }}>
						{HOLDINGS.columns.vs}
					</Box>
					<SortHeader column="effect" label={HOLDINGS.columns.effect} sort={sort} onSort={onSort} />
				</Box>
			</Box>
			<Box role="rowgroup">
				{rows.map((holding) => (
					<HoldingRow key={holding.instrumentId} holding={holding} largestGap={largestGap} search={search} />
				))}
			</Box>
		</Box>
		{footer}
	</Box>
);

interface SortHeaderProps {
	column: SortKey;
	label: string;
	sort: Sort;
	onSort: (key: SortKey) => void;
}

/** A column that can be sorted: its name is the button, the arrow says which way it runs. */
const SortHeader = ({ column, label, sort, onSort }: SortHeaderProps) => {
	const active = sort.key === column;
	return (
		<Box
			role="columnheader"
			aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
			// The name ends where the figures under it end; the arrow sits before it, in the gap.
			sx={{ display: "flex", justifyContent: "flex-end" }}
		>
			<ButtonBase
				onClick={() => onSort(column)}
				title={HOLDINGS.sortBy(label)}
				sx={(theme) => ({
					font: "inherit",
					letterSpacing: "inherit",
					textTransform: "inherit",
					color: active ? theme.vars.palette.kosh.ink : "inherit",
					minHeight: 44,
					flex: "none",
					borderRadius: 1,
					"&:hover": { color: theme.vars.palette.kosh.ink },
					"&:focus-visible": { outline: `2px solid ${theme.vars.palette.kosh.accent}`, outlineOffset: 2 },
				})}
			>
				<IconChevronDown
					aria-hidden
					sx={{
						fontSize: 18,
						visibility: active ? "visible" : "hidden",
						transform: active && sort.dir === "asc" ? "rotate(180deg)" : "none",
					}}
				/>
				{label}
			</ButtonBase>
		</Box>
	);
};

interface HoldingRowProps {
	holding: Holding;
	largestGap: number;
	search: string;
}

const HoldingRow = ({ holding, largestGap, search }: HoldingRowProps) => {
	const heldIn = heldInWords(holding.heldIn) ?? HOLDINGS.notHeldNow;
	const points = pointsOf(holding);
	const standing = standingOf(holding);
	return (
		<Box
			role="row"
			sx={[
				rowGrid,
				linkedRow,
				(theme) => ({
					minHeight: 60,
					py: 0.75,
					borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
					"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
				}),
			]}
		>
			<Box role="cell" sx={{ minWidth: 0 }}>
				<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 0.75, rowGap: 0.25 }}>
					<RowLink to={`${scriptPath(holding.instrumentId)}${search}`}>{holding.name}</RowLink>
					{holding.sold && <Tag>{HOLDINGS.sold}</Tag>}
					{!holding.sold && holding.price === null && <Tag tone="pending">{HOLDINGS.noMarketPrice}</Tag>}
				</Box>
				<Typography variant="caption" component="div" sx={{ color: "text.secondary" }}>
					{KIND_OF_ONE[holding.assetClass]}
					<Box component="span" sx={{ display: { md: "inline", lg: "none" } }}>{` · ${heldIn}`}</Box>
				</Typography>
			</Box>
			<Box role="cell" sx={[wideOnly, { minWidth: 0 }]}>
				<Typography variant="body2" sx={{ color: "text.secondary", overflowWrap: "anywhere" }}>
					{heldIn}
				</Typography>
			</Box>
			<Box role="cell" sx={right}>
				<Money value={holding.value} sx={{ fontWeight: 700 }} />
			</Box>
			<Box role="cell" sx={right}>
				{/* Green only when it beat the same money in NIFTY; a loss is red whatever NIFTY did. */}
				<Percent
					value={holding.xirr}
					tone={holding.xirr !== null && holding.xirr < 0 ? "neg" : standing === "ahead" ? "pos" : "plain"}
					sx={{ fontWeight: 700 }}
				/>
			</Box>
			<Box role="cell" sx={{ minWidth: 0 }}>
				{points === null ? (
					<Typography variant="caption" component="div" sx={{ color: "text.secondary" }}>
						{standing === null ? HOLDINGS.notComparedYet : HOLDINGS.noYearlyRate}
					</Typography>
				) : (
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.25, justifyContent: { md: "flex-end", lg: "flex-start" } }}>
						<DivergingBar value={points} max={largestGap} width={96} sx={{ display: { md: "none", lg: "block" } }} />
						<Typography
							variant="numeric"
							component="span"
							sx={(theme) => ({
								fontSize: "0.8125rem",
								fontWeight: 700,
								whiteSpace: "nowrap",
								color: points < -0.0005 ? theme.vars.palette.kosh.neg : theme.vars.palette.kosh.ink,
							})}
						>
							{pointsWords(points)}
						</Typography>
					</Box>
				)}
			</Box>
			<Box role="cell" sx={right}>
				<Money value={holding.effect} sign="always" tone="auto" sx={{ fontSize: "0.8125rem", fontWeight: 700 }} />
			</Box>
		</Box>
	);
};
