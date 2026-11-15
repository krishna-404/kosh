import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { ACCOUNT } from "@frontend/copy/account.copy";

interface LoadMoreProps {
	/** The paged query's own state. */
	feed: {
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		isFetchNextPageError: boolean;
		fetchNextPage: () => unknown;
	};
	/** What to say when the next page could not be loaded. */
	failed: string;
}

/** "Load more" under a list that comes a page at a time; says so when the next page fails. */
export const LoadMore = ({ feed, failed }: LoadMoreProps) => {
	if (feed.isFetchNextPageError)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void feed.fetchNextPage()}>
						{ACCOUNT.retry}
					</Button>
				}
			>
				{failed}
			</Banner>
		);
	if (!feed.hasNextPage) return null;
	return (
		<Box sx={{ display: "flex", justifyContent: "center" }}>
			<Button variant="outlined" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
				{feed.isFetchingNextPage ? ACCOUNT.cash.loadingMore : ACCOUNT.cash.loadMore}
			</Button>
		</Box>
	);
};
