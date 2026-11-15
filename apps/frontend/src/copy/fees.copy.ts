import type { FeeKind } from "@connected-repo/zod-schemas/kosh/income.zod";

/**
 * Words for the fund-manager fee panel of an account: what a manager or
 * adviser is paid from outside the account, what that has come to, and — for
 * an owner — setting, changing and stopping it.
 *
 * The design has no board for the panel itself; these follow its words where
 * it speaks of the fee ("Fund manager’s fee · 1.5% a year", "after the fund
 * manager’s fee", "Before fees … after …") and its wording rules: buttons say
 * what will happen; never role, tenant, grant, permission, user, revoke.
 *
 * The "how it is worked out" sentences say what the server really does
 * (`apps/backend/src/modules/fees/services/fee_charges.ts`). Change them
 * together.
 */

const count = (n: number, one: string, many: string): string =>
	`${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

export const FEES = {
	title: "Fund manager’s fee",
	loading: "Loading the fund manager’s fee…",
	loadFailed: "Couldn’t load the fund manager’s fee.",
	retry: "Try again",

	// ─── Nothing set ─────────────────────────────────────────────────────
	none: {
		title: "No fund manager’s fee is set for this account",
		/** When one ran before and has stopped. */
		titleNow: "No fund manager’s fee is set for this account now",
		/** The one thing people get wrong, said plainly. */
		body: "A fee the broker takes inside the account is already in the statements, and already counted. Set this only when the manager or adviser is paid from outside the account — by bank transfer, say.",
		stopped: (date: string): string =>
			`The last one stopped after ${date}. What it came to is still counted in the return.`,
		set: "Set what the manager is paid",
		ownerOnly: "Only an owner can set this.",
	},

	// ─── The arrangement, as a sentence ──────────────────────────────────
	/** What is paid — the start of the sentence, one form per kind. */
	terms: {
		percentOfAssets: (rate: string): string => `${rate} of the account’s value a year`,
		fixed: (amount: string): string => `${amount} a year`,
		profitShare: (share: string): string => `${share} of each year’s profit`,
		profitShareAbove: (share: string, hurdle: string): string =>
			`${share} of each year’s profit above a hurdle of ${hurdle}`,
		invoiced: "Paid by invoice",
		invoicedTo: (payee: string): string => `Paid by invoice to ${payee}`,
	},
	paidTo: (payee: string): string => `paid to ${payee}`,
	/** When it runs — the end of the sentence. */
	since: (date: string): string => `since ${date}`,
	from: (date: string): string => `from ${date}`,
	fromTo: (from: string, to: string): string => `from ${from} to ${to}`,
	onOnly: (date: string): string => `on ${date} only`,
	until: (date: string): string => `until ${date}`,
	endingToday: "ending today",

	notStarted: "Not started yet",
	/** A change already entered for a later day. */
	next: (sentence: string): string => `Then: ${sentence}`,
	/** Why Kosh needs telling. */
	outside:
		"This is paid from outside the account, so no statement shows it. Kosh works out what it comes to and shows every return after it.",
	ownerOnlyChange: "Only an owner can change this.",

	// ─── How each kind is worked out (what the server really does) ───────
	howTitle: "How it’s worked out",
	/** `quarterEnds` is "31 Mar, 30 Jun, 30 Sept and 31 Dec"; `yearEnd` is "31 Mar" — as the kit writes dates. */
	how: {
		percent_of_assets: (quarterEnds: string): string =>
			`Each day is charged a 365th of the yearly rate on what the account was worth at the end of that day. The days are added up and billed at each quarter end: ${quarterEnds}.`,
		fixed: (quarterEnds: string): string =>
			`The yearly amount is spread evenly, a 365th for each day, and billed at each quarter end: ${quarterEnds}.`,
		profit_share: (yearEnd: string): string =>
			`Settled each ${yearEnd} on that financial year’s profit above the hurdle: the rise in the account’s value, less money put in, plus money taken out (dividends count as taken out). A bad year is not carried forward.`,
		invoiced: "Nothing is worked out. Exactly the payments entered are counted, each on the day it was paid.",
	},
	/** Added for a profit share with a hurdle. */
	howHurdle: (hurdle: string): string =>
		`The hurdle is ${hurdle} a year on the account’s average daily value, in proportion for a part year.`,
	/** Added for every kind Kosh works out itself. */
	howBuiltUp:
		"What has built up since the last bill is counted too, so the return is never flattered by a bill that hasn’t arrived.",

	// ─── What it has come to ─────────────────────────────────────────────
	effect: {
		title: "What it has come to",
		/** When no fee is running now but earlier ones were charged. */
		titleEarlier: "What earlier fees came to",
		total: "Fees so far",
		charges: (n: number): string => count(n, "charge", "charges"),
		payments: (n: number): string => count(n, "payment", "payments"),
		since: (date: string): string => `since ${date}`,
		before: "Return before fees",
		after: "Return after fees",
		aYear: "a year",
		pair: "The return before and after fees",
		nothingYet: "Nothing has been charged yet, so the return is as it was.",
		nothingYetInvoiced: "No payment has been counted yet, so the return is as it was.",
		took: (points: string): string => `Fees have taken ${points} a year off the return.`,
		added: (points: string): string => `The return is ${points} a year higher after fees.`,
		same: "So far fees have made no difference you can see in the yearly return.",
		unknown: "A yearly return can’t be worked out for this account yet, so neither can the difference fees make.",
		shortWindow: "With less than a year of history, yearly figures swing a lot.",
		/** "Before fees this account was 7.9 pts a year ahead of NIFTY 50; after, 6.2 pts ahead." */
		against: (before: string, after: string): string => `Before fees this account was ${before}; after, ${after}.`,
		ahead: (points: string, name: string): string => `${points} a year ahead of ${name}`,
		behind: (points: string, name: string): string => `${points} a year behind ${name}`,
		level: (name: string): string => `level with ${name}`,
		aheadShort: (points: string): string => `${points} ahead`,
		behindShort: (points: string): string => `${points} behind`,
		levelShort: "level",
		returnsFailed: "Couldn’t load the return, so before and after fees can’t be shown.",
	},

	// ─── Charges ─────────────────────────────────────────────────────────
	charges: {
		title: "What has been charged",
		lead: "Each is counted as money paid from outside the account on that day. Newest first.",
		caption: "Fund manager’s fees counted against the return, newest first",
		notBilled: "Not billed yet",
		builtUpSince: (date: string): string => `Built up since ${date}`,
		builtUp: "Built up since the last bill",
		lastOfArrangement: "Up to the day that arrangement stopped",
		payment: "A payment entered",
		showAll: (n: number): string => `Show all ${n.toLocaleString("en-IN")}`,
		showFewer: "Show fewer",
	},

	// ─── Payments (billed by invoice) ────────────────────────────────────
	payments: {
		title: "Payments entered",
		lead: "Exactly these are counted, each on the day it was paid.",
		leadEarlier: "From when the manager was paid by invoice.",
		add: "Add a payment",
		empty: "No payments entered yet.",
		emptyOwner: "No payments entered yet. Add each one as it is paid — until then nothing is counted.",
		notCounted: "Not counted",
		notCountedWhy: "Paid on a day when no invoice arrangement was running",
		remove: (amount: string, date: string): string => `Remove the ${amount} payment of ${date}`,
		confirmTitle: "Remove this payment?",
		confirmBody: (amount: string, date: string): string =>
			`${amount} paid on ${date} stops being counted, and the return is worked out again.`,
		confirm: "Remove payment",
		keep: "Keep",
		removed: (amount: string): string => `Payment of ${amount} removed`,
		undo: "Undo",
		putBack: (amount: string): string => `Payment of ${amount} put back`,
		removeFailed: "Couldn’t remove the payment. Try again.",
		putBackFailed: "Couldn’t put the payment back. Add it again.",
	},

	// ─── Earlier arrangements ────────────────────────────────────────────
	earlier: {
		title: "Earlier arrangements",
		lead: "What they came to stays counted.",
	},

	// ─── Owner actions ───────────────────────────────────────────────────
	change: "Change",
	stop: "Stop the fee from a date",
	cancel: "Cancel",

	// Set / change
	form: {
		titleSet: "What the manager is paid",
		titleChange: "Change what the manager is paid",
		subtitle: (account: string): string => `${account} · paid from outside the account`,
		kindLabel: "How is the manager paid?",
		kinds: {
			percent_of_assets: {
				title: "A percentage of the account’s value",
				hint: "A yearly rate on what the account is worth, like 1.5% a year.",
			},
			fixed: {
				title: "A fixed amount a year",
				hint: "The same amount every year, whatever the account does.",
			},
			profit_share: {
				title: "A share of the profit",
				hint: "Part of each year’s profit, above a hurdle if there is one.",
			},
			invoiced: {
				title: "By invoice",
				hint: "Whatever is actually paid. You enter each payment as it is made.",
			},
		} satisfies Record<FeeKind, { title: string; hint: string }>,

		rate: "Rate a year",
		rateHelper: "As a percentage, like 1.5.",
		amount: "Amount a year",
		amountHelper: "In rupees, like 1,20,000.",
		share: "Share of the profit",
		shareHelper: "As a percentage, like 20.",
		hurdle: "Hurdle a year (optional)",
		hurdleHelper: "Only profit above this is shared. Leave empty for none.",
		payee: "Who is paid (optional)",
		payeeHelper: "The manager’s or adviser’s name.",
		startsOn: "From which day",
		startsOnHelper:
			"An earlier day is fine: the fee is worked out from that day, and returns since then are worked out again.",
		fromStart: (date: string): string => `Change it from its first day, ${date}`,

		problems: {
			rateEmpty: "Give the yearly rate, like 1.5.",
			shareEmpty: "Give the share of the profit, like 20.",
			notPercent: "That doesn’t look like a percentage. Type a number, like 1.5.",
			percentZero: "It has to be more than zero.",
			percentTooBig: "It can’t be more than 100%.",
			percentTooFine: "Use at most four decimal places.",
			amountEmpty: "Give the yearly amount.",
			notAmount: "That doesn’t look like an amount. Type rupees, like 120000 or 6420.50.",
			amountZero: "The amount has to be more than zero.",
			dayMissing: "Choose the day it starts.",
		},

		/** What happens to what is already there — said before saving. */
		/** `terms` reads mid-sentence: "1.5% of the account’s value a year, paid to Ramesh Iyer". */
		keeps: (terms: string, lastDay: string): string =>
			`Up to ${lastDay} nothing changes: it stays ${terms}. This takes over the day after.`,
		replaces: (n: number, from: string): string =>
			n === 1
				? `The arrangement starting on or after ${from} is replaced by this one, and the fee from that day is worked out again.`
				: `The ${n} arrangements starting on or after ${from} are replaced by this one, and the fee from that day is worked out again.`,
		untouched: "Earlier arrangements stay as they are.",

		submitSet: "Set the fee",
		submitChange: "Change the fee",
		saving: "Saving…",
		failed: "Couldn’t save the fee. Try again.",
		doneSet: (account: string): string => `Fund manager’s fee set for ${account}`,
		doneChange: (account: string, date: string): string =>
			`Fund manager’s fee for ${account} changed from ${date}`,
	},

	// Stop
	stopForm: {
		title: (account: string): string => `Stop the fee on ${account}?`,
		lastDay: "Last day it is charged",
		body: "Nothing is charged after that day. What was charged up to then stays counted in the return.",
		dayMissing: "Choose the last day it is charged.",
		tooEarly: (date: string): string => `It started on ${date}, so it can’t stop before then.`,
		tooLate: (date: string): string => `It already stops after ${date}. Choose that day or an earlier one.`,
		submit: (date: string): string => `Stop after ${date}`,
		submitBare: "Stop the fee",
		keep: "Keep it running",
		failed: "Couldn’t stop the fee. Try again.",
		done: (account: string, date: string): string => `The fee on ${account} stops after ${date}`,
	},

	// Add a payment
	payForm: {
		title: "Add a payment",
		titleTo: (payee: string): string => `Add a payment to ${payee}`,
		subtitle: (account: string): string => `${account} · paid from outside the account`,
		paidOn: "Paid on",
		amount: "Amount",
		amountHelper: "In rupees, like 25,000.",
		note: "Note (optional)",
		noteHelper: "An invoice number, or what it was for.",
		amountMissing: "Give the amount that was paid.",
		dayMissing: "Choose the day it was paid.",
		dayAhead: "That date hasn’t come yet.",
		/** Shown before saving when the day falls outside the invoice arrangement. */
		dayOutside:
			"No invoice arrangement was running on that day, so this payment would be kept but not counted.",
		submit: "Add payment",
		failed: "Couldn’t add the payment. Try again.",
		done: (amount: string): string => `Payment of ${amount} added`,
	},
} as const;
