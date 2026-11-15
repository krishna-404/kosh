import type {
	LineAnswer,
	StatementKind,
	StatementPreview,
} from "@connected-repo/zod-schemas/kosh/statements.zod";

/**
 * Words for the account page's "Statements and questions" tab — uploads,
 * the check before anything is saved, undo, the questions Kosh asks and
 * how complete the history is. From the design's wording board; the
 * square-bracket blanks on the board are the function arguments here.
 *
 * Amounts, dates and quantities arrive already formatted (see
 * `statements.utils.ts`), so this file is words only.
 */

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
const lines = (n: number): string => `${n.toLocaleString("en-IN")} ${plural(n, "line", "lines")}`;

type ProblemCode = NonNullable<StatementPreview["problem"]>["code"];

/** The plain-words answers to "What was this ledger line?" — as chips. */
export const LINE_ANSWER_LABEL: Record<LineAnswer, string> = {
	external_deposit: "Money put in from the bank",
	external_withdrawal: "Money taken out to the bank",
	charge: "Charges or fees",
	interest: "Interest",
	trade_settlement: "Payment for a trade",
	other_internal: "Something else inside the account",
};

/** The same answers inside a sentence: "now counts as …". */
export const LINE_ANSWER_AS: Record<LineAnswer, string> = {
	external_deposit: "money put in from the bank",
	external_withdrawal: "money taken out to the bank",
	charge: "charges or fees",
	interest: "interest",
	trade_settlement: "payment for a trade",
	other_internal: "something else inside the account",
};

/** What choosing an answer changes — shown under the chips before saving. */
export const LINE_ANSWER_EFFECT: Record<LineAnswer, string> = {
	external_deposit: "Counted as money put into the account on this day, so the return is worked out again.",
	external_withdrawal: "Counted as money taken out of the account on this day, so the return is worked out again.",
	charge: "Counted as a cost of the account — not as money put in or taken out.",
	interest: "Counted as interest inside the account — not as money put in or taken out.",
	trade_settlement: "Counted as the money side of a trade — not as money put in or taken out.",
	other_internal: "Stays inside the account — not counted as money put in or taken out.",
};

/** What Kosh calls each kind of statement, mid-sentence. */
export const STATEMENT_KIND: Record<StatementKind, string> = {
	tradebook: "tradebook",
	ledger: "ledger",
	holdings: "holdings statement",
	dividends: "dividend statement",
};

