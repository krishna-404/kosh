import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import { ASSET_CLASSES, type Holding, type Holdings, type Script } from "@connected-repo/zod-schemas/kosh/money.zod";
import { HOLDINGS } from "@frontend/copy/holdings.copy";
import { MONEY } from "@frontend/copy/money.copy";

/**
 * The small decisions behind Holdings and the page of one script: what counts
 * as ahead, the order rows come in, how many show at first, what "held in"
 * says. Nothing here works out a figure the API did not give — it only
 * counts, orders and words what came back.
 */

export type AssetClass = Holding["assetClass"];

// ─── Ahead or behind ────────────────────────────────────────────────────

export type Standing = "ahead" | "behind";
export type StandingFilter = "all" | Standing;

/**
 * Ahead of or behind NIFTY in rupees, on its own buys and sells. Null when
 * there is no comparison (`effect` is null) — such a script is in neither.
 * Exactly level counts as ahead, as the server counts it.
 */
export const standingOf = (holding: Pick<Holding, "effect">): Standing | null => {
	if (holding.effect === null) return null;
	return Number(holding.effect) >= 0 ? "ahead" : "behind";
};

/** How many of the rows on screen are ahead, behind, or could not be compared. */
export const countStandings = (holdings: readonly Pick<Holding, "effect">[]) => {
	const counts = { all: holdings.length, ahead: 0, behind: 0, notCompared: 0 };
	for (const holding of holdings) {
		const standing = standingOf(holding);
		if (standing === null) counts.notCompared += 1;
		else counts[standing] += 1;
	}
	return counts;
};

export const standingFromParam = (raw: string | null): StandingFilter =>
	raw === "ahead" || raw === "behind" ? raw : "all";

// ─── The list's view, in the address ────────────────────────────────────

/** What the list is showing: the ahead/behind filter, and whether sold scripts are listed too. */
export interface ListView {
	filter: StandingFilter;
	includeSold: boolean;
}

const SHOW_PARAM = "show";
const SOLD_PARAM = "sold";

/** `?show=behind&sold=1` → the view. Anything else reads as the plain list. */
export const viewFromParams = (params: URLSearchParams): ListView => ({
	filter: standingFromParam(params.get(SHOW_PARAM)),
	includeSold: params.get(SOLD_PARAM) === "1",
});

/** The same address query with the view written into it; the plain list leaves nothing behind. */
export const withView = (params: URLSearchParams, view: ListView): URLSearchParams => {
	const next = new URLSearchParams(params);
	if (view.filter === "all") next.delete(SHOW_PARAM);
	else next.set(SHOW_PARAM, view.filter);
	if (view.includeSold) next.set(SOLD_PARAM, "1");
	else next.delete(SOLD_PARAM);
	return next;
};

/** The rows a filter keeps. `kind` narrows to one kind of asset as well. */
export const filterHoldings = <H extends Pick<Holding, "effect" | "assetClass">>(
	holdings: readonly H[],
	filter: StandingFilter,
	kind: AssetClass | "all" = "all",
): H[] =>
	holdings.filter(
		(holding) =>
			(filter === "all" || standingOf(holding) === filter) && (kind === "all" || holding.assetClass === kind),
	);

/**
 * The gap between a script's yearly return and NIFTY's on the same buys and
 * sells, as a fraction (0.086 is 8.6 percentage points). Null when either
 * rate is missing.
 */
export const pointsOf = (holding: Pick<Holding, "xirr" | "benchmarkXirr">): number | null =>
	holding.xirr === null || holding.benchmarkXirr === null ? null : holding.xirr - holding.benchmarkXirr;

/** The longest bar on the "vs NIFTY" scale: the biggest gap among the rows, either way. */
export const largestGap = (holdings: readonly Pick<Holding, "xirr" | "benchmarkXirr">[]): number =>
	holdings.reduce((max, holding) => Math.max(max, Math.abs(pointsOf(holding) ?? 0)), 0);

/** "+8.6 ahead", "−4.6 behind", or "Level" when the gap rounds to nothing. */
export const pointsWords = (points: number): string => {
	if (Math.abs(points) < 0.0005) return HOLDINGS.pointsLevel;
	const figure = formatPercent(points, { sign: "always", suffix: "" });
	return points > 0 ? HOLDINGS.pointsAhead(figure) : HOLDINGS.pointsBehind(figure);
};

// ─── Order ──────────────────────────────────────────────────────────────

export type SortKey = "effect" | "value" | "return";
export interface Sort {
	key: SortKey;
	dir: "desc" | "asc";
}

