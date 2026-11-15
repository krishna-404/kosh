import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { ReactNode } from "react";

/** Rows with a hairline between them, as a real list (`<ul>` of `<li>`). */
export const FeeRows = ({ label, children }: { label: string; children: ReactNode }) => (
	<Box
		component="ul"
		aria-label={label}
		sx={(theme) => ({
			m: 0,
			p: 0,
			listStyle: "none",
			"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
		})}
	>
		{children}
	</Box>
);

interface FeeRowProps {
	/** The day, or the arrangement in words. */
	primary: ReactNode;
	/** A status in words beside the first line ("Not billed yet"). */
	tag?: ReactNode;
	/** A quiet line under it. It wraps: an explanation is never cut short. */
	secondary?: ReactNode;
	/** The amount, at the right. */
	amount?: ReactNode;
	/** One icon button after the amount. */
	action?: ReactNode;
}

/**
 * One charge, payment or arrangement: what and when at the left, the amount
 * at the right. Unlike the kit's row, the second line wraps — here it carries
 * the reason a figure is what it is.
 */
export const FeeRow = ({ primary, tag, secondary, amount, action }: FeeRowProps) => (
	<Box
		component="li"
		sx={{
			display: "flex",
			alignItems: "center",
			gap: 1.5,
			minHeight: 52,
			pl: 2.5,
			pr: action ? 1 : 2.5,
			py: 1.25,
		}}
	>
		<Box sx={{ flex: 1, minWidth: 0 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1, rowGap: 0.5 }}>
				<Typography component="span" variant="subtitle2" sx={{ fontWeight: 600 }}>
					{primary}
				</Typography>
				{tag}
			</Box>
			{secondary && (
				<Typography component="div" variant="caption" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
					{secondary}
				</Typography>
			)}
		</Box>
		{amount && (
			<Typography component="span" sx={{ flex: "none", fontWeight: 600 }}>
				{amount}
			</Typography>
		)}
		{action}
	</Box>
);