export const QUESTIONS = {
	title: (n: number): string => (n === 1 ? "1 question needs an answer" : `${n} questions need an answer`),
	hint: "Returns use our best guess until you answer",
	/** For someone who can only look. */
	waitingTitle: (n: number): string => (n === 1 ? "1 question is waiting" : `${n} questions are waiting`),
	waitingHint: "Someone who can edit this account can answer. Returns use Kosh’s best guess until then.",
	none: { title: "Nothing waiting", body: "Every line in this account has been checked." },
	position: (index: number, total: number): string => `Question ${index} of ${total}`,
	needsYou: "Needs you",
	skipped: "Skipped for now",
	skip: "Skip for now",
	next: "Next question",
	save: "Save answer",
	saveAndNext: "Save and go to next",
	/** Shown in place of the buttons. */
	cannotAnswer: "Someone who can edit this account can answer this.",
	cannotAnswerBoth: "Answering this needs Can edit on both accounts.",
	loadFailed: "Couldn’t load the questions.",
	answerFailed: "Couldn’t save that. Nothing was changed.",
	undoFailed: "Couldn’t undo that.",
	undone: "Undone — it’s a question again",
	undo: "Undo",

	ledgerLine: {
		title: "What was this ledger line?",
		debit: "debit",
		credit: "credit",
		/** Until someone answers, an unrecognised line is no deposit and no withdrawal. */
		countedNow: "Not counted as money in or out yet",
		chips: "What this line was",
		chooseFirst: "Choose what this line was, then save.",
		done: (amount: string, date: string, answer: LineAnswer): string =>
			`Saved — ${amount} on ${date} now counts as ${LINE_ANSWER_AS[answer]}`,
	},

	opening: {
		title: "Where did the opening balance come from?",
		body: (amount: string, date: string): string =>
			`The ledger Kosh has starts on ${date} with ${amount} already in the account. Kosh doesn’t know when that money was put in.`,
		effect: (amount: string, date: string): string =>
			`Counting it as put in on ${date} measures returns from that day, with ${amount} as money put in. What happened before stays unknown, and Kosh keeps saying so.`,
		earlier:
			"If you can download the ledger from the account’s first day, upload that instead — then nothing has to be assumed.",
		/** A ledger that starts below zero: nothing to count, lines are simply missing. */
		short: (amount: string, date: string): string =>
			`The ledger Kosh has starts on ${date} with the account ${amount} short, so lines from before that day are missing. Upload the earlier ledger and this settles itself.`,
		count: "Count it as put in",
		uploadEarlier: "Upload the earlier ledger",
		done: (amount: string, date: string): string => `${amount} now counts as money put in on ${date}`,
	},

	isin: {
		title: "Which share is this?",
		body: (trade: string, date: string): string =>
			`The statement lists this trade without an ISIN: ${trade} on ${date}. Until Kosh knows which share it is, the trade isn’t counted in holdings.`,
		bought: (quantity: string, symbol: string, price: string): string =>
			`bought ${quantity} ${symbol} at ${price}`,
		sold: (quantity: string, symbol: string, price: string): string => `sold ${quantity} ${symbol} at ${price}`,
		label: "ISIN",
		placeholder: "INE009A01021",
		helper:
			"12 letters and digits — on the contract note or in the broker’s holdings. Kosh uses it to tell exactly which share this is, for its price and for splits and bonuses.",
		invalid: "That doesn’t look like an ISIN — 12 letters and digits, like INE009A01021.",
		save: "Save ISIN",
		done: (symbol: string): string => `ISIN saved — ${symbol} is now counted in holdings`,
	},

	transfer: {
		title: "Is this the same money?",
		left: (amount: string, account: string, date: string): string => `${amount} left ${account} on ${date}`,
		arrived: (amount: string, account: string, date: string): string =>
			`${amount} arrived in ${account} on ${date}`,
		out: "Left",
		in: "Arrived",
		effect:
			"If it is, it stops counting as money taken out and money put in whenever both accounts are looked at together. Each account on its own still shows it.",
		yes: "Yes, the same money",
		no: "No, keep them apart",
		paired: (amount: string): string => `Paired — ${amount} now counts as one move between the two accounts`,
		apart: "Kept apart — they count as money taken out and money put in",
	},

	action: {
		title: (actionType: string): string =>
			actionType === "bonus"
				? "Apply a bonus issue?"
				: actionType === "split"
					? "Apply a share split?"
					: "Apply this change to the shares?",
		/** "bonus" / "split" / "change" — for buttons and snackbars. */
		noun: (actionType: string): string =>
			actionType === "bonus" ? "bonus" : actionType === "split" ? "split" : "change",
		announced: (symbol: string, announcement: string, date: string): string =>
			`${symbol}: the exchange announced “${announcement}”, from ${date}.`,
		/** One that was undone may have been recorded by a person, not announced: say only what it says. */
		stated: (symbol: string, announcement: string, date: string): string =>
			`${symbol}: “${announcement}”, from ${date}.`,
		heldNow: (before: string, after: string): string =>
			`This account held ${before}, so it now holds ${after}.`,
		heldWould: (before: string, after: string): string =>
			`This account held ${before}, so it would hold ${after}.`,
		held: (before: string): string => `This account held ${before} on that day.`,
		why: {
			unclear: "Kosh couldn’t read the announcement with certainty, so it is asking instead of applying it.",
			undone: "This was applied to the account and then undone, so Kosh is asking again.",
		},
		ratioLabel: "One share became",
		ratioHelper: "2 for a 1:1 bonus · 5 for a split from ₹10 to ₹2 a share",
		ratioMissing: "Kosh couldn’t read the ratio from the announcement. How many shares did one share become?",
		ratioInvalid: "Give a number above zero, like 2 or 1.5.",
		apply: (actionType: string): string =>
			actionType === "bonus" ? "Apply bonus" : actionType === "split" ? "Apply split" : "Apply",
		decline: "Not for this account",
		applied: (actionType: string, symbol: string, before: string, after: string): string =>
			`${actionType === "bonus" ? "Bonus" : actionType === "split" ? "Split" : "Change"} applied — ${symbol} went from ${before} to ${after}`,
		appliedPlain: (symbol: string): string => `Applied to ${symbol}`,
		declined: (symbol: string): string => `${symbol} left as it is for this account`,
	},

	mismatch: {
		title: (symbol: string): string => `The holdings statement and Kosh disagree on ${symbol}`,
		statementSays: (date: string): string => `Statement for ${date}`,
		koshSays: "Kosh, from the trades",
		noTrades: "Kosh has no trades for it, so it counts none.",
		likely: (times: string): string =>
			`The statement shows exactly ${times} what Kosh works out. The usual reason is a split or bonus that Kosh doesn’t know of.`,
		unknown:
			"A trade may be missing from the tradebooks uploaded so far, or shares came in or went out another way — a transfer, an IPO, a gift. Uploading the missing tradebook settles it.",
		ratioLabel: "One share became",
		dateLabel: "From which day",
		dateHelper: "The ex-date: the first day the shares traded at the new count.",
		dateMissing: (latest: string): string => `Give the day it took effect — ${latest} or earlier.`,
		record: "Record a split or bonus",
		dismiss: "Stop asking about this",
		confirmTitle: (symbol: string): string => `Stop asking about ${symbol}?`,
		confirmBody: (symbol: string, expected: string, date: string): string =>
			`Kosh keeps its own figure of ${expected} and won’t ask about ${symbol} again for the ${date} statement. This one can’t be undone here — a newer holdings statement is checked afresh.`,
		confirm: "Stop asking",
		keep: "Keep the question",
		recorded: (symbol: string): string => `Split or bonus recorded for ${symbol}`,
		dismissed: (symbol: string): string => `Kosh won’t ask about ${symbol} for this statement again`,
	},
} as const;

