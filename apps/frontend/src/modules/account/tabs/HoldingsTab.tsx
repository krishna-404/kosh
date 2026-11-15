import { TableBody, TableCell, TableHead, TableRow } from "@connected-repo/ui-mui/data-display/Table";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDateShort } from "@connected-repo/ui-mui/format/date";
import { toNumber } from "@connected-repo/ui-mui/format/money";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import { DivergingBar } from "@connected-repo/ui-mui/kosh/Bars";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { IconChevronRight, IconInbox } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link as TextLink } from "@connected-repo/ui-mui/navigation/Link";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";
import { ACCOUNT, ASSET_CLASS_LABEL } from "@frontend/copy/account.copy";
import { scriptPath } from "@frontend/copy/nav.copy";
import { Caveats } from "@frontend/modules/money/components/Caveats";
import { useHoldings } from "@frontend/modules/money/money.queries";
import { scopeSearch, useScope } from "@frontend/modules/money/scope";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { AccountInfo } from "../account.types";
import { absAmount, aheadState, formatQuantity } from "../account.utils";
import { cellNote, DataTable } from "../components/DataTable";
import { LoadFailed, NothingYet, Refreshing } from "../components/TabStates";

const H = ACCOUNT.holdings;

/** "GOLDBEES · Gold" — the symbol when the name is something else, and what kind of thing it is. */
const kindLine = (holding: Holding): string =>
	[holding.symbol !== holding.name ? holding.symbol : null, ASSET_CLASS_LABEL[holding.assetClass]]
		.filter(Boolean)
		.join(" · ");

/**
 * How one holding did against NIFTY on its own buys and sells, in rupees:
 * "₹1,16,427 ahead". Said in words and by sign of colour, never colour alone.
 */
const Effect = ({ holding }: { holding: Holding }) => {
	if (holding.effect === null) return <span>—</span>;
	const state = aheadState(holding.effect);
	if (state === "level") return <span>{H.level}</span>;
	return (
		<span>
			<Money value={absAmount(holding.effect)} tone={state === "ahead" ? "pos" : "neg"} sx={{ fontWeight: 700 }} />{" "}
			{state === "ahead" ? H.ahead : H.behind}
		</span>
	);
};

/** The quiet line under it: NIFTY's own rate on the same buys and sells, or why there is none. */
const niftyLine = (holding: Holding): string => {
	if (holding.effect === null) return H.noCompare;
	return holding.benchmarkXirr === null ? "" : H.niftyRate(formatPercent(holding.benchmarkXirr));
};

/**
 * Holdings: what this account holds — how many, at what price and on which
 * day, what it is worth, and how each has done against the same money in
 * NIFTY. Each opens the script's own page, kept to this account.
 */
