import { NAV } from "@frontend/copy/nav.copy";

/**
 * Words for the pages an invite link leads to — from the design's wording
 * board. No amounts, and nothing about what was shared unless the invite is
 * the signed-in person's own.
 *
 * Never in the UI: role, tenant, grant, permission, ACL, user, revoke,
 * collaborator, entity. Say person, remove, "Can view", "Can edit", "Owner".
 */
export const INVITE = {
	pageTitle: "Invite",
	/** When the inviter's name is not known. */
	someone: "Whoever invited you",
	someoneLower: "whoever invited you",

	yours: {
		title: "It’s in your accounts now",
		body: (inviter: string, email: string) =>
			`${inviter} shared it with ${email}, the address you’re signed in with. You’ll find it under ${NAV.shared}.`,
		action: "Go to your accounts",
	},

	otherEmail: {
		title: "This invite is for a different email",
		/** "[Inviter] sent it to " + masked + ". You’re signed in as " + email + "." */
		sentTo: (inviter: string) => `${inviter} sent it to `,
		signedInAs: ". You’re signed in as ",
		nothingShown:
			"Nothing from the invite is shown until you sign in with the address it was sent to.",
		signInOther: "Sign in with the other email",
		askToSendHere: (inviter: string) => `Ask ${inviter} to send it here`,
		askTitle: (inviter: string) => `What to tell ${inviter}`,
		/** "Kosh can’t pass this on for you. Ask [inviter] to invite " + email + " instead…" */
		askLead: (inviter: string) =>
			`Kosh can’t pass this on for you — nothing has been sent. Ask ${inviter} to invite `,
		askTail: " instead. They do it from the account’s Share button, and can cancel the old invite there.",
		copyEmail: "Copy my email address",
		copied: (email: string) => `Copied ${email}`,
		copyFailed: "Couldn’t copy. Select the address above instead.",
	},

	expired: {
		title: "This invite has expired",
		body: (inviter: string) => `Ask ${inviter} to send a new one.`,
	},
	cancelled: {
		title: "This invite was cancelled",
		body: (inviter: string) => `Ask ${inviter} to send a new one.`,
	},
	accepted: {
		title: "This invite has already been used",
		/** masked may be missing */
		body: (masked: string | null) =>
			masked
				? `Someone signed in with ${masked}, the address it was sent to, and it now belongs to them.`
				: "Someone signed in with the address it was sent to, and it now belongs to them.",
		notYou: (inviter: string) =>
			`If it was meant for the address you’re signed in with, ask ${inviter} to send a new one here.`,
	},
	notFound: {
		title: "This link doesn’t lead anywhere",
		body: "It may have been cut short or mistyped. Open the link from the invite email again, or ask whoever invited you to send a new one.",
	},
	goToAccounts: "Go to your accounts",
	loadFailed: "Couldn’t check this invite.",
	tryAgain: "Try again",
} as const;

export const WRONG_PERSON = {
	pageTitle: "Did this reach the wrong person?",
	title: "Did this reach the wrong person?",
	body: "If you weren’t expecting an invite to Kosh, you can stop it here. Nothing has been shared with anyone yet — an invite only works once someone signs in with the address it was sent to.",
	stop: "Yes, stop this invite",
	stopping: "Stopping…",
	meantForMe: "It was meant for me — open Kosh",
	doneTitle: "Thanks — that invite no longer works",
	doneBody: "Nothing was shared. You don’t need to do anything else, and you can close this page.",
	incomplete:
		"This link looks incomplete, so nothing was stopped. Open it again from the invite email.",
	failed: "Couldn’t stop the invite. Check your connection and try again.",
} as const;
