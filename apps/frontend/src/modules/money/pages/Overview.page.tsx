import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconClose, IconInfo } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { Page } from "@frontend/components/layout/Page";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import { MONEY } from "@frontend/copy/money.copy";
import { accountTabPath, NAV } from "@frontend/copy/nav.copy";
import { OVERVIEW } from "@frontend/copy/overview.copy";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { errorWords, firstNameOf, possessive } from "@frontend/modules/access/people.utils";
import { type ReactNode, useEffect, useState } from "react";
import { Caveats } from "../components/Caveats";
import { PeriodToggle } from "../components/PeriodToggle";
import { ScopePicker, useMyGroups, useScopeLabel } from "../components/ScopePicker";
import { useGroupsCompared, useHoldings, useReturns } from "../money.queries";
import { GroupsCompared } from "../overview/GroupsCompared";
import { MoneyMoved } from "../overview/MoneyMoved";
import { NoStatements, Welcome } from "../overview/NothingYet";
import { OverviewHero } from "../overview/OverviewHero";
import { OverviewSkeleton } from "../overview/OverviewSkeleton";
import { accountsInScope, dayPart, peopleIn, staleSx } from "../overview/overview.utils";
import { ScopeChips } from "../overview/ScopeChips";
import { ScriptLists } from "../overview/ScriptLists";
import { EVERYTHING, scopeSearch, useScope } from "../scope";

/** The same rhythm as the page itself, for a block that is dimmed as one. */
const stack = { display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.75 } } as const;

/**
 * Overview: what the selection is worth, how it has done against the same
 * money in NIFTY and gold, how the money moved, which scripts did most
 * either way, and the person's groups side by side. Every figure is the
 * server's; this page only lays them out and says what stands behind them.
 */
export default function OverviewPage() {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const wide = useMediaQuery(theme.breakpoints.up("lg"));
	const session = useSessionInfo();
	const { scope: asked, period, setScope, setPeriod } = useScope();

	const directory = useDirectory();
	const myGroups = useMyGroups();
	const askedLabel = useScopeLabel(asked);

	// The address can name a group, person or account that is not there any
	// more. Then this shows everything, and says so once.
	const narrowed = asked.kind !== "everything";
	const resolving = narrowed && (directory.isPending || myGroups.isPending);
	const gone = narrowed && directory.isSuccess && myGroups.isSuccess && askedLabel.label === null;
	const scope = gone ? EVERYTHING : asked;
	const [saidGone, setSaidGone] = useState(false);
	useEffect(() => {
		if (!gone) return;
		setSaidGone(true);
		setScope(EVERYTHING);
	}, [gone, setScope]);

	const returns = useReturns(scope, period);
	const holdings = useHoldings(scope);
	const compared = useGroupsCompared(period);

	const me = directory.data?.me;
	const inScope = accountsInScope(scope, directory.data, myGroups.data);
	const welcome = directory.data?.accounts.length === 0;

	// On desktop the heading greets the person; a phone's app bar and the
	// browser tab carry the page's name.
	const greeting = OVERVIEW.greet(
		OVERVIEW.greeting[dayPart(new Date().getHours())],
		firstNameOf(me?.name ?? session.user?.name ?? ""),
	);
	const heading = phone || welcome ? undefined : greeting;

	let subtitle: string | undefined;
	if (scope.kind === "everything") subtitle = OVERVIEW.sub.everything;
	else if (scope.kind === "holder") {
		const holder = directory.data?.holders.find((h) => h.id === scope.id);
		subtitle = holder && OVERVIEW.sub.holder(possessive(holder.displayName));
	} else if (askedLabel.label) {
		subtitle = scope.kind === "group" ? OVERVIEW.sub.group(askedLabel.label) : OVERVIEW.sub.account(askedLabel.label);
	}

	const controls = !welcome && (
		<>
			<ScopePicker value={scope} onChange={setScope} />
			<PeriodToggle value={period} onChange={setPeriod} />
		</>
	);

	const data = returns.data;
	let body: ReactNode;
	if (welcome && me) {
		body = <Welcome me={me} />;
	} else if (returns.isPending || (returns.isError && resolving)) {
		body = <OverviewSkeleton phone={phone} wide={wide} />;
	} else if (returns.isError || !data) {
		body = (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void returns.refetch()}>
						{MONEY.retry}
					</Button>
				}
			>
				{errorWords(returns.error, MONEY.loadFailed)}
			</Banner>
		);
	} else if (data.flags.empty) {
		body = directory.isPending ? <OverviewSkeleton phone={phone} wide={wide} /> : <NoStatements accounts={inScope} />;
	} else {
		// While another selection or period loads, the figures already here stay, dimmed.
		const stale = returns.isPlaceholderData;
		body = (
			<Box aria-busy={stale} sx={[stack, staleSx(stale)]}>
				{/* What stands between these figures and the exact truth, before the figures themselves. */}
				<Caveats flags={data.flags} pricesAsOf={data.pricesAsOf} />
				<OverviewHero
					returns={data}
					people={peopleIn(inScope)}
					scopeLabel={data.scope.label}
					phone={phone}
					wide={wide}
				/>
				<MoneyMoved
					moved={data.moved}
					from={data.window.from}
					cashFlowsPath={scope.kind === "account" ? accountTabPath(scope.id, "cash") : null}
					chart={wide}
				/>
				<ScriptLists
					holdings={holdings.data}
					isPending={holdings.isPending}
					failed={holdings.isError ? errorWords(holdings.error, OVERVIEW.scripts.loadFailed) : null}
					onRetry={() => void holdings.refetch()}
					stale={holdings.isPlaceholderData && !stale}
					search={scopeSearch(scope, period)}
					phone={phone}
					wide={wide}
				/>
				{/* Left out for someone with no groups. */}
				{myGroups.data?.length !== 0 && (
					<GroupsCompared
						compared={compared.data}
						isPending={compared.isPending}
						failed={compared.isError ? errorWords(compared.error, OVERVIEW.groups.loadFailed) : null}
						onRetry={() => void compared.refetch()}
						stale={compared.isPlaceholderData && !stale}
						period={period}
						phone={phone}
						wide={wide}
					/>
				)}
			</Box>
		);
	}

	return (
		<Page
			title={NAV.overview}
			heading={heading}
			subtitle={phone || welcome ? undefined : subtitle}
			actions={phone ? undefined : controls || undefined}
		>
			{phone && controls && (
				// On a phone the page header above is empty (the app bar has the title), so close its gap.
				<Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1.25, mt: -2 }}>
					{controls}
				</Box>
			)}
			{saidGone && (
				<Banner
					tone="warn"
					icon={<IconInfo fontSize="inherit" />}
					action={
						<IconButton aria-label={OVERVIEW.dismiss} onClick={() => setSaidGone(false)}>
							<IconClose />
						</IconButton>
					}
				>
					{MONEY.scopeGone}
				</Banner>
			)}
			{!phone &&
				!welcome &&
				(directory.data && myGroups.data ? (
					<ScopeChips
						scope={scope}
						onChange={setScope}
						accountCount={directory.data.accounts.length}
						groups={myGroups.data}
					/>
				) : (
					(directory.isPending || myGroups.isPending) && (
						<Box sx={{ display: "flex", gap: 1 }}>
							{[132, 104, 148, 124].map((width) => (
								<Skeleton key={width} variant="rounded" width={width} height={44} sx={{ borderRadius: 999 }} />
							))}
						</Box>
					)
				))}
			{body}
		</Page>
	);
}
