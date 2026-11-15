import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { IconAlert, IconCheck, IconFilter, IconTrend } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { Scope } from "@connected-repo/zod-schemas/kosh/money.zod";
import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { HOLDINGS, KIND_LABEL } from "@frontend/copy/holdings.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { errorWords, firstNameOf } from "@frontend/modules/access/people.utils";
import { Caveats } from "@frontend/modules/money/components/Caveats";
import { ScopePicker } from "@frontend/modules/money/components/ScopePicker";
import { HoldingsList } from "@frontend/modules/money/holdings/HoldingsList";
import { HoldingsTable } from "@frontend/modules/money/holdings/HoldingsTable";
import {
	type AssetClass,
	countStandings,
	defaultSort,
	filterHoldings,
	isNotFound,
	largestGap,
	makeUp,
	nextSort,
	type Sort,
	type SortKey,
	type StandingFilter,
	sortHoldings,
	visibleCount,
} from "@frontend/modules/money/holdings/holdings.utils";
import { ListFooter } from "@frontend/modules/money/holdings/ListFooter";
import { MakeUpCard } from "@frontend/modules/money/holdings/MakeUpCard";
import { useListView } from "@frontend/modules/money/holdings/useListView";
import { useHoldings } from "@frontend/modules/money/money.queries";
import { EVERYTHING, useScope } from "@frontend/modules/money/scope";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

const SORT_KEYS: readonly SortKey[] = ["effect", "value", "return"];

/**
 * Holdings: every script in the accounts being looked at, each judged on its
 * own buys and sells against the same money in NIFTY on the same dates —
 * so it is plain which ones carried the selection and which held it back.
 */
