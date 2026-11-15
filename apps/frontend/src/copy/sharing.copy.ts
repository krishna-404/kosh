import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";

/**
 * Words for the share dialog — from the design's wording board. Square-bracket
 * blanks on the board are the function arguments here. People are "they":
 * Kosh does not know anyone's gender and does not guess.
 */

/** "[Sunita] can view [this]" / "[Sunita] is an owner of [this]". */
const has = (name: string, level: AccessLevel, what: string, adverb = ""): string => {
	const a = adverb ? `${adverb} ` : "";
	return level === "owner"
		? `${name} is ${a}an owner of ${what}`
		: `${name} can ${a}${level} ${what}`;
};

const theyHave = (level: AccessLevel, what: string): string =>
	level === "owner" ? `they’re an owner of ${what}` : `they can ${level} ${what}`;

export const SHARING = {
	// ── Header ──
	titleAccount: (label: string): string => `Share ${label}`,
	titleHolder: (holderPossessive: string): string => `Share all of ${holderPossessive} accounts`,
	heldBy: (holderName: string): string => `held by ${holderName} · only this account`,
	shareAllInstead: (holderPossessive: string): string => `Share all of ${holderPossessive} instead`,
	/** "Anil · Zerodha, Anil · Groww — and any account you add for Anil later" */
	holderCovers: (labels: readonly string[], firstName: string): string => {
		if (labels.length === 0) return `Every account you add for ${firstName}`;
		const named =
			labels.length > 3
				? `${labels.slice(0, 3).join(", ")} and ${labels.length - 3} more`
				: labels.join(", ");
		return `${named} — and any account you add for ${firstName} later`;
	},
	backTo: (what: string): string => `Back to ${what}`,
	allOf: (holderPossessive: string): string => `all of ${holderPossessive} accounts`,

	// ── Invite form ──
	inviteLabel: "Invite by email",
	inviteLabelPhone: "Their email",
	invitePlaceholder: "name@example.com",
	inviteHelp: "Access starts when they sign in with exactly this email.",
	levelLabel: "They",
	levelLabelPhone: "What can they do?",
	next: "Next: check what they’ll see",
	inviteSomeone: "Invite someone",
	inviteTitle: (label: string): string => `Invite to ${label}`,

	// ── Email checks ──
	notEmail: "That doesn’t look like an email address.",
	typo: (domain: string): string => `“${domain}” looks like a typo. Did you mean `,
	acceptDomain: (domain: string): string => `Use ${domain}`,
	keepDomain: (domain: string): string => `Keep ${domain}`,
	typoMatters: "Typos matter here: whoever signs in with the address you type gets the access.",
	thatsYou: "That’s you — you’re already an owner.",
	/** "[Sunita] can already view this — they can view all of [Anil]'s accounts." */
	covered: (name: string, want: AccessLevel, got: AccessLevel, holderPossessive: string): string =>
		`${has(name, want, "this", "already")} — ${theyHave(got, `all of ${holderPossessive} accounts`)}.`,
	changeOn: (firstName: string): string => `Change on ${firstName}`,
	/** Same person, same level, same place: nothing to send. */
	alreadyHas: (name: string, level: AccessLevel, what: string): string =>
		`${has(name, level, what, "already")}.`,

	// ── People with access ──
	people: "People with access",
	whoCanSeeWhat: "Who can see what",
	groupHolder: (holderPossessive: string): string => `All of ${holderPossessive} accounts`,
	groupHolderOnHolder: (holderPossessive: string): string =>
		`All of ${holderPossessive} accounts, including new ones`,
	groupDirect: "Only this account",
	groupSome: (holderPossessive: string): string => `Only some of ${holderPossessive} accounts`,
	nobodyYet: "Nobody yet. People you invite here see this account and nothing else.",
	nobodyOnHolder: "Nobody else yet. People you invite here see every account, including new ones.",
	you: "(you)",
	youAlone: "You",
	added: (firstName: string, date: string): string => `Added ${firstName} · ${date}`,
	since: (email: string, date: string): string => `${email} · since ${date}`,
	sinceOnly: (date: string): string => `Since ${date}`,
	inviteLine: (sent: string, until: string | null): string =>
		until
			? `Sent ${sent} · not signed in yet · works until ${until}`
			: `Sent ${sent} · not signed in yet`,
	inviteRanOut: (date: string): string => `Invite ran out on ${date}`,
	inviteOnAccount: (label: string, sent: string): string =>
		`${label} · sent ${sent}, not signed in yet`,
	invited: "Invited",
	expired: "Expired",
	waitingToConfirm: "Waiting for you to confirm",
	waitingToConfirmHint: "Until you confirm, they can only view.",
	confirmOwner: (firstName: string): string => `Confirm ${firstName} as owner`,
	cantLower: "Can’t be lowered here",
	raiseHere: (name: string, level: string): string => `${name}: ${level}. Raise for this account`,
	levelOf: (name: string, level: string): string => `${name}: ${level}. Change or remove`,
	moreForInvite: (email: string): string => `More for the invite to ${email}`,
	moreForYou: "More for you",
	openSharing: (label: string): string => `Open ${label} sharing`,
	current: "Current",
	holderLevelHint: (firstName: string): string => `From ${firstName} — can’t be lowered here`,
	activityNote: "Every change is saved in ",
	activityLink: "Activity",
	activityNoteTail: ", with who made it and when.",

	// ── Menus ──
	remove: (firstName: string): string => `Remove ${firstName}`,
	removeHint: (what: string): string => `They’ll stop seeing ${what} straight away`,
	giveMore: "Give more on one account…",
	giveMoreHint: (level: string, label: string): string => `For example, ${level} on ${label} only`,
	sendAgain: "Send the invite again",
	changeLevel: "Change level",
	cancelInvite: "Cancel invite",
	leave: "Leave",
	leaveHint: (what: string): string => `You’ll stop seeing ${what}`,
	leaveBlockedHint: "You’re the only owner",
	done: "Done",

	// ── Confirmations ──
	removeTitle: (firstName: string, what: string): string => `Remove ${firstName} from ${what}?`,
	removeBody: (plural: boolean): string =>
		`They’ll stop seeing ${plural ? "them" : "it"} straight away. What they uploaded stays.`,
	keep: "Keep",
	leaveTitle: (what: string): string => `Leave ${what}?`,
	leaveBody: (plural: boolean): string =>
		`You’ll stop seeing ${plural ? "them" : "it"} straight away. What you uploaded stays.`,
	stay: "Stay",
	makeOwnerTitle: (firstName: string, what: string): string =>
		`Make ${firstName} an owner of ${what}?`,
	makeOwnerConfirm: (firstName: string): string => `Make ${firstName} an owner`,
	notNow: "Not now",
	needsOwnerTitle: (label: string): string => `${label} needs an owner`,
	needsOwnerTitleHolder: (holderPossessive: string): string =>
		`${holderPossessive} accounts need an owner`,
	needsOwnerBody: (plural: boolean): string =>
		`You’re ${plural ? "their" : "its"} only owner. Make someone else an owner first, so someone can still decide who sees ${plural ? "them" : "it"}. Then you can step back.`,
	chooseNewOwner: "Choose a new owner",
	keepMeAsOwner: "Keep me as owner",

	// ── Check before you send ──
	checkEyebrow: "Check before you send",
	checkTitlePhone: "Check before sending",
	whatTheyGet: (email: string): string => `What ${email} will get`,
	thisPerson: "this person",
	onlyAccount: "The only account they’ll see",
	andLater: (firstName: string): string => `And any account added for ${firstName} later`,
	willSee: "They’ll see",
	willBeAble: "They’ll be able to",
	wontSee: "They won’t see",
	whoElse: "Who else has access",
	anyOther: "Any other account",
	orAnyOther: "or any other account",
	holderAccounts: (holderPossessive: string): string => `${holderPossessive} accounts`,
	/** "[Ramesh] can view this now. This changes it to [Can edit]." */
	levelChangeNote: (name: string, from: AccessLevel, to: string): string =>
		`${has(name, from, "this")} now. Sending changes that to ${to}.`,
	/** "[Sunita] can view all of [Anil]'s accounts. Sending raises this one to [Can edit]." */
	raiseNote: (name: string, got: AccessLevel, holderPossessive: string, to: string): string =>
		`${has(name, got, `all of ${holderPossessive} accounts`)}. Sending raises this one to ${to}.`,
	raisedHere: "Raised on this account only",
	startsWhen:
		"Access starts when they sign in with exactly this email. The invite shows your name, not any amounts.",
	back: "Back",
	changeSomething: "Change something",
	send: (level: string): string => `Send invite · ${level}`,
	sendFailed: "Couldn’t send the invite. Check your connection and try again.",

	// ── What just happened ──
	inviteSent: (email: string): string => `Invite sent to ${email}`,
	inviteSentAgain: (email: string): string => `Invite sent again to ${email}`,
	inviteCancelled: (email: string): string => `Invite to ${email} cancelled`,
	canNow: (name: string, level: AccessLevel, what: string): string => has(name, level, what, "now"),
	inviteChanged: (email: string, level: string): string => `Invite to ${email} is now ${level}`,
	undo: "Undo",
	undone: "Undone",
	removed: (firstName: string, what: string): string => `Removed ${firstName} from ${what}`,
	left: (what: string): string => `You left ${what}`,
	confirmed: (name: string, what: string): string => `${name} is now an owner of ${what}`,
	changeFailed: "Couldn’t save that change. Try again.",

	// ── Loading and failure ──
	loadFailed: "Couldn’t load who has access.",
	retry: "Try again",
	closeLabel: "Close",
} as const;
