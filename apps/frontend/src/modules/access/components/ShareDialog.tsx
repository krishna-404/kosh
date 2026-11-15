/**
 * The share dialog: who has access to one account (or to all of a holder's
 * accounts), and inviting someone new through "Check before you send".
 *
 * Opened from Accounts and people, Who can see what, and the account page.
 * `target` null means closed.
 */
export interface ShareDialogProps {
	target: { accountId: string } | { personId: string } | null;
	onClose: () => void;
	/** Prefill the invite field (e.g. "Share more with Sunita"). */
	initialEmail?: string;
}

// Placeholder until the dialog is built (phase 2, accounts-and-sharing work).
export const ShareDialog = (_props: ShareDialogProps) => null;