/** By rupee effect: the furthest ahead first — or the furthest behind first when looking at what is behind. */
export const defaultSort = (filter: StandingFilter): Sort => ({
	key: "effect",
	dir: filter === "behind" ? "asc" : "desc",
});

/** Choosing a column sorts it largest first; choosing it again turns it round. */
export const nextSort = (current: Sort, key: SortKey): Sort =>
	current.key === key ? { key, dir: current.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" };

type Sortable = Pick<Holding, "effect" | "value" | "xirr" | "name">;

const sortFigure = (holding: Sortable, key: SortKey): number | null => {
	if (key === "value") return Number(holding.value);
	if (key === "return") return holding.xirr;
	return holding.effect === null ? null : Number(holding.effect);
};

/**
 * Rows in the chosen order. A row with no figure for the sorted column goes
 * last whichever way the order runs; ties fall back to value, then name.
 */
export const sortHoldings = <H extends Sortable>(holdings: readonly H[], sort: Sort): H[] => {
	const tie = (a: H, b: H) => Number(b.value) - Number(a.value) || a.name.localeCompare(b.name);
	return [...holdings].sort((a, b) => {
		const x = sortFigure(a, sort.key);
		const y = sortFigure(b, sort.key);
		if (x === null || y === null) return x === y ? tie(a, b) : x === null ? 1 : -1;
		return (sort.dir === "desc" ? y - x : x - y) || tie(a, b);
	});
};

// ─── How many rows at first ─────────────────────────────────────────────

/** The board shows the first nine and a "Show all" button. */
export const FIRST_ROWS = 9;

/** Rows to draw. Hiding a single row would cost as much room as showing it, so then all show. */
export const visibleCount = (total: number, expanded: boolean, first: number = FIRST_ROWS): number =>
	expanded || total <= first + 1 ? total : first;

// ─── What it is made of ─────────────────────────────────────────────────

export interface MakeUpPart {
	assetClass: AssetClass;
	/** Rupees, as the API gave them. */
	value: string;
	/** Share of the selection's holdings, 0 to 1. */
	share: number;
}

/**
 * The split by kind of asset, from the API's `byClass`: kinds with nothing in
 * them are dropped, and the rest come in one fixed order (stocks, funds,
 * gold, bonds, other) so a kind keeps its place and its colour whatever
 * else is held.
 */
export const makeUp = (byClass: Holdings["byClass"]): MakeUpPart[] =>
	ASSET_CLASSES.flatMap((assetClass) => {
		const found = byClass.find((entry) => entry.assetClass === assetClass);
		return found && Number(found.value) > 0 ? [{ assetClass, value: found.value, share: found.weight }] : [];
	});

/** "64%"; a sliver that would round to nothing is "under 1%", never "0%". */
export const shareWords = (share: number): string =>
	share > 0 && share < 0.005 ? HOLDINGS.underOne : formatPercent(share, { decimals: 0 });

// ─── Held in ────────────────────────────────────────────────────────────

type HeldIn = Pick<Holding["heldIn"][number], "accountId" | "label">;

/**
 * Where a script is held, in a few words: the account names while they fit
 * (`max` of them), else "3 accounts". Null when it is not held now (sold).
 * `nameOf` lets a narrow layout say the holder's first name instead of the
 * whole account name.
 */
export const heldInWords = (
	heldIn: readonly HeldIn[],
	max = 2,
	nameOf: (account: HeldIn) => string = (account) => account.label,
): string | null => {
	if (heldIn.length === 0) return null;
	if (heldIn.length > max) return MONEY.accounts(heldIn.length);
	return heldIn.map(nameOf).join(", ");
};

// ─── One script ─────────────────────────────────────────────────────────

/** A quantity of shares or units: Indian grouping, up to three decimals ("3,778", "1,322.456"). */
export const quantityWords = (quantity: string | number): string => {
	const n = Number(quantity);
	return Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "—";
};

/** A price per share: paise are shown only when the price has them ("₹2,106", "₹111.91"). */
export const priceWords = (price: string | number): string =>
	formatMoney(price, { decimals: Number.isInteger(Number(price)) ? 0 : 2 });

/** How many of the trades were buys and how many sells. */
export const tradeCounts = (trades: readonly Pick<Script["trades"][number], "side">[]) => ({
	buys: trades.filter((trade) => trade.side === "buy").length,
	sells: trades.filter((trade) => trade.side === "sell").length,
});

/**
 * Whether the server said "not found" — which is also its answer for a script
 * or a selection the person can no longer see, so both read the same.
 */
export const isNotFound = (error: unknown): boolean => {
	const e = error as { code?: string; status?: number } | null | undefined;
	return e?.code === "NOT_FOUND" || e?.status === 404;
};
