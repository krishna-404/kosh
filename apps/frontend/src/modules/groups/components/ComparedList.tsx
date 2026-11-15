import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { DivergingBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconClock } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { GROUPS } from "@frontend/copy/groups.copy";
import type { ReactNode } from "react";
import { leaningOf } from "../groups.utils";
import {
	AheadAmount,
	AheadPoints,
	type ComparedRow,
	RowLink,
	RowMore,
	reasonOf,
} from "./ComparedParts";

interface ComparedListProps {
	rows: readonly ComparedRow[];
	/** The largest gap among ranked groups: the longest bar. */
	widest: number;
	onMore: (row: ComparedRow, anchor: HTMLElement) => void;
}

/**
 * The comparison where there is no room for columns (a phone, a narrow
 * window): the same rows in the same order, each figure with its own words.
 */
export const ComparedList = ({ rows, widest, onMore }: ComparedListProps) => (
	<Box
		component="ul"
		aria-label={GROUPS.table.label}
		sx={(theme) => ({
			m: 0,
			p: 0,
			listStyle: "none",
			"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
		})}
	>
		{rows.map((row) => (
			<ListRow key={row.group.id} row={row} widest={widest} onMore={(anchor) => onMore(row, anchor)} />
		))}
	</Box>
);

interface ListRowProps {
	row: ComparedRow;
	widest: number;
	onMore: (anchor: HTMLElement) => void;
}

const ListRow = ({ row, widest, onMore }: ListRowProps) => {
	const { figures, standing } = row;
	const ranked = standing === "ranked" && figures && figures.aheadPoints !== null ? figures : null;
	const count = row.memberLabels.length;
	const kindAndAccounts = [
		row.kindLabel,
		count === 0 ? GROUPS.noAccountsShort : GROUPS.accountsCount(count),
	]
		.filter(Boolean)
		.join(" · ");

	let below: ReactNode;
	if (standing === "pending") below = <Skeleton width="80%" />;
	else if (ranked)
		below = (
			<Typography variant="caption" component="p" sx={{ m: 0 }}>
				<Money value={ranked.value} notation="compact" sx={{ fontWeight: 700, color: "text.primary" }} />
				{" · "}
				<Percent value={ranked.xirr} sx={{ fontWeight: 700, color: "text.primary" }} /> {GROUPS.aYear}
				{" · "}
				{GROUPS.niftyAt} <Percent value={ranked.benchmarkXirr} />
				{" · "}
				<Box component="span" sx={{ whiteSpace: "nowrap" }}>
					{ranked.yearsCounted === 0
						? GROUPS.noFullYear
						: GROUPS.yearsOfShort(ranked.yearsAhead, ranked.yearsCounted)}
				</Box>
			</Typography>
		);
	else
		below = (
			<>
				{standing !== "none" && figures && (
					<Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
						<Money value={figures.value} notation="compact" sx={{ fontWeight: 700 }} />
						{standing === "short" && (
							<Tag tone="pending" icon={<IconClock />}>
								{GROUPS.shortHistory.title}
							</Tag>
						)}
					</Box>
				)}
				<Typography variant="caption" component="p" sx={{ m: 0 }}>
					{/* Nothing uploaded is a dash with its reason, never a zero. */}
					{standing === "none" && "— "}
					{reasonOf(row)}
				</Typography>
			</>
		);

	return (
		<Box
			component="li"
			sx={{
				position: "relative",
				display: "flex",
				flexDirection: "column",
				gap: 0.5,
				px: 2,
				py: 1.5,
			}}
		>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr) auto 40px",
					columnGap: 1,
					alignItems: "center",
					// The ⋯ button is 44px tall; the row should not grow by its slack.
					my: -0.5,
				}}
			>
				<Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
					<RowLink row={row} />
					<Typography variant="caption" noWrap>
						{kindAndAccounts}
					</Typography>
				</Box>
				{ranked && ranked.aheadPoints !== null ? (
					<Box sx={{ textAlign: "right" }}>
						<Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.75 }}>
							<DivergingBar value={ranked.aheadPoints} max={widest} width={48} />
							<AheadPoints points={ranked.aheadPoints} />
						</Box>
						<Typography variant="caption" component="div" noWrap>
							{leaningOf(ranked.aheadPoints) === "level" ? (
								GROUPS.levelWith
							) : (
								<AheadAmount amount={ranked.aheadAmount} notation="compact" />
							)}
						</Typography>
					</Box>
				) : (
					<span />
				)}
				<RowMore row={row} onMore={onMore} />
			</Box>
			{below}
		</Box>
	);
};
