/** Words for "Profile and settings". */
export const PROFILE = {
	subtitle: "How you sign in, how Kosh reaches you, and how fresh its prices are.",

	// Prices and announcements — where every figure's "today" comes from
	feedsTitle: "Prices and announcements",
	feedsLead:
		"Share prices come from NSE’s daily price file, fund NAVs from AMFI, and splits, bonuses and dividends from NSE’s announcements. Kosh fetches them after the market closes and whenever a statement is uploaded.",
	pricesAsOf: "Prices up to",
	noPricesYet: "No prices yet — they arrive once a statement is in",
	lastFetched: "Last fetched",
	neverFetched: "Not fetched yet",
	fetching: "Prices are being fetched for something newly added. Figures fill in over the next few minutes.",
	/** The last fetch could not finish; the server's own note follows. */
	trouble: "The last fetch didn’t finish",
	troubleHint: "Kosh keeps the prices it has and tries again by itself. Figures use the last price it holds.",
	feedsFailed: "Couldn’t check how fresh the prices are.",
	retry: "Try again",
} as const;
