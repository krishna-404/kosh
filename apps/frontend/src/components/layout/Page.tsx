import { IconBack } from "@connected-repo/ui-mui/kosh/icons";
import { PageHeader } from "@connected-repo/ui-mui/kosh/PageHeader";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useShellSlots } from "./shell.context";

interface PageProps {
	/** The page's name — also the browser tab title and the phone app-bar title. */
	title: string;
	/**
	 * What the desktop h1 says when it is not the page's name — the Overview
	 * greets by name ("Good evening, Anil") while its tab and app bar still
	 * say "Overview".
	 */
	heading?: string;
	/** One sentence under the title: what this page is for. */
	subtitle?: ReactNode;
	eyebrow?: ReactNode;
	/** Desktop only: a mark left of the title, and something on the title's own line. */
	leading?: ReactNode;
	titleEnd?: ReactNode;
	/** Buttons beside the title on desktop (below the subtitle on a phone). */
	actions?: ReactNode;
	/** One icon button for the phone's app bar, e.g. "add". */
	barAction?: ReactNode;
	/** Path the back arrow returns to, for pages one level down. */
	back?: string;
	children?: ReactNode;
}

/**
 * Every routed screen is a <Page>. It names the screen once and puts that
 * name where each layout wants it: an h1 on desktop, the app bar on a phone,
 * and the browser tab everywhere.
 */
export const Page = ({
	title,
	heading,
	subtitle,
	eyebrow,
	leading,
	titleEnd,
	actions,
	barAction,
	back,
	children,
}: PageProps) => {
	const slots = useShellSlots();
	const navigate = useNavigate();

	useEffect(() => {
		document.title = `${title} · Kosh`;
	}, [title]);

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.75 } }}>
			{slots.title && createPortal(title, slots.title)}
			{slots.leading &&
				back &&
				createPortal(
					<IconButton aria-label="Back" onClick={() => navigate(back)}>
						<IconBack />
					</IconButton>,
					slots.leading,
				)}
			{slots.action && barAction && createPortal(barAction, slots.action)}
			<PageHeader
				title={heading ?? title}
				subtitle={subtitle}
				eyebrow={eyebrow}
				leading={leading}
				titleEnd={titleEnd}
				actions={actions}
			/>
			{children}
		</Box>
	);
};