export default function HoldingsPage() {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const { scope, setScope } = useScope();
	// The filter and "include sold" ride in the address beside the scope, and go with every
	// link to a script — so "back" from one returns to this list as it was left.
	const { filter, includeSold, change, search } = useListView();

	/** Null until the person picks an order; then the default follows the filter. */
	const [chosenSort, setChosenSort] = useState<Sort | null>(null);
	const [expanded, setExpanded] = useState(false);
	const [kindChoice, setKindChoice] = useState<AssetClass | "all">("all");
	const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
	const [scopeGone, setScopeGone] = useState(false);

	const holdings = useHoldings(scope, includeSold);
	const directory = useDirectory();

	// A group or account that is not there any more (deleted, no longer shared):
	// say so once and show everything instead, rather than an error to puzzle over.
	const gone = scope.kind !== "everything" && isNotFound(holdings.error);
	useEffect(() => {
		if (!gone) return;
		setScopeGone(true);
		setScope(EVERYTHING);
	}, [gone, setScope]);
	const pickScope = (next: Scope) => {
		setScopeGone(false);
		setScope(next);
	};

	/** On a phone a script held in one account is tagged with whose it is, as on the board. */
	const firstNames = useMemo(() => {
		const holders = new Map((directory.data?.holders ?? []).map((h) => [h.id, firstNameOf(h.displayName)]));
		return new Map((directory.data?.accounts ?? []).map((a) => [a.id, holders.get(a.personId)]));
	}, [directory.data]);

	const data = holdings.data;
	const all = data?.holdings ?? [];
	const counts = countStandings(all);
	const parts = data ? makeUp(data.byClass) : [];
	// The kind chips are the phone board's; a kind nothing is held in any more filters nothing.
	const kind = phone && parts.some((part) => part.assetClass === kindChoice) ? kindChoice : "all";
	const sort = chosenSort ?? defaultSort(filter);
	const filtered = sortHoldings(filterHoldings(all, filter, kind), sort);
	const rows = filtered.slice(0, visibleCount(filtered.length, expanded));
	const held = all.filter((holding) => !holding.sold).length;
	const listed = Boolean(data) && !data?.flags.empty && all.length > 0;

	const standingOptions = [
		{ value: "all", label: HOLDINGS.all(counts.all) },
		{ value: "ahead", label: HOLDINGS.ahead(counts.ahead), icon: <IconTrend /> },
		{ value: "behind", label: HOLDINGS.behind(counts.behind), icon: <IconAlert /> },
	] as const;
	const setFilter = (next: StandingFilter) => change({ filter: next });

	const footer = (
		<ListFooter
			shown={rows.length}
			total={filtered.length}
			sortKey={sort.key}
			includeSold={includeSold}
			onIncludeSold={(on) => change({ includeSold: on })}
			onShowAll={() => setExpanded(true)}
		/>
	);

	const count = data && listed ? HOLDINGS.count(held, data.scope.accounts, all.length - held) : null;

	return (
		<Page
			title={NAV.holdings}
			subtitle={count ? (phone ? count : `${count} ${HOLDINGS.judged}`) : HOLDINGS.fallbackSubtitle}
			actions={<ScopePicker value={scope} onChange={pickScope} />}
			barAction={
				phone && listed ? (
					<IconButton
						aria-label={`${HOLDINGS.sortLabel}: ${HOLDINGS.sortChoice[sort.key]}`}
						aria-haspopup="menu"
						onClick={(event) => setSortAnchor(event.currentTarget)}
					>
						<IconFilter />
					</IconButton>
				) : undefined
			}
		>
			{scopeGone && <Banner>{MONEY.scopeGone}</Banner>}

			{holdings.isPending || gone ? (
				<HoldingsSkeleton />
			) : holdings.isError || !data ? (
				<Banner
					tone="bad"
					action={
						<Button variant="outlined" onClick={() => void holdings.refetch()}>
							{MONEY.retry}
						</Button>
					}
				>
					{errorWords(holdings.error, MONEY.loadFailed)}
				</Banner>
			) : data.flags.empty ? (
				<SectionCard>
					{scope.kind === "everything" ? (
						<EmptyState
							icon={<IconTrend />}
							title={EMPTY.holdings.title}
							actions={
								<Button component={Link} to={ROUTES.accounts} variant="contained">
									{EMPTY.holdings.action}
								</Button>
							}
						>
							{EMPTY.holdings.body}
						</EmptyState>
					) : (
						<EmptyState
							icon={<IconTrend />}
							title={HOLDINGS.emptyScoped.title}
							actions={
								<>
									<Button component={Link} to={ROUTES.accounts} variant="contained">
										{EMPTY.holdings.action}
									</Button>
									<Button variant="outlined" onClick={() => pickScope(EVERYTHING)}>
										{HOLDINGS.emptyScoped.showEverything}
									</Button>
								</>
							}
						>
							{HOLDINGS.emptyScoped.body}
						</EmptyState>
					)}
				</SectionCard>
			) : all.length === 0 ? (
				<>
					<Caveats flags={data.flags} />
					<SectionCard>
						{includeSold ? (
							<EmptyState icon={<IconTrend />} title={HOLDINGS.noTrades.title}>
								{HOLDINGS.noTrades.body}
							</EmptyState>
						) : (
							<EmptyState
								icon={<IconTrend />}
								title={HOLDINGS.nothingHeldNow.title}
								actions={
									<Button variant="contained" onClick={() => change({ includeSold: true })}>
										{HOLDINGS.includeSold}
									</Button>
								}
							>
								{HOLDINGS.nothingHeldNow.body}
							</EmptyState>
						)}
					</SectionCard>
				</>
			) : (
				<Box
					aria-busy={holdings.isPlaceholderData}
					sx={{
						display: "flex",
						flexDirection: "column",
						gap: 2,
						// The figures of the last selection stay put, dimmed, while the next one loads.
						opacity: holdings.isPlaceholderData ? 0.55 : 1,
						transition: theme.transitions.create("opacity", { duration: 200 }),
					}}
				>
					<Caveats flags={data.flags} />
					<MakeUpCard parts={parts} />

					{phone ? (
						<>
							<Segmented<StandingFilter>
								ariaLabel={HOLDINGS.filterLabel}
								value={filter}
								onChange={setFilter}
								fullWidth
								options={standingOptions.map(({ value, label }) => ({ value, label }))}
							/>
							{parts.length > 1 && (
								<FilterChips<AssetClass | "all">
									ariaLabel={HOLDINGS.kindFilterLabel}
									value={kind}
									onChange={setKindChoice}
									options={[
										{ value: "all", label: HOLDINGS.allKinds },
										...parts.map((part) => ({ value: part.assetClass, label: KIND_LABEL[part.assetClass] })),
									]}
								/>
							)}
						</>
					) : (
						<FilterChips<StandingFilter>
							ariaLabel={HOLDINGS.filterLabel}
							value={filter}
							onChange={setFilter}
							options={standingOptions}
						/>
					)}

					{filtered.length === 0 ? (
						<SectionCard>
							<NothingMatches
								filter={filter}
								kind={kind}
								anyCompared={counts.ahead + counts.behind > 0}
								onShowAll={() => {
									setFilter("all");
									setKindChoice("all");
								}}
							/>
						</SectionCard>
					) : (
						<SectionCard padding="none" sx={{ overflow: "hidden" }}>
							{phone ? (
								<HoldingsList
									rows={rows}
									shortNameOf={(account) => firstNames.get(account.accountId) ?? account.label}
									search={search}
									footer={footer}
								/>
							) : (
								<HoldingsTable
									rows={rows}
									largestGap={largestGap(all)}
									sort={sort}
									onSort={(key) => setChosenSort(nextSort(sort, key))}
									search={search}
									footer={footer}
								/>
							)}
						</SectionCard>
					)}

					<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
						<Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 760 }}>
							{phone ? `${HOLDINGS.judged} ${HOLDINGS.effectNote}` : HOLDINGS.effectNote}
						</Typography>
						<Caveats flags={{}} pricesAsOf={data.pricesAsOf} />
					</Box>
				</Box>
			)}

			<Menu
				anchorEl={sortAnchor}
				open={sortAnchor !== null}
				onClose={() => setSortAnchor(null)}
				anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
				transformOrigin={{ horizontal: "right", vertical: "top" }}
				slotProps={{ paper: { sx: { minWidth: 220 } } }}
			>
				<Typography
					component="li"
					role="presentation"
					variant="eyebrow"
					sx={{ display: "block", px: 2, pt: 1, pb: 0.5, color: "text.secondary" }}
				>
					{HOLDINGS.sortLabel}
				</Typography>
				{SORT_KEYS.map((key) => {
					const on = sort.key === key;
					return (
						<MenuItem
							key={key}
							role="menuitemradio"
							aria-checked={on}
							selected={on}
							onClick={() => {
								// "Effect" goes back to following the filter: furthest behind first under Behind.
								setChosenSort(key === "effect" ? null : { key, dir: "desc" });
								setSortAnchor(null);
							}}
						>
							<Box component="span" sx={{ flex: 1 }}>
								{HOLDINGS.sortChoice[key]}
							</Box>
							<IconCheck fontSize="small" aria-hidden sx={{ visibility: on ? "visible" : "hidden" }} />
						</MenuItem>
					);
				})}
			</Menu>
		</Page>
	);
}

