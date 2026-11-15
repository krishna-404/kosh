import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface StatProps {
	/** What the figure is, in plain words ("Value today"). */
	label: ReactNode;
	/** The figure — usually a <Money> or <Percent>. */
	value: ReactNode;
	/** A quiet line under it ("on the same deposits and withdrawals"). */
	hint?: ReactNode;
	/** `lg` for the one headline figure on a card; `md` for the rest. */
	size?: "md" | "lg";
	sx?: SxProps<Theme>;
}

/** A labelled figure. The label says what it is; the hint says how to read it. */
export const Stat = ({ label, value, hint, size = "md", sx }: StatProps) => (
	<Box sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
		<Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
			{label}
		</Typography>
		<Typography
			component="div"
			variant={size === "lg" ? "figure" : "h2"}
			sx={{ mt: 0.25, fontVariantNumeric: "tabular-nums" }}
		>
			{value}
		</Typography>
		{hint && (
			<Typography variant="body2" component="div" sx={{ mt: 0.25 }}>
				{hint}
			</Typography>
		)}
	</Box>
);
