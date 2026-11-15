import { Table, TableContainer } from "@connected-repo/ui-mui/data-display/Table";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { ReactNode } from "react";

/**
 * In the page for screen readers, out of sight for everyone else. The sizes
 * are strings on purpose: in `sx`, a bare 1 means 100%.
 */
export const visuallyHidden = {
	position: "absolute",
	width: "1px",
	height: "1px",
	overflow: "hidden",
	clip: "rect(0 0 0 0)",
	clipPath: "inset(50%)",
	whiteSpace: "nowrap",
} as const;

interface DataTableProps {
	/** What the table lists, for screen readers. */
	caption: string;
	/** Narrowest the table is drawn; below it, it scrolls inside its card — never the page. */
	minWidth?: number;
	children: ReactNode;
}

/**
 * A table of figures inside a card: a real <table> with a caption, tighter
 * cells than the theme's default so seven columns fit, figures top-aligned
 * with their second lines, and no rule under the last row.
 */
export const DataTable = ({ caption, minWidth = 560, children }: DataTableProps) => (
	<TableContainer sx={{ overflowX: "auto" }}>
		<Table
			sx={(theme) => ({
				minWidth,
				// The first and last cells line up with the card's own padding. (Written
				// with sibling selectors: a row may start with a <th> and carry on in <td>s.)
				"& tr > *": { pl: 2.5, pr: 1.25, py: 1.5, verticalAlign: "top" },
				"& tr > * + *": { pl: 1.25 },
				"& thead th:last-of-type, & td:last-of-type": { pr: 2.5 },
				"& thead th": { verticalAlign: "bottom", lineHeight: 1.3 },
				"& tbody tr:last-of-type > *": { borderBottom: 0 },
				"& tfoot td, & tfoot th": {
					borderBottom: 0,
					borderTop: `1px solid ${theme.vars.palette.kosh.line2}`,
					color: theme.vars.palette.kosh.ink,
					fontSize: "0.875rem",
					fontWeight: 700,
				},
			})}
		>
			<Box component="caption" sx={visuallyHidden}>
				{caption}
			</Box>
			{children}
		</Table>
	</TableContainer>
);

/** A quiet second line inside a cell. */
export const cellNote = { display: "block", mt: 0.25 } as const;
