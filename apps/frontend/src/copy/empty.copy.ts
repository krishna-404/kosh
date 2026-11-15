/**
 * What each screen says before it has anything to show. Written as the
 * lasting empty state for someone who has added nothing yet — not as a
 * note about what is still being built.
 */
export const EMPTY = {
	overview: {
		title: "Your money, in one place",
		body: "Add the people whose investments you want to see together, then their broker accounts. Once statements are in, this page shows what it is all worth and how it has done against the same money in NIFTY 50 and gold.",
		action: "Go to Accounts and people",
	},
	holdings: {
		title: "Nothing held yet",
		body: "Shares and funds appear here once an account has statements — each with its value, its return, and how it compares with the same money in NIFTY 50.",
		action: "Go to Accounts and people",
	},
	groups: {
		title: "No groups yet",
		body: "A group is a set of accounts to add up and compare — the family, a fund manager's accounts, your own trading. Only you see your groups; making one shares nothing.",
	},
	accounts: {
		title: "Start with one person",
		body: "Add the first person whose investments you want to see here — probably you. Then add their broker accounts.",
	},
	shared: {
		title: "Nothing is shared with you yet",
		body: "When someone shares an account with you, it appears here with what you can do with it. They need to use the email address you sign in with.",
	},
	access: {
		title: "Nobody else can see your accounts",
		body: "When you share an account, this page shows every person and exactly what they can see — account by account.",
	},
	activity: {
		title: "Nothing has happened yet",
		body: "Uploads, undos, answers and access changes on accounts you can see are listed here — who did it and when. Nothing here can be edited or deleted.",
	},
} as const;
