import type { DirectoryAccount, DirectoryHolder } from "@connected-repo/zod-schemas/kosh/people.zod";

/** What every tab of the account page is told about the account it is showing. */
export interface AccountInfo {
	account: DirectoryAccount;
	holder: DirectoryHolder;
	/** Can edit or Owner: may upload, undo and answer. */
	canEdit: boolean;
	/** "Zerodha", or the name typed in for a broker Kosh does not know. */
	broker: string;
	/** Who shared the account, by first name — who to ask for what this level cannot do. */
	ask: string | null;
}
