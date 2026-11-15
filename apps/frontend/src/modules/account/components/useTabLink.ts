import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { type AccountTab, TAB_PARAM, tabSearch } from "../account.utils";

/**
 * Links and moves between the tabs of the account page. The tab lives in the
 * address (`?tab=holdings`), so a tab can be bookmarked and the back button
 * returns to the one before.
 */
export const useTabLink = () => {
	const [params, setParams] = useSearchParams();
	const raw = params.get(TAB_PARAM);

	/** A `to` for a router link: this page, on that tab. */
	const linkTo = useCallback(
		(tab: AccountTab, extra?: Record<string, string>) => ({ search: tabSearch(params, tab, extra) }),
		[params],
	);
	const goTo = useCallback(
		(tab: AccountTab) => setParams((current) => new URLSearchParams(tabSearch(current, tab))),
		[setParams],
	);

	return { raw, linkTo, goTo };
};
