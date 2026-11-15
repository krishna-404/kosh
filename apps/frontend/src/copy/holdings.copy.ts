import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";

/**
 * Words for Holdings and for the page of one script ("script" is Kosh's word
 * for one share, fund or ETF). Words every money page shares are in
 * `money.copy.ts`.
 */

type AssetClass = Holding["assetClass"];

/** What every script is judged against. The holdings figures have only this one. */
const NIFTY = "NIFTY";

const scripts = (count: number): string => (count === 1 ? "1 script" : `${count} scripts`);
const accounts = (count: number): string => (count === 1 ? "1 account" : `${count} accounts`);

/** The kinds of asset, as a heading ("Stocks · 64%"). "Funds" covers mutual funds and ETFs. */
export const KIND_LABEL: Record<AssetClass, string> = {
	stocks: "Stocks",
	funds: "Funds",
	gold: "Gold",
	bonds: "Bonds",
	other: "Other",
};

/** The kind of one script, under its name. */
export const KIND_OF_ONE: Record<AssetClass, string> = {
	stocks: "Stock",
	funds: "Fund",
	gold: "Gold",
	bonds: "Bond",
	other: "Other",
};

/** The kinds inside a sentence ("No gold here is behind NIFTY right now."). */
const KIND_IN_SENTENCE: Record<AssetClass, string> = {
	stocks: "stock",
	funds: "fund",
	gold: "gold",
	bonds: "bond",
	other: "other holding",
};

export const HOLDINGS = {
	fallbackSubtitle: "Every share and fund in the accounts you’re looking at.",
	/** "41 scripts in 6 accounts." — and, when sold ones are listed too, "…, and 3 more you’ve sold." */
	count: (held: number, accountCount: number, sold = 0): string =>
		`${scripts(held)} in ${accounts(accountCount)}${sold > 0 ? `, and ${sold} more you’ve sold` : ""}.`,
	judged: `Each is judged on its own buys and sells, against the same money put in ${NIFTY} on the same dates.`,

	// The make-up card
	makeUpTitle: "What it’s made of",
	makeUpSummary: (parts: readonly string[]): string => `What it’s made of: ${parts.join(", ")}.`,
	kindShare: (kind: string, share: string): string => `${kind} · ${share}`,
	underOne: "under 1%",

	// Filters
	filterLabel: "Ahead of or behind NIFTY",
	all: (count: number): string => `All ${count}`,
	ahead: (count: number): string => `Ahead · ${count}`,
	behind: (count: number): string => `Behind · ${count}`,
	kindFilterLabel: "Kind of asset",
	allKinds: "All types",

	// The table
	tableLabel: "Scripts, each against the same money in NIFTY",
	columns: {
		script: "Script",
		heldIn: "Held in",
		value: "Value",
		returns: "Return",
		vs: `vs ${NIFTY}, same money`,
		effect: "Effect",
	},
	sortBy: (column: string): string => `Sort by ${column}`,
	sortLabel: "Sort by",
	sortChoice: {
		effect: "Effect in rupees",
		value: "Value",
		return: "Return",
	},
	pointsAhead: (points: string): string => `${points} ahead`,
	pointsBehind: (points: string): string => `${points} behind`,
	pointsLevel: "Level",
	sold: "Sold",
	notHeldNow: "Not held now",
	noMarketPrice: "No market price",
	/** In place of the comparison when there is none to show. */
	notComparedYet: `Not compared yet: ${NIFTY}’s prices aren’t in.`,
	notComparedShort: "Not compared yet",
	noYearlyRate: "No yearly return could be worked out.",

	// Under the table
	showing: (shown: number, total: number): string => `Showing ${shown} of ${total}`,
	sortedBy: {
		effect: "sorted by effect in rupees",
		value: "sorted by value",
		return: "sorted by return",
	},
	includeSold: "Include scripts you’ve sold",
	showAll: (count: number): string => `Show all ${count}`,

	effectNote: `“Effect” is how many rupees more (or less) you have than if the same money had gone into ${NIFTY} on the same days. “vs ${NIFTY}” is the gap between the two yearly returns, in percentage points.`,

	// Nothing to show
	emptyScoped: {
		title: "Nothing held here yet",
		body: "The accounts you’re looking at have no statements yet. Upload one from Accounts and people, or look at everything you can see.",
		showEverything: "Show everything you can see",
	},
	nothingHeldNow: {
		title: "Nothing is held right now",
		body: "Everything bought in these accounts has been sold. Include the scripts you’ve sold to see how each one did.",
	},
	noTrades: {
		title: "No shares or funds yet",
		body: "These accounts have statements, but nothing has been bought in them so far.",
	},
	noneBehind: {
		title: `Nothing is behind ${NIFTY} right now`,
		body: `Every script here has done better than the same money in ${NIFTY}.`,
	},
	noneAhead: {
		title: `Nothing is ahead of ${NIFTY} right now`,
		body: `Every script here has done worse than the same money in ${NIFTY}.`,
	},
	noneCompared: {
		title: `Nothing can be compared with ${NIFTY} yet`,
		body: `${NIFTY}’s prices aren’t in yet, so no script can be judged. They are all listed under All.`,
	},
	noneOfKind: {
		title: "Nothing matches",
		ahead: (kind: AssetClass): string => `No ${KIND_IN_SENTENCE[kind]} here is ahead of ${NIFTY} right now.`,
		behind: (kind: AssetClass): string => `No ${KIND_IN_SENTENCE[kind]} here is behind ${NIFTY} right now.`,
	},
	showAllScripts: "Show all scripts",
} as const;

