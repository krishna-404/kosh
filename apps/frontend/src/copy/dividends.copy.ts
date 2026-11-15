import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";

/**
 * Words for an account's dividends panel: what Kosh worked out was due,
 * the answers a person can give, and what each answer did.
 *
 * Amounts, dates and quantities arrive already formatted (see
 * `modules/account/dividends/dividends.utils.ts`), so this file is words only.
 */

const dividends = (n: number): string => (n === 1 ? "1 dividend" : `${n.toLocaleString("en-IN")} dividends`);

export const DIVIDENDS = {
	/** Names the panel for assistive technology; the page it sits on gives the visible title. */
	label: "Dividends",

	// What this is, before anything else.
	lead: {
		why: "A dividend is paid straight to the bank, not to the broker — so no statement shows it, and Kosh works out what was due from the exchange’s announcement and the shares held.",
		/** For someone who can answer, and for someone who can only look. */
		counted: (canAnswer: boolean): string =>
			canAnswer
				? "Each one is counted in the return from its ex-date (the day the share stopped carrying the dividend) until you say when it arrived."
				: "Each one is counted in the return from its ex-date (the day the share stopped carrying the dividend) until someone who can edit this account says when it arrived.",
		tax: "Amounts are before any tax held back.",
	},

	// The summary
	countedLabel: "Dividends counted in the return",
	countedFrom: (count: number): string => `from ${dividends(count)}`,
	leftOut: (count: number): string =>
		count === 1 ? "1 not received is left out" : `${count.toLocaleString("en-IN")} not received are left out`,
	nothingCounted: "Nothing is counted — none of these arrived.",

	waiting: {
		title: (count: number): string =>
			count === 1
				? "1 dividend is still on Kosh’s working alone"
				: `${count.toLocaleString("en-IN")} dividends are still on Kosh’s working alone`,
		body: (count: number, total: string): string =>
			count === 1
				? `${total}, counted as worked out. Confirm it if it arrived as expected, or say what really happened in the list below.`
				: `${total} in all, counted as worked out. Confirm them together if they arrived as expected, or answer them one at a time in the list below.`,
		confirmAll: (count: number, total: string): string =>
			count === 1 ? `Confirm it as expected · ${total}` : `Confirm all ${count.toLocaleString("en-IN")} as expected · ${total}`,
		/** For someone who can only look. */
		viewerBody: "They are counted as Kosh worked them out until then.",
	},
	nothingWaiting: { title: "Nothing waiting", body: "Every dividend on this account has an answer." },
	/** Who can confirm, for someone who cannot. */
	whoCanAnswer: "Someone who can edit this account can confirm dividends, say what really arrived, or add one Kosh missed.",

	// The list
	list: {
		title: "Every dividend",
		subtitle: "Newest first, by financial year (April to March)",
		year: (label: string): string => `FY ${label}`,
		count: dividends,
		toConfirm: (count: number): string => `${count.toLocaleString("en-IN")} to confirm`,
		notReceived: (count: number): string => `${count.toLocaleString("en-IN")} not received`,
		/** Read out with a year's total, which is otherwise a bare figure. */
		yearTotal: "Counted",
	},

	// One dividend
	state: {
		expected: "To confirm",
		confirmed: "Confirmed",
		not_received: "Not received",
	} satisfies Record<Dividend["state"], string>,
	exDate: (date: string): string => `Ex-date ${date}`,
	arrived: (date: string): string => `arrived ${date}`,
	arrivedOn: (date: string): string => `Arrived ${date}`,
	shares: (quantity: string, perShare: string, one: boolean): string =>
		`${quantity} ${one ? "share" : "shares"} × ${perShare}`,
	workedOut: (amount: string): string => `worked out ${amount}`,
	byHand: "Added by hand",
	notCounted: "not counted",
	announcement: (words: string): string => `The exchange’s words: “${words}”`,

	// What can be done about one
	act: {
		menu: (name: string, date: string): string => `Options for ${name}, ${date}`,
		confirm: "Confirm",
		confirmAmount: (amount: string): string => `Confirm ${amount}`,
		confirmLabel: (name: string, amount: string, date: string): string => `Confirm ${amount} from ${name}, ${date}`,
		confirmHint: "It arrived as Kosh worked out.",
		different: "The amount is different",
		differentHint: "Say what arrived, and when.",
		changeAgain: "Change the amount or date",
		never: "It never arrived",
		neverHint: "It stops counting, and stays in this list.",
		undo: "Undo",
		undoLabel: (name: string, date: string): string => `Undo the answer for ${name}, ${date}`,
		undoHint: (amount: string, date: string): string => `Back to Kosh’s working: ${amount} on ${date}.`,
		undoAdded: "Takes this added dividend out again.",
		done: "Done",
	},

	// "The amount is different"
	change: {
		title: "The amount is different",
		titleAdded: "Change this dividend",
		subtitle: (name: string, date: string): string => `${name} · ex-date ${date}`,
		subtitleAdded: (name: string): string => `${name} · added by hand`,
		workingTitle: "Kosh’s working",
		working: (sentence: string, amount: string): string => `${sentence} = ${amount}`,
		amountLabel: "What arrived, before tax",
		amountHelper: "If tax was held back (TDS), add it to what the bank shows.",
		amountInvalid: "Enter an amount in rupees, like 6420 or 6420.50.",
		amountZero: "If nothing arrived, choose “It never arrived” instead.",
		amountZeroAdded: "Enter what arrived. To take it out, use Undo instead.",
		dateLabel: "The day it arrived",
		dateHelper: (exDate: string): string => `On or after the ex-date, ${exDate}. Leave it if you’re not sure.`,
		dateHelperAdded: "The day it reached the bank.",
		dateMissing: "Choose the day it arrived.",
		save: "Confirm",
		saveAmount: (amount: string): string => `Confirm ${amount}`,
		/** One a person added is already confirmed; changing it is just saving. */
		saveAdded: "Save",
		saveAddedAmount: (amount: string): string => `Save ${amount}`,
		cancel: "Cancel",
		failed: "Couldn’t save that. Nothing was changed.",
	},

	// "Add a dividend Kosh missed"
	add: {
		open: "Add a dividend Kosh missed",
		prompt: "Is one missing from this list?",
		title: "Add a dividend Kosh missed",
		subtitle: "For one the exchange’s announcements didn’t carry. It counts in the return from the day it arrived.",
		scriptLabel: "Script",
		scriptHelper: "Anything this account holds, or held and has since sold.",
		scriptPlaceholder: "Choose a script",
		scriptMissing: "Choose the script that paid it.",
		amountZero: "Enter the amount that arrived.",
		sold: "sold",
		noScripts: "This account has no holdings yet, so there is nothing a dividend could have come from. Upload a statement first.",
		scriptsFailed: "Couldn’t load this account’s scripts.",
		save: "Add dividend",
		saveAmount: (amount: string): string => `Add ${amount}`,
		failed: "Couldn’t add that. Nothing was changed.",
	},

	// What just happened
	snack: {
		confirmedAll: (count: number, total: string | null): string =>
			count === 0
				? "Nothing was waiting — they had all been answered already"
				: total === null
					? `${dividends(count)} confirmed as expected`
					: `${dividends(count)} confirmed as expected · ${total}`,
		confirmed: (name: string, amount: string): string => `${name} dividend confirmed · ${amount}`,
		alreadyAnswered: (name: string): string => `The ${name} dividend had been answered already`,
		changed: (name: string, amount: string, date: string): string =>
			`${name} dividend confirmed · ${amount}, arrived ${date}`,
		never: (name: string, amount: string): string => `${name} dividend struck out · ${amount} no longer counts`,
		reopened: (name: string): string => `${name} dividend is back to Kosh’s working`,
		removed: (name: string, amount: string): string => `${name} dividend of ${amount}, added by hand, was taken out`,
		added: (name: string, amount: string): string => `${name} dividend added · ${amount}`,
		undone: "Undone — back to Kosh’s working",
		undoneAll: (count: number): string => `Undone — ${dividends(count)} back to Kosh’s working`,
		undoneSome: (failed: number): string =>
			failed === 1 ? "Couldn’t undo 1 of them. It is still confirmed." : `Couldn’t undo ${failed} of them. They are still confirmed.`,
		undoneAdded: "Undone — the dividend was taken out",
	},

	// When it goes wrong
	confirmFailed: "Couldn’t confirm that. Nothing was changed.",
	neverFailed: "Couldn’t save that. Nothing was changed.",
	undoFailed: "Couldn’t undo that.",
	loadFailed: "Couldn’t load the dividends.",
	retry: "Try again",

	// Nothing at all
	none: {
		title: "No dividends on this account yet",
		body: "They appear here when a share held in it pays one.",
	},
} as const;
