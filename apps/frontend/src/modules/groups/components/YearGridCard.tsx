import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { GROUPS } from "@frontend/copy/groups.copy";
import { useCallback } from "react";
import { leaningOf, type YearCell, type YearGrid } from "../groups.utils";

/** Four years fit a phone's width beside the names; more scroll sideways inside the card. */
const NAME_COLUMN = { xs: 100, md: 170 } as const;
const YEAR_COLUMN = { xs: 52, md: 60 } as const;

/** Read out, not shown: what a mark stands for where there is no room to write it. */
const srOnly = {
	position: "absolute",
	width: "1px",
	height: "1px",
	overflow: "hidden",
	clipPath: "inset(50%)",
	whiteSpace: "nowrap",
} as const;

/**
 * One year for one group. Ahead and behind differ by their sign and their
 * word (read out), not only by the tint; a part-year is outlined, not filled.
 */
const Cell = ({ cell }: { cell: YearCell }) => {
	if (cell.points === null)
		return (
			<Box
				sx={(theme) => ({
					height: 34,
					display: "grid",
					placeItems: "center",
					color: theme.vars.palette.kosh.ink3,
				})}
			>
				<span aria-hidden>—</span>
				<Box component="span" sx={srOnly}>
					{GROUPS.years.notThere}
				</Box>
			</Box>
		);
	const leaning = leaningOf(cell.points);
	return (
		<Typography
			component="div"
			variant="numeric"
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				const look = {
					ahead: { bg: k.accentSoft, fg: k.accentText },
					behind: { bg: k.dangerSoft, fg: k.dangerText },
					level: { bg: k.surface2, fg: k.ink2 },
				}[leaning];
				return {
					height: 34,
					display: "grid",
					placeItems: "center",
					borderRadius: "999px",
					fontSize: theme.typography.body2.fontSize,
					fontWeight: 700,
					color: look.fg,
					...(cell.partYear
						? { border: `1.5px dashed ${k.line2}` }
						: { bgcolor: look.bg }),
				};
			}}
		>
			<span>
				{formatPercent(cell.points, { sign: "always", suffix: "" })}
				<Box component="span" sx={srOnly}>
					{` ${GROUPS[leaning]}${cell.partYear ? `, ${GROUPS.years.partYear}` : ""}`}
				</Box>
			</span>
		</Typography>
	);
};

interface YearGridCardProps {
	grid: YearGrid;
	/** Each group's name, by id. */
	names: ReadonlyMap<string, string>;
	/** The year still running — its column says "so far". */
	thisYear: number;
}

/**
 * Year by year: each group's return minus NIFTY's on the same money, one
 * calendar year a column. With many years the grid scrolls sideways inside
 * its card and the group names stay put.
 */
export const YearGridCard = ({ grid, names, thisYear }: YearGridCardProps) => {
	// Where the years do not all fit, it opens on the latest ones.
	const showLatest = useCallback((scroller: HTMLDivElement | null) => {
		if (scroller) scroller.scrollLeft = scroller.scrollWidth;
	}, []);
	if (grid.rows.length === 0) return null;
	const anyPartYear = grid.rows.some((row) => row.cells.some((cell) => cell.partYear));
	return (
		<SectionCard title={GROUPS.years.title}>
			{/* Positioned, so the read-out-only words in the cells scroll with them instead of widening the page. */}
			<Box ref={showLatest} sx={{ position: "relative", overflowX: "auto" }}>
				<Box
					component="table"
					sx={(theme) => ({
						width: "100%",
						minWidth: {
							xs: NAME_COLUMN.xs + grid.years.length * YEAR_COLUMN.xs,
							md: NAME_COLUMN.md + grid.years.length * YEAR_COLUMN.md,
						},
						tableLayout: "fixed",
						borderCollapse: "collapse",
						"& th, & td": { p: "3px", fontWeight: "inherit" },
						"& thead th": { textAlign: "center", pb: 0.75 },
						"& th:first-of-type": {
							width: NAME_COLUMN,
							pl: 0,
							pr: 1.5,
							textAlign: "left",
							// Stays in place while the years scroll under it.
							position: "sticky",
							left: 0,
							zIndex: 1,
							bgcolor: theme.vars.palette.kosh.surface,
						},
					})}
				>
					<thead>
						<tr>
							<th scope="col">
								<Box component="span" sx={srOnly}>
									{GROUPS.table.group}
								</Box>
							</th>
							{grid.years.map((year) => (
								<th key={year} scope="col">
									<Typography variant="caption" component="span" sx={{ fontWeight: 700 }}>
										{year}
									</Typography>
									{year === thisYear && (
										<Typography variant="caption" component="span" sx={{ display: "block", mt: -0.25 }}>
											{GROUPS.years.soFar}
										</Typography>
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{grid.rows.map((row) => (
							<tr key={row.groupId}>
								<th scope="row">
									<Typography
										variant="subtitle2"
										component="span"
										sx={{
											display: "-webkit-box",
											WebkitLineClamp: 2,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
											overflowWrap: "anywhere",
											lineHeight: 1.25,
										}}
									>
										{names.get(row.groupId) ?? ""}
									</Typography>
								</th>
								{row.cells.map((cell) => (
									<td key={cell.year}>
										<Cell cell={cell} />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</Box>
			</Box>
			{anyPartYear && (
				<Typography variant="caption" component="p" sx={{ m: 0, mt: 1.5 }}>
					{GROUPS.years.note(thisYear)}
				</Typography>
			)}
		</SectionCard>
	);
};
