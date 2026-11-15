import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconFile, IconUpload } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { AccountInfo } from "../account.types";
import { useTabLink } from "./useTabLink";

interface LoadFailedProps {
	error: unknown;
	/** What could not be loaded, when the server gave no words of its own. */
	fallback: string;
	onRetry: () => void;
}

/** A tab whose figures could not be loaded: what went wrong, and a way to try again. */
export const LoadFailed = ({ error, fallback, onRetry }: LoadFailedProps) => (
	<Banner
		tone="bad"
		action={
			<Button variant="outlined" onClick={onRetry}>
				{ACCOUNT.retry}
			</Button>
		}
	>
		{errorWords(error, fallback)}
	</Banner>
);

interface NothingYetProps {
	info: AccountInfo;
	/** Defaults to "No statements yet" and its two sentences. */
	title?: string;
	canEditBody?: (broker: string) => string;
	viewerBody?: string;
}

/**
 * A tab with nothing to show because no statement is in. Someone who can
 * upload gets the button; someone who can only view is told who has not
 * uploaded yet — never a button they cannot use.
 */
export const NothingYet = ({
	info,
	title = ACCOUNT.nothingYet.title,
	canEditBody = ACCOUNT.nothingYet.canEdit,
	viewerBody = ACCOUNT.nothingYet.viewer,
}: NothingYetProps) => {
	const { linkTo } = useTabLink();
	return (
		<SectionCard>
			<EmptyState
				icon={<IconFile />}
				title={title}
				actions={
					info.canEdit ? (
						<Button
							variant="contained"
							startIcon={<IconUpload />}
							component={Link}
							to={linkTo("statements", { upload: "1" })}
						>
							{ACCOUNT.uploadStatement}
						</Button>
					) : undefined
				}
			>
				{info.canEdit ? canEditBody(info.broker) : viewerBody}
			</EmptyState>
		</SectionCard>
	);
};

interface RefreshingProps {
	/** The figures on screen are the earlier ones while new ones load. */
	on: boolean;
	children: ReactNode;
}

/** Figures that are being replaced are dimmed, so old numbers are not read as new. */
export const Refreshing = ({ on, children }: RefreshingProps) => (
	<Box
		aria-busy={on || undefined}
		sx={(theme) => ({
			display: "flex",
			flexDirection: "column",
			gap: { xs: 2, md: 2.25 },
			minWidth: 0,
			opacity: on ? 0.55 : 1,
			transition: theme.transitions.create("opacity", { duration: 200 }),
		})}
	>
		{children}
	</Box>
);
