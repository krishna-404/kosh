import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";

/**
 * How a row that holds a `RowLink` must be set: the link's target is laid
 * over the whole row, and the row tints under the pointer.
 */
export const linkedRow = {
	position: "relative",
	transition: "background-color 200ms",
} as const;

interface RowLinkProps {
	to: string;
	children: ReactNode;
}

/**
 * A row's name as a link whose target covers the whole row — one real link
 * per row, so it opens in a new tab and reads as a link, without wrapping
 * the row's other cells in an anchor. The row needs `linkedRow`.
 */
export const RowLink = ({ to, children }: RowLinkProps) => (
	<Box
		component={RouterLink}
		to={to}
		sx={(theme) => ({
			color: "inherit",
			fontWeight: 700,
			textDecoration: "none",
			overflowWrap: "anywhere",
			outline: "none",
			"&::after": { content: '""', position: "absolute", inset: 0 },
			"&:focus-visible::after": {
				outline: `2px solid ${theme.vars.palette.kosh.accent}`,
				outlineOffset: -2,
			},
		})}
	>
		{children}
	</Box>
);
