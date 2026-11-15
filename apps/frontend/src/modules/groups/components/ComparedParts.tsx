import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { IconMore } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import type { Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { GROUPS } from "@frontend/copy/groups.copy";
import { Link } from "react-router";
import { type ComparedGroup, leaningOf, type Standing } from "../groups.utils";

/** One group as the comparison shows it: who is in it, where it stands, its figures. */
export interface ComparedRow {
	group: Group;
	/** Its place among the person's groups, oldest first — picks the tile's colour. */
	tile: number;
	kindLabel: string | null;
	/** The labels of the accounts in it that the person can still see. */
	memberLabels: readonly string[];
	standing: Standing;
	/** Undefined while they load, and for a group the comparison does not know yet. */
	figures: ComparedGroup | undefined;
	/** Its full calendar years, oldest first. */
	years: readonly { year: number; ahead: boolean }[];
	/** The Overview, narrowed to this group. */
	href: string;
}

/** "Sunita · Zerodha", "Riya · Dhan, Kabir · Zerodha", "3 accounts" — names while they fit on a line. */
export const accountsLine = (labels: readonly string[]): string =>
	labels.length === 0
		? GROUPS.noAccountsShort
		: labels.length <= 2
			? labels.join(", ")
			: GROUPS.accountsCount(labels.length);

/** Why a group has no comparison, in a sentence. Null for a group that is ranked. */
export const reasonOf = (row: ComparedRow): string | null => {
	if (row.standing === "none")
		return row.memberLabels.length === 0 ? GROUPS.noMembers : GROUPS.nothingUploaded;
	if (row.standing === "short") return GROUPS.shortHistory.body(row.group.name);
	if (row.standing === "unranked") return GROUPS.noReturn;
	return null;
};

/**
 * The group's name as the link to its Overview. The link's hit area is the
 * whole row (the row must be `position: relative`); anything else in the row
 * that can be pressed sits above it.
 */
export const RowLink = ({ row }: { row: ComparedRow }) => (
	<Typography
		component={Link}
		to={row.href}
		variant="subtitle2"
		noWrap
		title={GROUPS.openIn(row.group.name)}
		sx={(theme) => ({
			minWidth: 0,
			color: theme.vars.palette.kosh.ink,
			textDecoration: "none",
			outline: "none",
			// Above the row's figures and bars, below its ⋯ button.
			"&::after": { content: '""', position: "absolute", inset: 0, zIndex: 1 },
			"&:focus-visible::after": {
				outline: `2px solid ${theme.vars.palette.kosh.accent}`,
				outlineOffset: "-2px",
				borderRadius: "inherit",
			},
		})}
	>
		{row.group.name}
	</Typography>
);

/** The ⋯ button that opens a group's own actions. */
export const RowMore = ({ row, onMore }: { row: ComparedRow; onMore: (anchor: HTMLElement) => void }) => (
	<IconButton
		aria-label={GROUPS.more(row.group.name)}
		aria-haspopup="menu"
		onClick={(event) => onMore(event.currentTarget)}
		// Above the row's link, which covers the whole row.
		sx={{ position: "relative", zIndex: 2, mr: -1 }}
	>
		<IconMore />
	</IconButton>
);

/** "+2.4 pts": percentage points a year ahead of NIFTY, or behind it. Red only when behind. */
export const AheadPoints = ({ points }: { points: number }) => (
	<Percent
		value={points}
		sign="always"
		suffix=" pts"
		tone={leaningOf(points) === "behind" ? "neg" : "plain"}
		sx={(theme) => ({ fontWeight: 700, fontSize: theme.typography.body2.fontSize })}
	/>
);

/** "₹2,01,137 ahead" — the same gap in rupees, with the word, not only a sign. */
export const AheadAmount = ({
	amount,
	notation = "full",
}: {
	amount: string | null;
	notation?: "full" | "compact";
}) => {
	if (amount === null) return null;
	const n = Number(amount);
	return (
		<>
			<Money value={Math.abs(n)} notation={notation} />{" "}
			{n > 0 ? GROUPS.ahead : n < 0 ? GROUPS.behind : GROUPS.level}
		</>
	);
};

/** One mark per full calendar year: filled where the group beat NIFTY. The words beside it carry the count. */
export const YearMarks = ({ years }: { years: ComparedRow["years"] }) => (
	<Box component="span" aria-hidden sx={{ display: "inline-flex", flexWrap: "wrap", gap: "3px" }}>
		{years.map(({ year, ahead }) => (
			<Box
				key={year}
				component="i"
				sx={(theme) => {
					const k = theme.vars.palette.kosh;
					return {
						width: 10,
						height: 14,
						borderRadius: "3px",
						border: `1.5px solid ${ahead ? k.ink : k.ink3}`,
						bgcolor: ahead ? k.ink : "transparent",
					};
				}}
			/>
		))}
	</Box>
);

/** The marks are drawn only when they tell the same story as the count. */
export const marksAgree = (row: ComparedRow): boolean =>
	row.figures !== undefined &&
	row.years.length === row.figures.yearsCounted &&
	row.years.filter((mark) => mark.ahead).length === row.figures.yearsAhead;
