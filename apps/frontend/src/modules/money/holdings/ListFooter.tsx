import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Checkbox } from "@connected-repo/ui-mui/form/Checkbox";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { HOLDINGS } from "@frontend/copy/holdings.copy";
import type { SortKey } from "./holdings.utils";

interface ListFooterProps {
	shown: number;
	total: number;
	sortKey: SortKey;
	includeSold: boolean;
	onIncludeSold: (on: boolean) => void;
	onShowAll: () => void;
}

/**
 * Under the rows: how many are showing and in what order, the choice to
 * list what has been sold as well, and "Show all" while some are held back.
 */
export const ListFooter = ({ shown, total, sortKey, includeSold, onIncludeSold, onShowAll }: ListFooterProps) => (
	<Box
		sx={(theme) => ({
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			columnGap: 1.5,
			rowGap: 0.25,
			px: { xs: 2, md: 2.5 },
			py: 1,
			borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
		})}
	>
		<Typography variant="body2" aria-live="polite" sx={{ flex: "1 1 220px", color: "text.secondary", py: 0.75 }}>
			{`${HOLDINGS.showing(shown, total)} · ${HOLDINGS.sortedBy[sortKey]}`}
		</Typography>
		<Typography
			variant="body2"
			component="label"
			sx={{ display: "flex", alignItems: "center", minHeight: 44, ml: -1.125, cursor: "pointer" }}
		>
			<Checkbox checked={includeSold} onChange={(event) => onIncludeSold(event.target.checked)} />
			{HOLDINGS.includeSold}
		</Typography>
		{shown < total && (
			<Button variant="text" onClick={onShowAll}>
				{HOLDINGS.showAll(total)}
			</Button>
		)}
	</Box>
);
