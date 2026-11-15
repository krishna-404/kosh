import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Box } from "@connected-repo/ui-mui/layout/Box";

const DOT_WIDTH = 14;

interface FactsProps {
	/** Short facts, in reading order: "Ex-date 3 Nov 2026", "35 shares × ₹26.00". */
	parts: readonly string[];
	/** The grid area the line sits in. */
	gridArea?: string;
	/** Space to leave at the left, in px (to sit under a label rather than its icon). */
	inset?: number;
}

/**
 * A quiet line of facts with a dot between them. When the line is too
 * narrow it breaks between facts, never inside one unless a single fact is
 * wider than the line — and no line starts or ends with a stray dot: every
 * fact carries its dot in front, and the first one on each line is tucked
 * out of sight.
 */
export const Facts = ({ parts, gridArea, inset = 0 }: FactsProps) => (
	<Typography
		variant="caption"
		component="span"
		// A margin, not padding: the hidden dots must fall outside the box that clips them.
		sx={{ display: "block", gridArea, minWidth: 0, overflow: "hidden", ml: `${inset}px` }}
	>
		<Box component="span" sx={{ display: "flex", flexWrap: "wrap", ml: `-${DOT_WIDTH}px` }}>
			{parts.map((part) => (
				<Box
					component="span"
					key={part}
					sx={{
						minWidth: 0,
						"&::before": { content: '"·"', display: "inline-block", width: DOT_WIDTH, textAlign: "center" },
					}}
				>
					{part}
				</Box>
			))}
		</Box>
	</Typography>
);
