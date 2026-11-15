/**
 * Navigation words, from the design's wording board. One place, so the
 * sidebar, the phone tabs, page titles and links never drift apart.
 */
export const NAV = {
	sectionMoney: "Your money",
	sectionPeople: "People and access",
	overview: "Overview",
	holdings: "Holdings",
	groups: "Groups",
	accounts: "Accounts and people",
	accountsShort: "Accounts",
	shared: "Shared with me",
	access: "Who can see what",
	activity: "Activity",
	profile: "Profile and settings",
	signOut: "Sign out",
} as const;

export const ROUTES = {
	overview: "/overview",
	holdings: "/holdings",
	groups: "/groups",
	accounts: "/accounts",
	shared: "/shared",
	access: "/access",
	activity: "/activity",
	profile: "/profile",
} as const;

/** One account's own page. */
export const accountPath = (accountId: string): string => `${ROUTES.accounts}/${accountId}`;
/** Where an invite link lands. */
export const invitePath = (token: string): string => `/invite/${token}`;

/** Where a signed-in person lands. */
export const HOME = ROUTES.overview;
