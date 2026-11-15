import type { Period } from "@connected-repo/zod-schemas/kosh/money.zod";

/**
 * Words every money page shares: the period, the scope picker, the names
 * of what "the same money" is compared with, and the honest caveats.
 * Page-specific words live in that page's own copy file.
 */
export const MONEY = {
	period: {
		"1y": "1 year",
		"3y": "3 years",
		"5y": "5 years",
		all: "Since you started",
	} satisfies Record<Period, string>,
	periodLabel: "Period",

	// Scope picker
	everything: "Everything you can see",
	everythingShort: "Everything",
	scopeLabel: "Which accounts",
	scopeGroups: "Your groups",
	scopePeople: "People",
	scopeAccounts: "Accounts",
	allOf: (possessiveName: string): string => `All of ${possessiveName} accounts`,
	accounts: (count: number): string => (count === 1 ? "1 account" : `${count} accounts`),
	scopeGone: "That selection isn’t there any more, so this shows everything you can see.",

	// Returns
	xirr: "Return (XIRR)",
	aYear: "a year",
	sameMoneyIn: (name: string): string => `Same money in ${name}`,
	wouldBe: "would be",
	ahead: "ahead",
	behind: "behind",

	// Chart
	chartShowTable: "Show the numbers",
	chartHideTable: "Hide the numbers",
	chartDate: "Date",

	// Honest caveats (from `flags` on the returns)
	pricesAsOf: (date: string): string => `Prices as of ${date}`,
	pricesLoading: "Prices are still coming in. Figures will fill in over the next few minutes.",
	shortWindow: "Less than a year of history, so a yearly return would mislead. This is the growth so far.",
	noLedger: (count: number): string =>
		count === 1
			? "One account has trades but no ledger yet, so deposits are worked out from the trades."
			: `${count} accounts have trades but no ledger yet, so deposits are worked out from the trades.`,
	unpriced: (count: number): string =>
		count === 1 ? "1 holding has no market price yet and is counted at the price last paid." : `${count} holdings have no market price yet and are counted at the price last paid.`,
	questionsWaiting: (count: number): string =>
		count === 1 ? "1 question is waiting. Figures use the best guess until it’s answered." : `${count} questions are waiting. Figures use the best guess until they’re answered.`,

	loadFailed: "Couldn’t load these figures.",
	retry: "Try again",
} as const;
