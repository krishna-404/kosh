import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Every holder and account the signed-in person can see, with their level
 * on each. The one source for the accounts screens, the group picker and the
 * share preview — fetched once and shared through the query cache.
 */
export const useDirectory = () => useQuery(orpc.portfolio.directory.queryOptions());

/** New shares, lost access and owner invites to confirm. */
export const useAccessNotices = () => useQuery(orpc.access.notices.queryOptions());

/**
 * After anything that changes people, accounts, sharing or groups: refetch
 * what is on screen. Sharing touches many views at once (the directory, the
 * people list, who-can-see-what, activity), so they are refreshed together
 * rather than each mutation guessing which ones it affected.
 */
export const useRefreshPeople = () => {
	const queryClient = useQueryClient();
	return useCallback(
		() =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: orpc.portfolio.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.access.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.activity.key() }),
			]),
		[queryClient],
	);
};
