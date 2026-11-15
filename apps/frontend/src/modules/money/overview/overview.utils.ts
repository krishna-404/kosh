import { formatDate } from "@connected-repo/ui-mui/format/date";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import type { GroupsCompared, Holding, Returns, Scope } from "@connected-repo/zod-schemas/kosh/money.zod";
import type { Directory, DirectoryAccount, Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { MONEY } from "@frontend/copy/money.copy";
import { OVERVIEW } from "@frontend/copy/overview.copy";

/**
 * The Overview's reading of the figures: which rows the waterfall shows,
 * how "ahead" and "behind" are worded, which scripts and groups make the
 * short lists. Everything here is pure — no figure is made up, only chosen,
 * ordered and worded.
 */

const num = (amount: string | null): number => {
	const n = Number(amount);
	return Number.isFinite(n) ? n : 0;
};

/** Amounts are shown to the rupee, so anything under 50 paise shows as nothing. */
export const roundsToZero = (amount: number): boolean => Math.abs(amount) < 0.5;

/**
 * Figures from the selection or period being left stay on screen until the
 * new ones arrive — dimmed, so they are not read as the new ones.
 */
export const staleSx = (stale: boolean) => ({ opacity: stale ? 0.55 : 1, transition: "opacity 200ms" }) as const;

// ─── Greeting ───────────────────────────────────────────────────────────

export type DayPart = keyof typeof OVERVIEW.greeting;

/** Morning from 5, afternoon from noon, evening from 5pm (and through the night). */
export const dayPart = (hour: number): DayPart => {
	if (hour >= 5 && hour < 12) return "morning";
	if (hour >= 12 && hour < 17) return "afternoon";
	return "evening";
};

// ─── Which accounts a selection covers ──────────────────────────────────

/** The accounts a scope covers, from the directory; null while that cannot be known. */
export const accountsInScope = (
	scope: Scope,
	directory: Directory | undefined,
	groups: readonly Group[] | undefined,
): DirectoryAccount[] | null => {
	if (!directory) return null;
	if (scope.kind === "everything") return directory.accounts;
	if (scope.kind === "account") return directory.accounts.filter((a) => a.id === scope.id);
	if (scope.kind === "holder") return directory.accounts.filter((a) => a.personId === scope.id);
	const group = groups?.find((g) => g.id === scope.id);
	if (!group) return null;
	const ids = new Set(group.accountIds);
	return directory.accounts.filter((a) => ids.has(a.id));
};

/** How many people those accounts belong to. */
export const peopleIn = (accounts: readonly DirectoryAccount[] | null): number | null =>
	accounts ? new Set(accounts.map((a) => a.personId)).size : null;

/** The first account the person may upload a statement to (view-only accounts cannot take one). */
export const firstToUpload = (accounts: readonly DirectoryAccount[] | null): DirectoryAccount | null =>
	accounts?.find((a) => a.myLevel !== "view") ?? null;

// ─── How the money moved ────────────────────────────────────────────────

export type MovedKey =
	| "opening"
	| "putIn"
	| "takenOut"
	| "priceGains"
	| "dividends"
	| "interest"
	| "fees"
	| "closing";

export interface MovedRow {
	key: MovedKey;
	/** What it did to the value, in rupees: negative for money taken out, fees and losses. */
	amount: number;
	/** A level standing on the ground (opening value, value today) rather than a step up or down. */
	level: boolean;
	/** Where its bar begins and how long it is, as shares (0 to 1) of the chart's height. */
	start: number;
	size: number;
}

export interface MovedChart {
	rows: MovedRow[];
	/** Where zero sits, as a share of the chart's height — above the floor only if the running total dips below zero. */
	zero: number;
}

/**
 * The waterfall: the value at the start (when the period does not begin at
 * the beginning), each thing that moved it, and the value today. A step that
 * comes to nothing is left out — except "Put in", which is always said.
 */
export const movedChart = (moved: Returns["moved"]): MovedChart => {
	const opening = num(moved.opening);
	const hasOpening = !roundsToZero(opening);
	const steps: { key: MovedKey; amount: number; always?: boolean }[] = [
		{ key: "putIn", amount: num(moved.putIn), always: true },
		{ key: "takenOut", amount: -num(moved.takenOut) },
		{ key: "priceGains", amount: num(moved.priceGains) },
		{ key: "dividends", amount: num(moved.dividends) },
		{ key: "interest", amount: num(moved.interest) },
		{ key: "fees", amount: -num(moved.fees) },
	];

	const spans: { key: MovedKey; amount: number; level: boolean; from: number; to: number }[] = [];
	let running = 0;
	if (hasOpening) {
		spans.push({ key: "opening", amount: opening, level: true, from: 0, to: opening });
		running = opening;
	}
	for (const step of steps) {
		const from = running;
		running += step.amount;
		if (step.always || !roundsToZero(step.amount)) {
			// With nothing before it, the money put in is itself the first level.
			const level = step.key === "putIn" && !hasOpening;
			spans.push({ key: step.key, amount: step.amount, level, from, to: running });
		}
	}
	const closing = num(moved.closing);
	spans.push({ key: "closing", amount: closing, level: true, from: 0, to: closing });

	const marks = spans.flatMap((s) => [s.from, s.to]);
	const lo = Math.min(0, ...marks);
	const hi = Math.max(0, ...marks);
	const span = hi - lo || 1;
	return {
		rows: spans.map(({ key, amount, level, from, to }) => ({
			key,
			amount,
			level,
			start: (Math.min(from, to) - lo) / span,
			size: Math.abs(to - from) / span,
		})),
		zero: (0 - lo) / span,
	};
};

// ─── Ahead of, or behind, the same money elsewhere ──────────────────────

type Benchmark = Returns["benchmarks"][number];

/** Where the money stands against one benchmark — or why that cannot be said. */
export type Standing =
	| { slug: string; name: string; state: "ahead" | "behind" | "level"; amount: number }
	| { slug: string; name: string; state: "none"; why: "startsLater"; from: string }
	| { slug: string; name: string; state: "none"; why: "loading" | "unknown" };

/** "NIFTY", "gold" — how a benchmark is called mid-sentence. */
export const shortName = (benchmark: Pick<Benchmark, "slug" | "name">): string =>
	OVERVIEW.benchmarkShort[benchmark.slug] ?? benchmark.name;

/** Whether the same-money figure for a benchmark can be shown at all. */
export const hasFigure = (benchmark: Benchmark): boolean =>
	benchmark.availableFrom === null && benchmark.value !== null && benchmark.ahead !== null;

export const standingOf = (benchmark: Benchmark, pricesLoading: boolean): Standing => {
	const base = { slug: benchmark.slug, name: shortName(benchmark) };
	// Prices that start after the period does cannot carry "the same money" through it.
	if (benchmark.availableFrom !== null)
		return { ...base, state: "none", why: "startsLater", from: benchmark.availableFrom };
	if (benchmark.value === null || benchmark.ahead === null)
		return { ...base, state: "none", why: pricesLoading ? "loading" : "unknown" };
	const ahead = num(benchmark.ahead);
	if (roundsToZero(ahead)) return { ...base, state: "level", amount: 0 };
	return { ...base, state: ahead > 0 ? "ahead" : "behind", amount: Math.abs(ahead) };
};

/** A run of words; `strong` runs are the figures, set in bold. */
export interface Segment {
	text: string;
	strong?: true;
}

/**
 * "₹7,62,000 ahead of NIFTY and ₹5,12,000 behind gold, on exactly the same
 * deposits and withdrawals." Each benchmark is said truthfully — ahead,
 * behind or level — and one with no figure gets its reason instead.
 */
export const aheadSentence = (standings: readonly Standing[]): Segment[] => {
	const compared = standings.filter((s) => s.state !== "none");
	const out: Segment[] = [];
	compared.forEach((s, index) => {
		if (index > 0) out.push({ text: index === compared.length - 1 ? OVERVIEW.and : OVERVIEW.comma });
		if (s.state === "level") {
			out.push({ text: index === 0 ? OVERVIEW.levelWith(s.name) : OVERVIEW.levelWithLower(s.name) });
		} else if (s.state === "ahead") {
			out.push({ text: `${formatMoney(s.amount)} ${MONEY.ahead}`, strong: true });
			out.push({ text: OVERVIEW.aheadOf(s.name) });
		} else if (s.state === "behind") {
			out.push({ text: `${formatMoney(s.amount)} ${MONEY.behind}`, strong: true });
			out.push({ text: OVERVIEW.behindOf(s.name) });
		}
	});
	if (compared.length > 0) out.push({ text: OVERVIEW.sameDeposits });

	for (const s of standings) {
		if (s.state !== "none") continue;
		const why =
			s.why === "startsLater"
				? OVERVIEW.noFigureStartsLater(s.name, formatDate(s.from))
				: s.why === "loading"
					? OVERVIEW.noFigureLoading(s.name)
					: OVERVIEW.noFigure(s.name);
		out.push({ text: out.length > 0 ? ` ${why}` : why });
	}
	return out;
};

export const sentenceText = (segments: readonly Segment[]): string => segments.map((s) => s.text).join("");

/**
 * The banner's colour follows the first benchmark that has a figure (NIFTY,
 * unless it has none): behind it is bad news, ahead or level is good; with
 * no figure at all there is only something to explain.
 */
export const standingTone = (standings: readonly Standing[]): "good" | "bad" | "warn" => {
	const first = standings.find((s) => s.state !== "none");
	if (!first) return "warn";
	return first.state === "behind" ? "bad" : "good";
};

/** Ahead of one and behind another: neither plainly good news nor bad. */
export const isMixed = (standings: readonly Standing[]): boolean =>
	standings.some((s) => s.state === "ahead") && standings.some((s) => s.state === "behind");

/** The benchmark the hero's third figure is about: NIFTY 50 when it is there. */
export const primaryBenchmark = (benchmarks: readonly Benchmark[]): Benchmark | null =>
	benchmarks.find((b) => b.slug === "nifty50") ?? benchmarks[0] ?? null;

// ─── Scripts ahead of and behind NIFTY ──────────────────────────────────

/** Percentage points a year ahead of (or behind) NIFTY on the same buys and sells. */
export const pointsOf = (holding: Pick<Holding, "xirr" | "benchmarkXirr">): number | null =>
	holding.xirr === null || holding.benchmarkXirr === null ? null : holding.xirr - holding.benchmarkXirr;

export interface Movers {
	/** The scripts furthest ahead, by rupees, furthest first. */
	ahead: Holding[];
	/** The scripts furthest behind, by rupees, furthest first. */
	behind: Holding[];
	aheadCount: number;
	behindCount: number;
	/** Scripts with no comparison — in neither list. */
	uncompared: number;
	total: number;
}

/** The top few scripts each way by rupee effect. A script with no comparison is in neither list. */
export const topMovers = (holdings: readonly Holding[], count = 3): Movers => {
	const compared = holdings
		.filter((h) => h.effect !== null)
		.map((holding) => ({ holding, effect: num(holding.effect) }));
	const byName = (a: { holding: Holding }, b: { holding: Holding }) => a.holding.name.localeCompare(b.holding.name);
	const ahead = compared.filter((c) => c.effect > 0).sort((a, b) => b.effect - a.effect || byName(a, b));
	const behind = compared.filter((c) => c.effect < 0).sort((a, b) => a.effect - b.effect || byName(a, b));
	return {
		ahead: ahead.slice(0, count).map((c) => c.holding),
		behind: behind.slice(0, count).map((c) => c.holding),
		aheadCount: ahead.length,
		behindCount: behind.length,
		uncompared: holdings.length - compared.length,
		total: holdings.length,
	};
};

/** "Anil · Zerodha, HUF · Zerodha" while the names fit; "3 accounts" beyond that. */
export const heldInLine = (labels: readonly string[], named = 2): string =>
	labels.length <= named ? labels.join(", ") : OVERVIEW.scripts.accounts(labels.length);

/** The longest bar on a diverging scale: the largest size among the values there are. */
export const largest = (values: readonly (number | null)[]): number =>
	values.reduce<number>((max, value) => (value === null ? max : Math.max(max, Math.abs(value))), 0);

// ─── Groups ─────────────────────────────────────────────────────────────

export type GroupRow = GroupsCompared["groups"][number];

/** A group with under a year of history is shown, but not ranked. */
export const isRanked = (group: GroupRow): boolean => !group.shortHistory && group.aheadPoints !== null;

/** The few groups furthest ahead of NIFTY on their own money; unranked ones follow, in the order given. */
export const topGroups = (groups: readonly GroupRow[], count = 3): GroupRow[] => {
	const ranked = groups.filter(isRanked).sort((a, b) => (b.aheadPoints ?? 0) - (a.aheadPoints ?? 0));
	const rest = groups.filter((g) => !isRanked(g));
	return [...ranked, ...rest].slice(0, count);
};