export const SCRIPT = {
	/** The page's name until the script's own name has loaded. */
	title: "Script",
	crumbLabel: "Where this page sits",

	notHere: {
		title: "This script isn’t here",
		body: "Nothing in the accounts you’re looking at has bought or sold it. It may be in other accounts, or in one that is no longer shared with you.",
		back: "Back to Holdings",
		lookEverywhere: "Look in everything you can see",
	},

	// Figures
	valueToday: "Value today",
	soldOut: "You’ve sold all of it",
	/** "299 at ₹2,106 each" */
	quantityAt: (quantity: string, price: string): string => `${quantity} at ${price} each`,
	priceOf: (date: string): string => `Price of ${date}`,
	lastPaid: "No market price yet, so this is at the price last paid.",
	invested: "Money invested",
	trades: (buys: number, sells: number): string => {
		const bought = buys === 1 ? "1 buy" : `${buys} buys`;
		const sold = sells === 1 ? "1 sell" : `${sells} sells`;
		return sells === 0 ? bought : `${bought}, ${sold}`;
	},
	gain: "Gain",
	gainHint: "Today’s value plus sales and dividends, minus buys",
	returns: "Return (XIRR)",
	noReturn: "A yearly return couldn’t be worked out from these buys and sells.",

	// The same money in NIFTY
	sameMoneyEyebrow: "Same money, another choice",
	sameMoneyTitle: `If the same money had gone into ${NIFTY}`,
	sameMoneyBody: "The same buys and sells, on the same dates. Only where the money went changes.",
	thisScript: "This script",
	nifty: NIFTY,
	aYear: "a year",
	stillWouldBe: {
		before: `The same money in ${NIFTY} would be `,
		more: (amount: string): string => `${amount} more`,
	},
	aheadOf: {
		before: "On the same buys and sells, this is ",
		ahead: (amount: string): string => `${amount} ahead of ${NIFTY}`,
		after: (benchmarkValue: string): string => `, which would be worth ${benchmarkValue}.`,
	},
	soldAhead: {
		before: "You’ve sold all of it. On the same buys and sells you came out ",
		ahead: (amount: string): string => `${amount} ahead of ${NIFTY}`,
	},
	soldBehind: {
		before: `You’ve sold all of it. On the same buys and sells, ${NIFTY} would have left you `,
		more: (amount: string): string => `${amount} more`,
	},
	notCompared: `This can’t be compared with ${NIFTY} yet: ${NIFTY}’s prices aren’t in.`,

	// Price chart
	priceTitle: "Price",
	priceBody: "Closing price since the first buy.",
	priceSeries: "Closing price",
	priceSummary: (name: string, from: string, to: string, first: string, last: string): string =>
		`${name}’s closing price from ${from} to ${to}: from ${first} to ${last}.`,
	noPrices: "There are no market prices for this script yet.",

	// Where it's held
	heldTitle: "Where it’s held",
	since: (month: string): string => `Since ${month}`,
	heldQuantity: (quantity: string): string => `${quantity} held`,
	notHeld: "It isn’t held in any of these accounts now.",

	// About
	aboutTitle: "About this script",
	symbol: "Symbol",
	kind: "Kind",
	isin: "ISIN",
	shareOfHoldings: "Share of these holdings",
	underTenth: "under 0.1%",

	// Buys and sells
	tradesTitle: "Buys and sells",
	tradesLabel: "Buys and sells of this script",
	tradeColumns: {
		date: "Date",
		account: "Account",
		side: "Buy or sell",
		quantity: "Quantity",
		price: "Price",
		amount: "Amount",
	},
	bought: "Bought",
	sold: "Sold",
	/** Phone: "Bought 299 at ₹834.50" */
	tradeLine: (side: string, quantity: string, price: string): string => `${side} ${quantity} at ${price}`,
	showingTrades: (shown: number, total: number): string => `Showing the latest ${shown} of ${total}`,
	showAll: (count: number): string => `Show all ${count}`,
	noTrades: "No buys or sells of it are in these accounts’ statements.",
} as const;
