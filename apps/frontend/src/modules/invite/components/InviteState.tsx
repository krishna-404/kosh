import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { ReactNode } from "react";

interface InviteStateProps {
	icon: ReactNode;
	tone?: "accent" | "warn";
	title: ReactNode;
	/** Paragraphs under the title. */
	children?: ReactNode;
	/** Buttons, primary first; they stack full-width on a phone. */
	actions?: ReactNode;
	/** Something a button opens, shown under the buttons. */
	after?: ReactNode;
	/** The heading level: the page's own title on a page with no other. */
	headingLevel?: "h1" | "h2";
}

/**
 * What an invite link led to: a picture, a sentence, and what to do next.
 * The empty-state layout, with room for more than one paragraph and for
 * buttons that fill the width on a phone.
 */
export const InviteState = ({
	icon,
	tone = "accent",
	title,
	children,
	actions,
	after,
	headingLevel = "h2",
}: InviteStateProps) => (
	<Box
		sx={{
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			textAlign: "center",
			gap: 1.5,
			px: { xs: 0.5, md: 3 },
			py: { xs: 3, md: 6 },
		}}
	>
		<SpotIcon size="lg" tone={tone}>
			{icon}
		</SpotIcon>
		<Typography variant="h2" component={headingLevel} sx={{ mt: 1 }}>
			{title}
		</Typography>
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				gap: 1.25,
				maxWidth: 480,
				overflowWrap: "anywhere",
			}}
		>
			{children}
		</Box>
		{actions && (
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: "stretch",
					gap: 1.25,
					mt: 1.5,
					width: "100%",
					maxWidth: 360,
				}}
			>
				{actions}
			</Box>
		)}
		{after && <Box sx={{ width: "100%", maxWidth: 480 }}>{after}</Box>}
	</Box>
);