export const UPLOAD = {
	/** The board's button, for the phone. */
	button: "Upload statement",
	drop: (broker: string | null): string => (broker ? `Drop a ${broker} statement here` : "Drop a statement here"),
	dropNow: "Drop it to see what Kosh reads",
	/** Only what the server reads: no PDF. */
	formats: "Tradebook, ledger or holdings · CSV or XLSX",
	formatsReadAs: (broker: string): string => `${broker}’s tradebook, ledger or holdings · CSV or XLSX`,
	choose: "Choose a file",
	chooseAnother: "Choose another file",
	oneAtATime: "One file at a time — Kosh took the first.",
	empty: {
		title: "No statements yet",
		body: (broker: string): string =>
			`Upload a ${broker} statement to see holdings and returns. Tradebook, ledger or holdings work.`,
		readOnly: "Someone who can edit this account can upload its statements.",
	},
	/** An account at a broker whose statements Kosh has no reader for. */
	notRead: {
		title: (broker: string): string => `Kosh can’t read ${broker}’s own files yet`,
		body: (readable: string): string =>
			`It reads ${readable}’s tradebook, ledger and holdings statements as they are downloaded. For this account, copy your statement into Kosh’s own layout and upload that.`,
	},
	/** Kosh's own layout: for an account at a broker it has no reader for. */
	ownLayout: {
		another: "A statement from another broker?",
		body: "Copy it into Kosh’s own layout — one table of trades, one of money in and out with the balance after each line — and upload it here like any statement. Each download is a small example to fill in.",
		trades: "Trades table",
		cash: "Cash table",
		tradesFile: "kosh-trades.csv",
		cashFile: "kosh-cash.csv",
		failed: "Couldn’t get the example. Check your connection and try again.",
	},

	/** A file that arrives without a name. */
	fallbackName: "statement",
	reading: (file: string): string => `Reading ${file}…`,
	readingBody: "Kosh is working out what kind of statement this is and which of its lines are new.",
	failedTitle: "This file couldn’t be checked",
	previewTitle: "Here’s what Kosh read",
	nothingSavedYet: "Nothing is saved until you add it.",
	/** "A Zerodha tradebook, 5 Oct 2025 to 1 Nov 2025." */
	headline: (broker: string, kind: StatementKind, span: string | null): string => {
		const article = /^[aeiou]/i.test(broker) ? "An" : "A";
		if (span === null) return `${article} ${broker} ${STATEMENT_KIND[kind]}.`;
		return kind === "holdings"
			? `${article} ${broker} ${STATEMENT_KIND[kind]} for ${span}.`
			: `${article} ${broker} ${STATEMENT_KIND[kind]}, ${span}.`;
	},
	/**
	 * The same, for a file in Kosh's own layout (the server calls that "broker"
	 * `template`): "A tradebook in Kosh’s own layout, 2 Apr 2024 to 17 Sept 2024."
	 */
	headlineOwnLayout: (kind: StatementKind, span: string | null): string => {
		const what = `${/^[aeiou]/i.test(STATEMENT_KIND[kind]) ? "An" : "A"} ${STATEMENT_KIND[kind]} in Kosh’s own layout`;
		if (span === null) return `${what}.`;
		return kind === "holdings" ? `${what}, for ${span}.` : `${what}, ${span}.`;
	},
	facts: {
		new: (n: number): string => `${lines(n)} ${plural(n, "is", "are")} new and will be added`,
		duplicate: (n: number): string =>
			`${lines(n)} ${plural(n, "is", "are")} already in — ${plural(n, "it is", "they are")} skipped, not added twice`,
		questions: (n: number): string =>
			`Kosh will ask you about ${n === 1 ? "1 of them" : `${n.toLocaleString("en-IN")} of them`} once ${plural(n, "it is", "they are")} in`,
		noQuestions: "Kosh recognises every new line, so it will have nothing to ask",
		holdingsCheck: "Kosh checks them against its own working, and asks only where the two differ",
		error: (n: number): string => `${lines(n)} couldn’t be read`,
	},
	rowsTitle: "The lines",
	rowStatus: { new: "New", duplicate: "Already in · skipped", question: "Kosh will ask" },
	showAllRows: (n: number): string => `Show all ${n.toLocaleString("en-IN")}`,
	showFewerRows: "Show fewer",
	moreRows: (n: number): string => `…and ${lines(n)} more.`,
	errorsTitle: "Where it goes wrong",
	/** Line 0 is the file as a whole (a ledger with no opening balance, say). */
	errorRow: (row: number, message: string): string => (row > 0 ? `Line ${row}: ${message}` : message),
	add: (n: number): string => `Add ${lines(n)}`,
	adding: "Adding…",
	cancel: "Cancel",
	close: "Close",

	problemTitle: {
		unreadable: "Kosh can’t open this file",
		unrecognised: "This isn’t a statement Kosh knows",
		unsupported: "Kosh can’t read this kind of statement yet",
		wrong_broker: "This statement is from another broker",
		already_uploaded: "Already uploaded",
		nothing_new: "Already uploaded",
		has_errors: "Some lines can’t be read",
		needs_date: "Which day is this statement for?",
	} satisfies Record<ProblemCode, string>,
	wrongBrokerTitle: (broker: string): string => `This looks like a ${broker} statement`,
	/** The wording board's duplicate line. */
	alreadyWithFile: (file: string, date: string): string =>
		`This file came in as ${file} on ${date}. Nothing was added.`,
	alreadyLines: (n: number): string =>
		`${n === 1 ? "This line is" : `These ${n.toLocaleString("en-IN")} lines are`} already in from earlier uploads. Nothing was added.`,
	/** What to try, for a file that cannot be read at all. */
	tryThis: (broker: string | null): string =>
		`What to try: download the tradebook, ledger or holdings statement from ${broker ?? "your broker"} as CSV or XLSX, and upload that file as it is — without opening and saving it in between.`,
	dateLabel: "The day this statement is for",
	dateHelper: "The day the holdings were downloaded for. It can’t be later than today.",
	dateWhy: "This holdings statement doesn’t say which day it is for.",
	dateNeeded: "Give the day and Kosh checks the file again; until then it can’t be added.",

	tooBig: "This file is over 12 MB — far bigger than any statement. Check it’s the right file.",
	emptyFile: "This file is empty.",
	readFailed: "Couldn’t read the file from this device. Choose it again.",
	previewFailed: "Couldn’t check this file. Nothing was saved.",
	applyFailed: "Couldn’t add this file. Nothing was saved.",
	added: (file: string, n: number, questions: number): string =>
		questions > 0
			? `${file} added — ${lines(n)}, ${questions} ${plural(questions, "question", "questions")} to answer`
			: `${file} added — ${lines(n)}`,
	undo: "Undo",
} as const;

