import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

interface PageHeaderProps {
	title: ReactNode;
	/** One sentence under the title: what this page is for. */
	subtitle?: ReactNode;
	/** Small label above the title ("Welcome back, Ramesh"). */
	eyebrow?: ReactNode;
	/** A mark at the left of the title — a broker's mark on an account's page. Desktop only. */
	leading?: ReactNode;
	/** Something that belongs on the title's own line — the level badge beside an account's name. Desktop only. */
	titleEnd?: ReactNode;
	/** Buttons at the right, primary last. */
	actions?: ReactNode;
	/**
	 * On a phone the app bar already carries the title, so the page hides its
	 * own. Set false for pages shown without the app bar.
	 */
	titleInAppBarOnPhone?: boolean;
	sx?: SxProps<Theme>;
}

/** The top of a page: title, what it is for, and its main actions. */
export const PageHeader = ({
	title,
	subtitle,
	eyebrow,
	leading,
	titleEnd,
	actions,
	titleInAppBarOnPhone = true,
	sx,
}: PageHeaderProps) => (
	<Box
		component="header"
		sx={[
			{
				display: "flex",
				flexWrap: "wrap",
				alignItems: "flex-start",
				gap: 2,
			},
			...(Array.isArray(sx) ? sx : [sx]),
		]}
	>
		<Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
			{eyebrow && (
				<Typography variant="eyebrow" component="div" sx={{ mb: 0.5 }}>
					{eyebrow}
				</Typography>
			)}
			<Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
				{leading && <Box sx={{ display: { xs: "none", md: "block" }, flex: "none" }}>{leading}</Box>}
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5 }}>
						<Typography
							variant="h1"
							sx={titleInAppBarOnPhone ? { display: { xs: "none", md: "block" } } : undefined}
						>
							{title}
						</Typography>
						{titleEnd && <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>{titleEnd}</Box>}
					</Box>
					{subtitle && (
						<Typography color="text.secondary" sx={{ mt: { xs: 0, md: 0.75 }, maxWidth: 640 }}>
							{subtitle}
						</Typography>
					)}
				</Box>
			</Box>
		</Box>
		{actions && (
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
				{actions}
			</Box>
		)}
	</Box>
);
