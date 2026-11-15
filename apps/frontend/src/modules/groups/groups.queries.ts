import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * After a group is made, changed or deleted: refetch the groups themselves
 * (with everything else that lists them) and the figures worked out from
 * them — the comparison and "What if" are per group.
 */
export const useRefreshGroups = () => {
	const queryClient = useQueryClient();
	const refreshPeople = useRefreshPeople();
	return useCallback(
		() => Promise.all([refreshPeople(), queryClient.invalidateQueries({ queryKey: orpc.money.key() })]),
		[queryClient, refreshPeople],
	);
};
