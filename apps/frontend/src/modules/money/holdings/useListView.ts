import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { type ListView, viewFromParams, withView } from "./holdings.utils";

/**
 * The list's filter and "include sold" choice.
 *
 * They are written into the address (`?show=behind&sold=1`, beside the
 * scope) so that opening a script and coming back finds the list as it was
 * left, and a filtered list can be bookmarked. The page itself reads them
 * from its own state: the address only catches up once the router has
 * finished its navigation, and a chip or a tick box must answer at once.
 */
export const useListView = () => {
	const [params, setParams] = useSearchParams();
	const [view, setView] = useState<ListView>(() => viewFromParams(params));

	const change = (patch: Partial<ListView>) => {
		const next = { ...view, ...patch };
		setView(next);
		// Both choices are written every time, so a change made while the last one
		// is still on its way to the address cannot undo it.
		setParams((current) => withView(current, next), { replace: true });
	};

	/** The address query as it will be once it has caught up — what a link to a script carries. */
	const search = useMemo(() => {
		const query = withView(params, view).toString();
		return query ? `?${query}` : "";
	}, [params, view]);

	return { ...view, change, search };
};
