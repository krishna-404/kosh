/**
 * Words for the Overview — the greeting, the hero, "how the money moved",
 * the scripts ahead of and behind NIFTY, the groups card and the states
 * before there is anything to show. From the design's Overview and wording
 * boards; words every money page shares are in `money.copy.ts`.
 */

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const OVERVIEW = {
	// ─── Header ───────────────────────────────────────────────────────────
	greeting: {
		morning: "Good morning",
		afternoon: "Good afternoon",
		evening: "Good evening",
	},
	greet: (greeting: string, firstName: string): string => (firstName ? `${greeting}, ${firstName}` : greeting),
	/** The sentence under the greeting, by what is being looked at. */
	sub: {
		everything: "Here’s how all the money you can see is doing.",
		group: (name: string): string => `Here’s how the money in ${name} is doing.`,
		holder: (possessiveName: string): string => `Here’s how ${possessiveName} money is doing.`,
		account: (label: string): string => `Here’s how the money in ${label} is doing.`,
	},

	// ─── Chips ────────────────────────────────────────────────────────────
	/** After a chip's count, for screen readers only: "Everything · 6" reads "… 6 accounts". */
	chipUnit: (count: number): string => plural(count, " account", " accounts"),
	newGroup: "New group",

	// ─── Hero ─────────────────────────────────────────────────────────────
	valueToday: "Value today",
	people: (count: number): string => plural(count, "1 person", `${count} people`),
	sinceMonth: (month: string): string => `${month} – today`,
	yourReturn: "Your return (XIRR)",
	growthSoFar: "Growth so far",
	growthLower: "growth so far",
	notYearly: "not a yearly rate",
	today: "today",
	/** Under a figure the API could not give. */
	notWorkedOut: "can’t be worked out yet",
	/** The phone's one line: "NIFTY on same money 12.8%". */
	onSameMoney: (name: string): string => `${name} on same money`,

	// The ahead banner. Amounts are set in bold by the screen.
	aheadOf: (name: string): string => ` of ${name}`,
	behindOf: (name: string): string => ` ${name}`,
	levelWith: (name: string): string => `Level with ${name}`,
	levelWithLower: (name: string): string => `level with ${name}`,
	and: " and ",
	comma: ", ",
	sameDeposits: ", on exactly the same deposits and withdrawals.",
	/** Why a benchmark has no figure here. */
	noFigureStartsLater: (name: string, date: string): string =>
		`No figure for ${name}: its prices only start on ${date}, after this period begins.`,
	noFigureLoading: (name: string): string => `No figure for ${name} yet: its prices are still coming in.`,
	noFigure: (name: string): string =>
		`No figure for ${name}: it can’t be worked out from the prices Kosh has.`,
	pricesStart: (date: string): string => `its prices start ${date}`,
	/** How a benchmark is called mid-sentence; anything else keeps the name the server gives. */
	benchmarkShort: { nifty50: "NIFTY", gold: "gold" } as Record<string, string>,

	// ─── How the money moved ──────────────────────────────────────────────
	moved: {
		title: "How the money moved",
		seeCashFlows: "See every cash flow",
		opening: "Opening value",
		putIn: "Put in",
		takenOut: "Taken out",
		priceGains: "Price gains",
		priceLosses: "Price losses",
		dividends: "Dividends",
		interest: "Interest",
		fees: "Fees and charges",
		closing: "Value today",
	},

	/** What is said after a row's name, where there is something to add. */
	movedDetail: {
		deposits: (count: number): string => (count === 1 ? "1 deposit" : `${count} deposits`),
		withdrawals: (count: number): string => (count === 1 ? "1 withdrawal" : `${count} withdrawals`),
		/** Dividends go straight to the holder's bank, so they are part of what was taken out. */
		andDividends: "and dividends",
		dividendsOnly: "dividends",
		toYourBank: "paid to the bank",
	},

	// ─── Scripts ahead of and behind NIFTY ────────────────────────────────
	scripts: {
		aheadTitle: "Ahead of NIFTY",
		behindTitle: "Behind NIFTY",
		needsALook: "Needs a look",
		sameMoney: "same money, same dates",
		all: (count: number): string => plural(count, "The 1 script", `All ${count} scripts`),
		accounts: (count: number): string => plural(count, "1 account", `${count} accounts`),
		nothingBehind: "Nothing is behind NIFTY right now",
		nothingBehindAll: "Every script here has done better than the same money in NIFTY.",
		nothingAhead: "Nothing is ahead of NIFTY right now",
		nothingAheadAll: "Every script here has done worse than the same money in NIFTY.",
		notCompared: (count: number): string =>
			plural(
				count,
				"1 script can’t be compared with NIFTY yet.",
				`${count} scripts can’t be compared with NIFTY yet.`,
			),
		noneCompared: "No script here can be compared with NIFTY yet.",
		loadFailed: "Couldn’t load the scripts.",
	},

	// ─── Your groups, compared ────────────────────────────────────────────
	groups: {
		title: "Your groups, compared",
		compareAll: "Compare all groups",
		colGroup: "Group",
		colMoney: "Money",
		colReturn: "Return",
		colVs: "vs NIFTY, same money",
		colKind: "Kind",
		notEnoughHistory: "Not enough history yet",
		loadFailed: "Couldn’t load your groups.",
	},

	// ─── Nothing yet ──────────────────────────────────────────────────────
	noStatements: {
		title: "No statements yet",
		/** One account in view. */
		one: (broker: string): string =>
			`Upload a ${broker} statement to see holdings and returns. Tradebook, ledger or holdings work.`,
		/** Several accounts in view, none with a statement. */
		many: (first: string): string =>
			`None of these accounts has a statement yet. Upload a tradebook, ledger or holdings file to see holdings and returns — start with ${first}.`,
		/** A group saved with no accounts in it (or whose accounts are no longer shared). */
		noAccountsTitle: "No accounts here yet",
		noAccounts: "This group has no accounts in it, so there is nothing to add up. Add accounts to it on Groups to see its figures.",
		goToGroups: "Go to Groups",
		/** Nothing here the person may upload to. */
		viewOnly: "Nothing has been uploaded here yet. Figures appear once someone who can edit uploads a statement.",
		upload: "Upload statement",
		uploadTo: (label: string): string => `Upload to ${label}`,
		goToAccounts: "Go to Accounts and people",
	},

	dismiss: "Dismiss",
} as const;
