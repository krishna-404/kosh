import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconSearch } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { Page } from "@frontend/components/layout/Page";
import { KIND_OF_ONE, SCRIPT } from "@frontend/copy/holdings.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { ScopePicker } from "@frontend/modules/money/components/ScopePicker";
import { isNotFound, tradeCounts } from "@frontend/modules/money/holdings/holdings.utils";
import { PriceCard } from "@frontend/modules/money/holdings/PriceCard";
import { SameMoneyCard } from "@frontend/modules/money/holdings/SameMoneyCard";
import { AboutScriptCard, HeldInCard } from "@frontend/modules/money/holdings/ScriptAside";
import { ScriptFigures } from "@frontend/modules/money/holdings/ScriptFigures";
import { TradesCard } from "@frontend/modules/money/holdings/TradesCard";
import { useScript } from "@frontend/modules/money/money.queries";
import { EVERYTHING, useScope } from "@frontend/modules/money/scope";
import { Link as RouterLink, useLocation, useParams } from "react-router";

/**
 * One script (a share, a fund, an ETF) across the accounts in view: what it
 * is worth and what it has returned, the same buys and sells put in NIFTY
 * instead, its price, where it is held, and every buy and sell behind the
 * figures.
 */
export default function ScriptPage() {
	const { instrumentId } = useParams();
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const wide = useMediaQuery(theme.breakpoints.up("lg"));
	const { scope, setScope } = useScope();
	// Back to Holdings as it was left: the scope, and its filter if one came along.
	const back = `${ROUTES.holdings}${useLocation().search}`;
	const script = useScript(instrumentId, scope);

	const picker = <ScopePicker value={scope} onChange={setScope} />;
	const data = script.data;

	if (!data) {
		// Not found and not yours to see look the same on purpose: a script in
		// accounts you cannot see does not exist as far as you can tell.
		const missing = !instrumentId || isNotFound(script.error);
		return (
			<Page title={SCRIPT.title} back={back} actions={picker}>
				{missing ? (
					<SectionCard>
						<EmptyState
							icon={<IconSearch />}
							title={SCRIPT.notHere.title}
							actions={
								<>
									<Button component={RouterLink} to={back} variant="contained">
										{SCRIPT.notHere.back}
									</Button>
									{scope.kind !== "everything" && (
										<Button variant="outlined" onClick={() => setScope(EVERYTHING)}>
											{SCRIPT.notHere.lookEverywhere}
										</Button>
									)}
								</>
							}
						>
							{SCRIPT.notHere.body}
						</EmptyState>
					</SectionCard>
				) : script.isError ? (
					<Banner
						tone="bad"
						action={
							<Button variant="outlined" onClick={() => void script.refetch()}>
								{MONEY.retry}
							</Button>
						}
					>
						{errorWords(script.error, MONEY.loadFailed)}
					</Banner>
				) : (
					<>
						<Skeleton variant="rounded" sx={{ height: { xs: 216, md: 132 }, borderRadius: 2.5 }} />
						<Skeleton variant="rounded" sx={{ height: 236, borderRadius: 2.5 }} />
						<Skeleton variant="rounded" sx={{ height: 320, borderRadius: 2.5 }} />
					</>
				)}
			</Page>
		);
	}

	const { holding, trades, chart } = data;
	const { buys, sells } = tradeCounts(trades);
	const figures = <ScriptFigures holding={holding} buys={buys} sells={sells} />;
	const sameMoney = <SameMoneyCard holding={holding} />;
	const price = <PriceCard name={holding.name} chart={chart} />;
	const heldIn = <HeldInCard heldIn={holding.heldIn} />;
	const about = <AboutScriptCard holding={holding} />;
	const buysAndSells = <TradesCard trades={trades} phone={phone} />;

	return (
		<Page
			title={holding.name}
			// Most scripts are known by their symbol; say it only when the name is something else.
			// A phone's app bar cuts a long name short, so there the whole name is said again.
			subtitle={[
				phone && holding.symbol !== holding.name ? holding.name : null,
				holding.symbol === holding.name ? null : holding.symbol,
				KIND_OF_ONE[holding.assetClass],
			]
				.filter(Boolean)
				.join(" · ")}
			eyebrow={
				phone ? undefined : (
					<Box
						component="nav"
						aria-label={SCRIPT.crumbLabel}
						sx={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, fontSize: "0.8125rem", color: "text.secondary" }}
					>
						<Link component={RouterLink} to={back}>
							{NAV.holdings}
						</Link>
						{` / ${holding.name}`}
					</Box>
				)
			}
			back={back}
			actions={picker}
		>
			{wide ? (
				<Box sx={{ display: "flex", alignItems: "flex-start", gap: 2.5 }}>
					<Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.25 }}>
						{figures}
						{sameMoney}
						{price}
						{buysAndSells}
					</Box>
					<Box component="aside" sx={{ width: 330, flex: "none", display: "flex", flexDirection: "column", gap: 2 }}>
						{heldIn}
						{about}
					</Box>
				</Box>
			) : (
				<>
					{figures}
					{sameMoney}
					{heldIn}
					{price}
					{buysAndSells}
					{about}
				</>
			)}
		</Page>
	);
}