export const UPLOADS = {
	title: "Uploads",
	you: "you",
	/** A file that came in without a name. */
	unnamed: "Statement",
	line: (when: string, who: string, n: number): string => `${when} · ${who} · ${lines(n)}`,
	undo: "Undo",
	undoLabel: (file: string): string => `Undo ${file}`,
	undone: "Undone",
	undoneLine: (when: string, who: string, n: number): string =>
		`${when} · ${who} · ${lines(n)}, taken out again`,
	showAll: (n: number): string => `Show all ${n}`,
	showFewer: "Show fewer",
	loadFailed: "Couldn’t load the uploads.",
	confirmTitle: (file: string): string => `Undo ${file}?`,
	confirmBody: (n: number): string =>
		`Its ${lines(n)} come out and returns are worked out again. Answers given about those lines come out with them. You can upload it again later.`,
	confirm: "Undo upload",
	keep: "Keep",
	undoneSnack: (file: string, n: number): string => `${file} undone — its ${lines(n)} came out`,
	undoFailed: "Couldn’t undo this upload. Nothing was changed.",
} as const;

export const HISTORY = {
	title: "How complete the history is",
	complete: "Complete",
	incomplete: "Incomplete",
	completeBody: "Everything needed for true returns is in, from the account’s first day.",
	incompleteBody: "Returns are Kosh’s best estimate until what’s marked below is in.",
	nothingYet: "Nothing is in yet. This is what true returns need.",
	loadFailed: "Couldn’t load how complete the history is.",
	stateOk: "In",
	stateMissing: "Missing",
	stateOptional: "Optional",

	ledger: (span: string, n: number): string => `Ledger: ${span} · ${lines(n)}`,
	noLedger: "No ledger yet",
	noLedgerFix:
		"Upload the ledger from the account’s first day, so every rupee put in or taken out is counted on its day.",
	noLedgerButTrades: "Until then, money put in is worked out from the trades.",

	startsFromZero: "It starts from zero, so nothing came before it",
	openingExplained: (amount: string, date: string): string =>
		`It starts with ${amount} already in, counted as money put in on ${date}`,
	openingExplainedNote: "What happened before that day isn’t known to Kosh.",
	openingUnexplained: (amount: string, date: string): string =>
		`It starts on ${date} with ${amount} already in, and nobody has said where from`,
	openingFix: "Upload the ledger from before that day, or answer the question above.",
	openingOverdrawn: (amount: string, date: string): string =>
		`It starts on ${date} already ${amount} short, so earlier lines are missing`,
	openingOverdrawnFix: "Upload the ledger from before that day.",

	noGaps: "No gaps: every line follows from the one before",
	gap: (after: string, before: string, amount: string): string =>
		`Lines are missing between ${after} and ${before} — the balance jumps by ${amount}`,
	gapFix: "Upload the ledger that covers those days.",

	trades: (span: string, n: number): string =>
		`Trades: ${span} · ${n.toLocaleString("en-IN")} ${plural(n, "trade", "trades")}`,
	noTrades: "No tradebook yet",
	noTradesFix: "Upload the tradebook to see what the account holds and what each share has done.",
	noTradesNeeded: "The ledger shows no trade being paid for, so none is missing.",
	missingMonths: (months: string): string =>
		`The ledger shows trades being paid for in ${months}, but no tradebook covers ${months.includes(",") || months.includes(" and ") ? "them" : "it"}`,
	missingMonthsFix: "Upload the tradebook for that time.",

	holdings: (date: string, n: number): string => `Holdings statement for ${date} · ${lines(n)}`,
	holdingsNote: "Kosh checks its own working against it, and asks when the two differ.",
	noHoldings: "No holdings statement",
	noHoldingsNote: "Not needed for returns. Upload one and Kosh checks its working against the broker’s.",
} as const;

