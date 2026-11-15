import { Banner } from "@connected-repo/ui-mui/kosh/Banner";

export interface StatementsTabProps {
	accountId: string;
	/** The caller can edit this account: upload, undo, answer. Without it the tab is read-only. */
	canEdit: boolean;
}

/**
 * "Statements and questions" for one account: upload → check → apply → undo,
 * the questions waiting for an answer, the uploads so far, and how complete
 * the history is. (Placeholder until the statements workstream lands.)
 */
export const StatementsTab = (_props: StatementsTabProps) => <Banner tone="info">Statements arrive here shortly.</Banner>;
