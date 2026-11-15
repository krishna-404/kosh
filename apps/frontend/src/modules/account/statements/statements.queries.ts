import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQuery } from "@tanstack/react-query";

/**
 * What the "Statements and questions" tab reads, one hook per list. All four
 * are refetched by `useRefreshMoney()` after anything changes.
 */

/** What Kosh could not work out by itself for this account. */
export const useQuestions = (accountId: string) =>
	useQuery(orpc.questions.list.queryOptions({ input: { accountId } }));

/** Every upload so far, newest first — the undone ones too. */
export const useUploads = (accountId: string) => useQuery(orpc.imports.list.queryOptions({ input: { accountId } }));

/** How complete the account's history is, and what is missing. */
export const useHistory = (accountId: string) => useQuery(orpc.imports.history.queryOptions({ input: { accountId } }));

/** The splits and bonuses standing on the account. */
export const useAppliedActions = (accountId: string) =>
	useQuery(orpc.questions.corporateActions.queryOptions({ input: { accountId } }));