export const SPLITS = {
	title: "Splits and bonuses applied",
	subtitle: "Each one changed how many shares this account holds from its day on.",
	became: (before: string, after: string): string => `${before} became ${after}`,
	line: (date: string, change: string): string => `${date} · ${change}`,
	declinedLine: (date: string): string => `${date} · not applied to this account`,
	byKosh: "Applied by Kosh from the exchange’s announcement",
	byPerson: (name: string | null): string => (name ? `Applied by ${name}` : "Applied by someone who can edit"),
	recordedBy: (name: string | null): string => (name ? `Recorded by ${name}` : "Recorded by someone who can edit"),
	declinedBy: (name: string | null): string =>
		name ? `${name} said it isn’t for this account` : "Marked as not for this account",
	undo: "Undo",
	undoLabel: (symbol: string): string => `Undo ${symbol}`,
	confirmTitle: (symbol: string, noun: string): string => `Undo the ${symbol} ${noun}?`,
	confirmBody: (before: string, date: string): string =>
		`This account goes back to ${before} from ${date}, and returns are worked out again. Kosh then asks about it again, above.`,
	confirmDeclinedTitle: (symbol: string, noun: string): string => `Ask about the ${symbol} ${noun} again?`,
	confirmDeclinedBody: "It was marked as not for this account. Kosh will ask about it again, above.",
	confirm: "Undo it",
	confirmDeclined: "Ask again",
	keep: "Keep",
	undone: (symbol: string, noun: string): string => `${symbol} ${noun} undone — it’s a question again`,
	undoFailed: "Couldn’t undo that. Nothing was changed.",
	loadFailed: "Couldn’t load the splits and bonuses.",
} as const;

export const TODAY = {
	title: "This account today",
	value: "Value",
	noStatements: "No statements yet, so there is nothing to value.",
	loadFailed: "Couldn’t load today’s figures.",
} as const;

export const STATEMENTS = {
	retry: "Try again",
} as const;
