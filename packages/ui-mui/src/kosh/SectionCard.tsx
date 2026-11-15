import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Paper from "@mui/material/Paper";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ElementType, ReactNode } from "react";

interface SectionCardProps {
	title?: ReactNode;
	subtitle?: ReactNode;
	/** Shown at the right of the title row. */
	action?: ReactNode;
	/** `none` for cards whose content is a list of rows running edge to edge. */
	padding?: "normal" | "none";
	component?: ElementType;
	children?: ReactNode;
	sx?: SxProps<Theme>;
}

/** The standard white card. Titles are optional; rows go edge to edge. */
export const SectionCard = ({
	title,
	subtitle,
	action,
	padding = "normal",
	component = "section",
	children,
	sx,
}: SectionCardProps) => {
	const flush = padding === "none";
	return (
		<Card component={component} sx={sx}>
			{(title || action) && (
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						px: 2.5,
						pt: 2.5,
						pb: flush ? 1 : 0,
					}}
				>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						{title && (
							<Typography variant="h3" component="h2">
								{title}
							</Typography>
						)}
						{subtitle && <Typography variant="body2">{subtitle}</Typography>}
					</Box>
					{action}
				</Box>
			)}
			<Box sx={flush ? undefined : { p: 2.5, pt: title || action ? 1.5 : 2.5 }}>{children}</Box>
		</Card>
	);
};

interface HeroCardProps {
	children?: ReactNode;
	sx?: SxProps<Theme>;
}

/**
 * The deep-green money card. Inside it, gains read lime and quiet text pale
 * green automatically — children use the same components as anywhere else.
 */
export const HeroCard = ({ children, sx }: HeroCardProps) => (
	<Paper
		component="section"
		variant="hero"
		elevation={0}
		sx={[{ p: { xs: 2.5, md: 3.5 } }, ...(Array.isArray(sx) ? sx : [sx])]}
	>
		{children}
	</Paper>
);
