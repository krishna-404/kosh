import type { AccessLevel, CashFlowClassification } from "@connected-repo/zod-schemas/enums.zod";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";

/**
 * Words for one account's page — its header, its tabs, and the Returns,
 * Holdings, Cash flows and "How it’s worked out" tabs. From the design's
 * account boards and wording board; the square-bracket blanks on the board
 * are the function arguments here. (The "Statements and questions" tab has
 * its own file, `statements.copy.ts`.)
 *
 * Never in the UI: role, tenant, grant, permission, ACL, user, revoke,
 * collaborator, entity. Say person, remove, "Can view", "Can edit", "Owner".
 */

const count = (n: number, one: string, many: string): string =>
	`${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

export const ACCOUNT = {
	pageTitle: "Account",
	/** The same quiet line whether it never existed or is no longer shared. */
	notHere: "This account isn’t here. It may have been removed, or it is no longer shared with you.",
	loadFailed: "Couldn’t load this account.",
	retry: "Try again",

	// ─── Header ──────────────────────────────────────────────────────────
	breadcrumb: "Where this account sits",
	from: (name: string): string => `From ${name}`,

	/** The one sentence under the name: what this level lets you do. `ask` is who to turn to. */
	levelSentence: {
		view: (ask: string | null): string =>
			`You can see everything here and how it was worked out. To upload or change anything, ask ${ask ?? "an owner"}.`,
		edit: (ask: string | null): string =>
			`You can upload statements, undo your own uploads and answer questions. Sharing is up to ${ask ?? "the owners"}.`,
		owner: (): string =>
			"You can upload statements, answer questions and decide who else sees this account.",
	} satisfies Record<AccessLevel, (ask: string | null) => string>,
	/** The same, for the narrow line beside the badge on a phone. */
	levelShort: {
		view: (ask: string | null): string => `Ask ${ask ?? "an owner"} to change anything`,
		edit: (ask: string | null): string => `Sharing is up to ${ask ?? "the owners"}`,
		owner: (): string => "You decide who else sees it",
	} satisfies Record<AccessLevel, (ask: string | null) => string>,

	addToGroup: "Add to a group",
	uploadStatement: "Upload statement",
	share: "Share",

	// "Add to a group" menu
	groupsTitle: "Your groups",
	groupsNone: "You have no groups yet. A group keeps accounts together your way, and only you see it.",
	groupsLoading: "Loading your groups…",
	groupsFailed: "Couldn’t load your groups.",
	newGroup: "New group",
	addedTo: (account: string, group: string): string => `${account} is now in ${group}`,
	leftGroup: (account: string, group: string): string => `${account} left ${group}`,
	undo: "Undo",
	groupFailed: "Couldn’t change the group. Try again.",

	// ─── Tabs ────────────────────────────────────────────────────────────
	tabsLabel: "Parts of this account",
	tabs: {
		returns: "Returns",
		holdings: "Holdings",
		cash: "Cash flows",
		statements: "Statements and questions",
		"worked-out": "How it’s worked out",
	},
	questionsTag: (n: number): string => count(n, "question waiting", "questions waiting"),

	// ─── Shared by the tabs ──────────────────────────────────────────────
	nothingYet: {
		title: "No statements yet",
		/** For someone who can upload. */
		canEdit: (broker: string): string =>
			`Upload a ${broker} statement to see holdings and returns. Tradebook, ledger or holdings work.`,
		/** For someone who can only look. */
		viewer:
			"The owner hasn’t uploaded anything for this account yet. Its holdings and returns appear here once a statement is in.",
	},

	// ─── Returns ─────────────────────────────────────────────────────────
	valueToday: "Value today",
	putIn: "Money put in",
	takenOut: "Money taken out",
	deposits: (n: number): string => count(n, "deposit", "deposits"),
	withdrawals: (n: number): string => count(n, "withdrawal", "withdrawals"),
	/** Under "Money taken out": withdrawals, and dividends when some were paid out to the bank. */
	takenOutHint: (withdrawals: number, dividends: boolean): string =>
		dividends
			? withdrawals > 0
				? `${count(withdrawals, "withdrawal", "withdrawals")} and dividends`
				: "dividends, paid to the bank"
			: count(withdrawals, "withdrawal", "withdrawals"),
	returnXirr: "Return (XIRR)",
	/** "a year, Apr 2019 – today" */
	aYearFrom: (month: string): string => `a year, ${month} – today`,
	growthSoFar: "Growth so far",
	growthFrom: (month: string): string => `in total since ${month}, not a yearly rate`,
	noRate: "Can’t be worked out yet",

	sameMoneyEyebrow: "Same money, other choices",
	sameMoneyTitle: "If the same money had gone elsewhere",
	onlyWhere: "Only where the money went changes.",
	thisAccount: "This account",
	thisShort: "This",
	rowValueToday: "value today",
	chartSummary: (parts: readonly string[]): string =>
		`Value over time on the same money. Today: ${parts.join(", ")}.`,
	chartPart: (name: string, value: string): string => `${name} ${value}`,
	pricesStart: (name: string, date: string): string =>
		`${name} has prices only from ${date}, so it is compared from that day on.`,
	noValueToday: (name: string): string =>
		`${name} has no price for today yet, so it can’t be compared right now.`,
	onTheSameMoney: "On the same money, this account is ",
	seeHow: "See how these were worked out",
	seeHowShort: "How these were worked out",

	// Aside
	questions: {
		/** For someone who can answer. */
		needAnswer: (n: number): string =>
			n === 1 ? "1 question needs an answer" : `${n} questions need an answer`,
		bestGuess: "Returns use Kosh’s best guess until you answer.",
		answerThem: "Answer them",
		/** For someone who can only look. */
		beingChecked: (n: number): string =>
			n === 1 ? "1 line is still being checked" : `${n} lines are still being checked`,
		willConfirm: (n: number): string =>
			`An owner, or someone who can edit this account, will confirm ${n === 1 ? "it" : "them"}. Until then the figures use Kosh’s best guess, so the return may move slightly.`,
	},
	biggestHoldings: "Biggest holdings",
	allHoldings: (n: number): string => (n === 1 ? "The 1 holding" : `All ${n} holdings`),
	noHoldingsNow: "Nothing is held in this account right now.",
	holdingsFailed: "Couldn’t load the holdings.",
	about: "About this account",
	heldBy: "Held by",
	broker: "Broker",
	lastStatement: "Last statement",
	lastStatementBy: (day: string, who: string): string => `${day}, by ${who}`,
	you: "you",
	noStatementYet: "None yet",
	sharedWithYouBy: "Shared with you by",
	managerFee: "Fund manager’s fee",
	managerFeeNone: "None set",
	managerFeeSee: "See what it comes to",
	managerFeeSet: "Set what the manager is paid",
	feeTitle: "Fund manager’s fee",
	holderWide: {
		view: (possessiveName: string): string => `You can view all of ${possessiveName} accounts`,
		edit: (possessiveName: string): string => `You can edit all of ${possessiveName} accounts`,
		owner: (possessiveName: string): string => `You’re an owner of all of ${possessiveName} accounts`,
	} satisfies Record<AccessLevel, (possessiveName: string) => string>,

	// ─── Holdings ────────────────────────────────────────────────────────
	holdings: {
		caption: "What this account holds, each against NIFTY on the same money",
		summary: (n: number): string => count(n, "holding", "holdings"),
		worth: "worth",
		aheadBehind: (ahead: number, behind: number): string =>
			`${ahead} ahead of NIFTY on the same money, ${behind} behind`,
		includeSold: "Include scripts you’ve sold",
		filterLabel: "Which scripts to list",
		columns: {
			script: "Script",
			quantity: "Quantity",
			price: "Price",
			value: "Value",
			share: "Share of holdings",
			returns: "Return (XIRR)",
			vsNifty: "vs NIFTY on the same money",
		},
		ofHoldings: "of holdings",
		noPriceShort: "no market price yet",
		priceOn: (date: string): string => `on ${date}`,
		noPrice: "No market price yet",
		atLastPaid: "at the price last paid",
		sold: "Sold",
		aYear: "a year",
		ahead: "ahead",
		behind: "behind",
		level: "level with NIFTY",
		niftyRate: (rate: string): string => `NIFTY ${rate} a year`,
		noCompare: "Can’t be compared yet",
		open: (name: string): string => `Open ${name}`,
		noneNow: {
			title: "Nothing held right now",
			body: "Everything this account bought has been sold. Include scripts you’ve sold to see how each did.",
		},
	},

	// ─── Cash flows ──────────────────────────────────────────────────────
	cash: {
		viewLabel: "What to list",
		viewMoney: "Money in and out",
		viewTrades: "Trades",
		viewDividends: "Dividends",
		showLabel: "Which ledger lines",
		showExternal: "Deposits and withdrawals",
		showAll: "Every line",
		lede: "The ledger as Kosh understood it. Only money put in and taken out counts towards the return.",
		totals: "Over the account’s whole life:",
		totalIn: "put in",
		totalOut: "taken out",
		caption: "Ledger lines, newest first",
		columns: {
			date: "Date",
			said: "What the line said",
			took: "What Kosh took it to be",
			moneyIn: "Money in",
			moneyOut: "Money out",
		},
		in: "in",
		out: "out",
		noNarration: "No wording on this line",
		openingNarration: "Already in the account when its ledger starts",
		source: {
			answer: "Answered by a person",
			opening_balance: "Opening balance",
		},
		/** Followed by the other account's name, as a link. */
		sameMoneyAs: "The same money as a line in",
		sameMoneyElsewhere: "The same money as a line in another account",
		loadMore: "Load more",
		loadingMore: "Loading…",
		loadFailed: "Couldn’t load the ledger.",
		moreFailed: "Couldn’t load more. Try again.",
		noExternal:
			"No deposits or withdrawals in what has been uploaded so far. “Every line” shows the rest of the ledger.",
		noLedger: {
			title: "No ledger lines yet",
			canEdit: (broker: string): string =>
				`Upload a ${broker} ledger statement to see the money that went in and out.`,
			viewer: "The owner hasn’t uploaded a ledger for this account yet.",
		},

		tradesCaption: "Trades, newest first",
		tradesTotal: (n: number): string => count(n, "trade", "trades"),
		tradesNewest: ", newest first.",
		tradeColumns: {
			date: "Date",
			script: "Script",
			side: "Buy or sell",
			quantity: "Quantity",
			price: "Price",
			amount: "Amount",
		},
		side: { buy: "Buy", sell: "Sell" },
		tradesFailed: "Couldn’t load the trades.",
		noTrades: {
			title: "No trades yet",
			canEdit: (broker: string): string => `Upload a ${broker} tradebook to see every buy and sell.`,
			viewer: "The owner hasn’t uploaded a tradebook for this account yet.",
		},
	},

	// ─── How it’s worked out ─────────────────────────────────────────────
	worked: {
		lede: "The figures behind the return, so you can check them yourself.",
		windowTitle: "The period",
		window: (from: string, to: string, days: number): string =>
			`From ${from} to ${to} — ${count(days, "day", "days")}.`,
		pricesAsOf: (date: string): string => `Holdings are valued at prices as of ${date}.`,
		oldPrices: (days: number): string =>
			days === 1
				? "On 1 day in this period a holding had no price yet, so an earlier price stood in."
				: `On ${days.toLocaleString("en-IN")} days in this period a holding had no price yet, so an earlier price stood in.`,

		flowsTitle: "Every amount counted",
		flowsLede: "Each deposit and withdrawal on the day it happened, ending in what the account is worth today.",
		flowsCaption: "The amounts the return is worked out from",
		columns: { date: "Date", what: "What it is", putIn: "Put in", takenOut: "Taken out" },
		showAll: (n: number): string => `Show all ${n}`,
		showFewer: "Show fewer",
		valueToday: "Value today",

		xirrTitle: "The return (XIRR)",
		xirrIs: (rate: string): string =>
			`${rate} a year is the one yearly rate at which every amount above, from the day it went in, grows to the money taken out and today’s value.`,
		xirrNone:
			"There isn’t yet one yearly rate that can be worked out from these amounts.",
		xirrWhy:
			"Money that went in later has had less time to grow, and XIRR allows for that — so it is your actual outcome, timing included.",
		growthInstead: (rate: string): string =>
			`With under a year of history a yearly rate would mislead, so the page shows the growth so far instead: ${rate} in total.`,
		sameMoney:
			"For the comparison, the same amounts are put in on the same dates, and taken out on the same dates, somewhere else:",
		benchmark: (name: string, proxy: string): string => `${name} — ${proxy}.`,
		benchmarkResult: "Worth today",
		benchmarkNone: "No price for today yet, so there is nothing to compare.",
		benchmarkFrom: (date: string): string => `Its prices start on ${date}; it is compared from that day.`,

		movedTitle: "How the money moved",
		moved: {
			opening: "Value at the start of the period",
			putIn: "Money put in",
			takenOut: "Money taken out",
			priceGains: "What prices did, before fees",
			dividends: "Dividends",
			interest: "Interest",
			fees: "Brokerage, taxes and charges",
			closing: "Value today",
		},

		twrTitle: "Time-weighted return",
		twrIs:
			"How the holdings themselves did, with the timing and size of deposits and withdrawals taken out of it.",
		twrDiffers:
			"XIRR is what you actually earned; this is what the choices of what to hold earned. When the two differ, the gap comes from when money went in and out.",
		twrTotal: (rate: string): string => `Over the whole period that is ${rate} in total.`,
		aYear: "a year",

		riskTitle: "How bumpy it was",
		risk: {
			volatility: {
				label: "Volatility",
				unit: "a year",
				what: "How much the value swings from day to day, as a yearly figure. Higher means a bumpier ride.",
			},
			sharpe: {
				label: "Sharpe ratio",
				what: "Return above a safe savings rate, for each unit of swing. Above 1 is good; below 0 means safe savings did better.",
			},
			sortino: {
				label: "Sortino ratio",
				what: "The same idea as Sharpe, but counting only the swings downward — the ones that hurt.",
			},
			maxDrawdown: {
				label: "Biggest fall",
				what: (peak: string, trough: string): string =>
					`The largest drop from a high to the low that followed: from ${peak} to ${trough}.`,
				whatNone: "The largest drop from a high to the low that followed.",
			},
			notYet: "Not enough history yet to measure this.",
		},

		notesTitle: "Notes from the working",
	},
} as const;

/** What Kosh took a ledger line to be, in the statements tab's own words. */
export const CLASSIFICATION_LABEL: Record<CashFlowClassification, string> = {
	external_deposit: "Money put in from the bank",
	external_withdrawal: "Money taken out to the bank",
	internal_transfer: "Moved to or from another account",
	dividend_receipt: "Dividend",
	fee_external: "A fee paid from outside the account",
	trade_settlement: "Payment for a trade",
	charge: "Charges or fees",
	interest: "Interest",
	other_internal: "Something else inside the account",
};

/** What kind of thing a holding is, under its name. */
export const ASSET_CLASS_LABEL: Record<Holding["assetClass"], string> = {
	stocks: "Stock",
	funds: "Fund",
	gold: "Gold",
	bonds: "Bond",
	other: "Other",
};