export const HoldingsTab = ({ info }: { info: AccountInfo }) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const { period } = useScope();
	const [withSold, setWithSold] = useState(false);
	const scope = useMemo(() => ({ kind: "account" as const, id: info.account.id }), [info.account.id]);
	const holdings = useHoldings(scope, withSold);
	const data = holdings.data;

	const scriptTo = (holding: Holding) => `${scriptPath(holding.instrumentId)}${scopeSearch(scope, period)}`;

	if (holdings.isPending)
		return (
			<>
				<Skeleton variant="rounded" height={32} width={280} />
				<Skeleton variant="rounded" height={420} sx={{ borderRadius: 2.5 }} />
			</>
		);
	if (!data)
		return (
			<LoadFailed error={holdings.error} fallback={ACCOUNT.holdingsFailed} onRetry={() => void holdings.refetch()} />
		);
	if (data.flags.empty) return <NothingYet info={info} />;

	const rows = data.holdings;
	const held = rows.filter((holding) => !holding.sold);
	const widest = Math.max(0, ...rows.map((holding) => Math.abs(toNumber(holding.effect ?? 0))));
	const soldToggle = (
		<FilterChips<"sold">
			ariaLabel={H.filterLabel}
			showCheck
			value={withSold ? ["sold"] : []}
			onChange={() => setWithSold((on) => !on)}
			options={[{ value: "sold", label: H.includeSold }]}
			sx={{ flex: "none" }}
		/>
	);

	return (
		<Refreshing on={holdings.isPlaceholderData}>
			{holdings.isError && (
				<LoadFailed error={holdings.error} fallback={ACCOUNT.holdingsFailed} onRetry={() => void holdings.refetch()} />
			)}
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
				<Typography sx={{ flex: "1 1 260px", minWidth: 0 }} color="text.secondary">
					<Box component="b" sx={{ color: "text.primary" }}>
						{H.summary(held.length)}
					</Box>{" "}
					{H.worth} <Money value={data.total} sx={{ fontWeight: 700, color: "text.primary" }} />
					{data.ahead + data.behind > 0 && <> · {H.aheadBehind(data.ahead, data.behind)}</>}
				</Typography>
				{soldToggle}
			</Box>

			<Caveats flags={data.flags} pricesAsOf={data.pricesAsOf} />

			{rows.length === 0 ? (
				<SectionCard>
					<EmptyState
						icon={<IconInbox />}
						title={H.noneNow.title}
						actions={
							withSold ? undefined : (
								<Button variant="outlined" onClick={() => setWithSold(true)}>
									{H.includeSold}
								</Button>
							)
						}
					>
						{H.noneNow.body}
					</EmptyState>
				</SectionCard>
			) : phone ? (
				<SectionCard padding="none">
					<Box
						component="ul"
						aria-label={H.caption}
						sx={(t) => ({
							listStyle: "none",
							m: 0,
							p: 0,
							"& > li + li": { borderTop: `1px solid ${t.vars.palette.kosh.line}` },
						})}
					>
						{rows.map((holding) => (
							<li key={holding.instrumentId}>
								<Box
									component={Link}
									to={scriptTo(holding)}
									sx={(t) => ({
										display: "flex",
										alignItems: "center",
										gap: 1,
										minHeight: 60,
										pl: 2,
										pr: 1,
										py: 1.5,
										color: "inherit",
										textDecoration: "none",
										"&:active": { bgcolor: t.vars.palette.kosh.surface2 },
										"&:focus-visible": { outline: `2px solid ${t.vars.palette.kosh.accent}`, outlineOffset: -2 },
									})}
								>
									<Box sx={{ flex: 1, minWidth: 0 }}>
										<Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
											<Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
												{holding.name}
											</Typography>
											{holding.sold && <Tag>{H.sold}</Tag>}
											<Money value={holding.value} sx={{ fontWeight: 700 }} />
										</Box>
										<Typography variant="caption" component="div">
											{formatQuantity(holding.quantity)} × <Money value={holding.price} decimals={2} />
											{holding.price === null ? ` (${H.noPriceShort})` : ""} · <Percent value={holding.weight} />{" "}
											{H.ofHoldings}
										</Typography>
										<Typography variant="body2" component="div" sx={{ mt: 0.25 }}>
											<Percent value={holding.xirr} tone="auto" sx={{ fontWeight: 700 }} /> {H.aYear} ·{" "}
											<Effect holding={holding} />
										</Typography>
									</Box>
									<IconChevronRight aria-hidden sx={(t) => ({ color: t.vars.palette.kosh.ink3, flex: "none" })} />
								</Box>
							</li>
						))}
					</Box>
				</SectionCard>
			) : (
				<SectionCard padding="none">
					<DataTable caption={H.caption} minWidth={700}>
						<TableHead>
							<TableRow>
								<TableCell>{H.columns.script}</TableCell>
								<TableCell align="right">{H.columns.quantity}</TableCell>
								<TableCell align="right">{H.columns.price}</TableCell>
								<TableCell align="right">{H.columns.value}</TableCell>
								<TableCell align="right">{H.columns.share}</TableCell>
								<TableCell align="right">{H.columns.returns}</TableCell>
								<TableCell>{H.columns.vsNifty}</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{rows.map((holding) => (
								<TableRow key={holding.instrumentId} hover>
									<TableCell component="th" scope="row" sx={{ maxWidth: 220 }}>
										<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
											<TextLink
												component={Link}
												to={scriptTo(holding)}
												aria-label={H.open(holding.name)}
												noWrap
												sx={{ color: "text.primary", fontWeight: 700, minWidth: 0 }}
											>
												{holding.name}
											</TextLink>
											{holding.sold && <Tag>{H.sold}</Tag>}
										</Box>
										<Typography variant="caption" sx={cellNote}>
											{kindLine(holding)}
										</Typography>
									</TableCell>
									<TableCell align="right">
										<Typography variant="numeric">{formatQuantity(holding.quantity)}</Typography>
									</TableCell>
									<TableCell align="right">
										<Money value={holding.price} decimals={2} />
										<Typography variant="caption" sx={cellNote}>
											{holding.price === null
												? H.noPrice
												: holding.priceDate
													? H.priceOn(formatDateShort(holding.priceDate))
													: ""}
										</Typography>
									</TableCell>
									<TableCell align="right">
										<Money value={holding.value} sx={{ fontWeight: 700 }} />
										{holding.price === null && !holding.sold && (
											<Typography variant="caption" sx={cellNote}>
												{H.atLastPaid}
											</Typography>
										)}
									</TableCell>
									<TableCell align="right">
										<Percent value={holding.weight} />
									</TableCell>
									<TableCell align="right">
										<Percent value={holding.xirr} tone="auto" sx={{ fontWeight: 700 }} />
										<Typography variant="caption" sx={cellNote}>
											{H.aYear}
										</Typography>
									</TableCell>
									<TableCell>
										<Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
											{holding.effect !== null && (
												<DivergingBar
													value={toNumber(holding.effect)}
													max={widest}
													width={56}
													sx={{ display: { xs: "none", lg: "block" } }}
												/>
											)}
											<Box sx={{ minWidth: 0, whiteSpace: "nowrap" }}>
												<Effect holding={holding} />
												<Typography variant="caption" sx={cellNote}>
													{niftyLine(holding)}
												</Typography>
											</Box>
										</Box>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</DataTable>
				</SectionCard>
			)}
		</Refreshing>
	);
};