interface NothingMatchesProps {
	filter: StandingFilter;
	kind: AssetClass | "all";
	/** Whether any script could be compared with NIFTY at all. */
	anyCompared: boolean;
	onShowAll: () => void;
}

/** A filter that leaves no rows says what that means, and offers the way back. */
const NothingMatches = ({ filter, kind, anyCompared, onShowAll }: NothingMatchesProps) => {
	const back = (
		<Button variant="outlined" onClick={onShowAll}>
			{HOLDINGS.showAllScripts}
		</Button>
	);
	if (!anyCompared)
		return (
			<EmptyState icon={<IconFilter />} title={HOLDINGS.noneCompared.title} actions={back}>
				{HOLDINGS.noneCompared.body}
			</EmptyState>
		);
	if (kind !== "all" && filter !== "all")
		return (
			<EmptyState icon={<IconFilter />} title={HOLDINGS.noneOfKind.title} actions={back}>
				{HOLDINGS.noneOfKind[filter](kind)}
			</EmptyState>
		);
	const words = filter === "ahead" ? HOLDINGS.noneAhead : HOLDINGS.noneBehind;
	return (
		<EmptyState icon={filter === "ahead" ? <IconFilter /> : <IconTrend />} title={words.title} actions={back}>
			{words.body}
		</EmptyState>
	);
};

/** The page's shape while the first figures load. */
const HoldingsSkeleton = () => (
	<>
		<Skeleton variant="rounded" sx={{ height: { xs: 104, md: 96 }, borderRadius: 2.5 }} />
		<Skeleton variant="rounded" sx={{ height: 44, width: { xs: "100%", md: 320 }, borderRadius: 6 }} />
		<Skeleton variant="rounded" sx={{ height: { xs: 420, md: 520 }, borderRadius: 2.5 }} />
	</>
);
