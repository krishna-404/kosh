import { TableBody, TableCell, TableHead, TableRow } from "@connected-repo/ui-mui/data-display/Table";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { toNumber } from "@connected-repo/ui-mui/format/money";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { Caveats } from "@frontend/modules/money/components/Caveats";
import { useReturns } from "@frontend/modules/money/money.queries";
import { useScope } from "@frontend/modules/money/scope";
import { type ReactNode, useMemo, useState } from "react";
import type { AccountInfo } from "../account.types";
import { formatRatio, trailRows } from "../account.utils";
import { DataTable } from "../components/DataTable";
import { PeriodRow } from "../components/PeriodRow";
import { LoadFailed, NothingYet, Refreshing } from "../components/TabStates";
import { FeePanel } from "../fees/FeePanel";

const W = ACCOUNT.worked;
/** A long history is folded to this many lines until asked for. */
const FLOWS_SHOWN = 12;

const twoColumns = {
	display: "grid",
	gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.1fr) minmax(0, 1fr)" },
	alignItems: "start",
	gap: { xs: 2, md: 2.25 },
} as const;

/** A headline figure with what it is a rate of ("a year"). */
const Headline = ({ children, unit }: { children: ReactNode; unit?: string }) => (
	<Typography variant="h2" component="p" sx={{ fontVariantNumeric: "tabular-nums", m: 0 }}>
		{children}
		{unit && (
			<Typography component="span" variant="body2" sx={{ ml: 0.75, fontWeight: 400 }}>
				{unit}
			</Typography>
		)}
	</Typography>
);

const Para = ({ children }: { children: ReactNode }) => (
	<Typography variant="body2" sx={{ maxWidth: 620 }}>
		{children}
	</Typography>
);

/** Every amount the return was worked out from, ending in today's value. */
const FlowsCard = ({ returns, phone }: { returns: Returns; phone: boolean }) => {
	const [all, setAll] = useState(false);
	const { rows, closing } = trailRows(returns.trail.flows);
	const shown = all ? rows : rows.slice(0, FLOWS_SHOWN);
	const more = rows.length > FLOWS_SHOWN && (
		<Button variant="text" onClick={() => setAll((on) => !on)} sx={{ ml: -1.5 }}>
			{all ? W.showFewer : W.showAll(rows.length)}
		</Button>
	);

	if (phone)
		return (
			<SectionCard title={W.flowsTitle} subtitle={W.flowsLede} padding="none">
				<Box
					component="ul"
					aria-label={W.flowsCaption}
					sx={(t) => ({
						listStyle: "none",
						m: 0,
						p: 0,
						"& > li": { display: "flex", alignItems: "baseline", gap: 1.5, px: 2.5, py: 1.25 },
						"& > li + li": { borderTop: `1px solid ${t.vars.palette.kosh.line}` },
					})}
				>
					{shown.map((row) => (
						<li key={row.key}>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<Typography component="div">{row.what}</Typography>
								<Typography variant="caption" component="div">
									{formatDate(row.date)}
								</Typography>
							</Box>
							{/* The words say which way the money went — there is no sign or colour to read. */}
							<Box sx={{ textAlign: "right", flex: "none" }}>
								<Money value={row.putIn ?? row.takenOut} sx={{ fontWeight: 700 }} />
								<Typography variant="caption" component="div">
									{row.putIn ? W.columns.putIn : W.columns.takenOut}
								</Typography>
							</Box>
						</li>
					))}
					{more && <li>{more}</li>}
					{closing && (
						<Box component="li" sx={(t) => ({ bgcolor: t.vars.palette.kosh.surface2 })}>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<Typography variant="subtitle2" component="div">
									{closing.what}
								</Typography>
								<Typography variant="caption" component="div">
									{formatDate(closing.date)}
								</Typography>
							</Box>
							<Money value={closing.amount} sx={{ fontWeight: 700 }} />
						</Box>
					)}
				</Box>
			</SectionCard>
		);

	return (
		<SectionCard title={W.flowsTitle} subtitle={W.flowsLede} padding="none">
			<DataTable caption={W.flowsCaption} minWidth={440}>
				<TableHead>
					<TableRow>
						<TableCell>{W.columns.date}</TableCell>
						<TableCell>{W.columns.what}</TableCell>
						<TableCell align="right">{W.columns.putIn}</TableCell>
						<TableCell align="right">{W.columns.takenOut}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{shown.map((row) => (
						<TableRow key={row.key}>
							<TableCell sx={{ whiteSpace: "nowrap" }}>
								<Typography variant="numeric">{formatDate(row.date)}</Typography>
							</TableCell>
							<TableCell>{row.what}</TableCell>
							<TableCell align="right">{row.putIn && <Money value={row.putIn} />}</TableCell>
							<TableCell align="right">{row.takenOut && <Money value={row.takenOut} />}</TableCell>
						</TableRow>
					))}
					{more && (
						<TableRow>
							<TableCell colSpan={4} sx={{ py: 0.5 }}>
								{more}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
				{closing && (
					<tfoot>
						<TableRow>
							<TableCell sx={{ whiteSpace: "nowrap" }}>
								<Typography variant="numeric">{formatDate(closing.date)}</Typography>
							</TableCell>
							<TableCell component="th" scope="row">
								{closing.what}
							</TableCell>
							<TableCell align="right" colSpan={2}>
								<Money value={closing.amount} />
							</TableCell>
						</TableRow>
					</tfoot>
				)}
			</DataTable>
		</SectionCard>
	);
};

/** The one yearly rate, in plain words, and what the same money is put into for the comparison. */
const XirrCard = ({ returns }: { returns: Returns }) => (
	<SectionCard title={W.xirrTitle}>
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
			<Headline unit={returns.xirr === null ? undefined : W.aYear}>
				<Percent value={returns.xirr} tone="auto" />
			</Headline>
			<Para>{returns.xirr === null ? W.xirrNone : W.xirrIs(formatPercent(returns.xirr))}</Para>
			<Para>{W.xirrWhy}</Para>
			{returns.flags.shortWindow && returns.growth !== null && (
				<Para>{W.growthInstead(formatPercent(returns.growth))}</Para>
			)}
			{returns.benchmarks.length > 0 && (
				<>
					<Para>{W.sameMoney}</Para>
					<Box component="ul" sx={{ m: 0, pl: 2.25, display: "flex", flexDirection: "column", gap: 1.25 }}>
						{returns.benchmarks.map((benchmark) => (
							<Typography component="li" variant="body2" key={benchmark.slug}>
								<Box component="b" sx={{ color: "text.primary" }}>
									{benchmark.name}
								</Box>
								{" — "}
								{benchmark.proxy}.
								<Box component="span" sx={{ display: "block", mt: 0.25 }}>
									{benchmark.value === null ? (
										W.benchmarkNone
									) : (
										<>
											{W.benchmarkResult}{" "}
											<Money value={benchmark.value} sx={{ fontWeight: 700, color: "text.primary" }} />
											{benchmark.xirr !== null && (
												<>
													{" · "}
													<Percent value={benchmark.xirr} sx={{ fontWeight: 700, color: "text.primary" }} />{" "}
													{W.aYear}
												</>
											)}
										</>
									)}
								</Box>
								{benchmark.availableFrom && (
									<Box component="span" sx={{ display: "block", mt: 0.25 }}>
										{W.benchmarkFrom(formatDate(benchmark.availableFrom))}
									</Box>
								)}
							</Typography>
						))}
					</Box>
				</>
			)}
		</Box>
	</SectionCard>
);

const MovedRow = ({ label, children, total = false }: { label: string; children: ReactNode; total?: boolean }) => (
	<Box
		sx={(theme) => ({
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: 2,
			py: 1,
			...(total
				? { borderTop: `1px solid ${theme.vars.palette.kosh.line2}`, mt: 0.5, pt: 1.5, fontWeight: 700 }
				: {}),
		})}
	>
		<Typography component="dt" variant={total ? "subtitle2" : "body2"}>
			{label}
		</Typography>
		<Typography component="dd" sx={{ m: 0, fontWeight: total ? 700 : 500, textAlign: "right" }}>
			{children}
		</Typography>
	</Box>
);

/** From the value at the start to the value today, one line per thing that changed it. */
const MovedCard = ({ returns }: { returns: Returns }) => {
	const m = returns.moved;
	const has = (amount: string) => Math.abs(toNumber(amount)) >= 0.005;
	return (
		<SectionCard title={W.movedTitle}>
			<Box component="dl" sx={{ m: 0 }}>
				{has(m.opening) && (
					<MovedRow label={W.moved.opening}>
						<Money value={m.opening} />
					</MovedRow>
				)}
				<MovedRow label={W.moved.putIn}>
					<Money value={m.putIn} sign="always" spacedSign />
				</MovedRow>
				<MovedRow label={W.moved.takenOut}>
					<Money value={`-${m.takenOut}`} sign="always" spacedSign />
				</MovedRow>
				<MovedRow label={W.moved.priceGains}>
					<Money value={m.priceGains} sign="always" spacedSign tone="auto" />
				</MovedRow>
				{/* Dividends are not worked out yet; the line appears once there are any. */}
				{has(m.dividends) && (
					<MovedRow label={W.moved.dividends}>
						<Money value={m.dividends} sign="always" spacedSign />
					</MovedRow>
				)}
				<MovedRow label={W.moved.interest}>
					<Money value={m.interest} sign="always" spacedSign />
				</MovedRow>
				<MovedRow label={W.moved.fees}>
					<Money value={`-${m.fees}`} sign="always" spacedSign />
				</MovedRow>
				<MovedRow label={W.moved.closing} total>
					<Money value={m.closing} />
				</MovedRow>
			</Box>
		</SectionCard>
	);
};

/** How the holdings did with timing taken out — and how that differs from XIRR. */
const TwrCard = ({ returns }: { returns: Returns }) => (
	<SectionCard title={W.twrTitle}>
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
			<Headline unit={returns.twr === null ? undefined : W.aYear}>
				<Percent value={returns.twr} tone="auto" />
			</Headline>
			{returns.twr === null && <Para>{ACCOUNT.noRate}.</Para>}
			<Para>{W.twrIs}</Para>
			<Para>{W.twrDiffers}</Para>
			{returns.growth !== null && <Para>{W.twrTotal(formatPercent(returns.growth))}</Para>}
		</Box>
	</SectionCard>
);

const RiskTile = ({ label, value, unit, what }: { label: string; value: ReactNode | null; unit?: string; what: string }) => (
	<Box sx={{ minWidth: 0 }}>
		<Typography variant="caption" component="h3" sx={{ fontWeight: 600, m: 0 }}>
			{label}
		</Typography>
		<Headline unit={value === null ? undefined : unit}>{value ?? "—"}</Headline>
		<Typography variant="body2" sx={{ mt: 0.5 }}>
			{what}
		</Typography>
		{value === null && (
			<Typography variant="caption" component="p" sx={{ mt: 0.5, mb: 0 }}>
				{W.risk.notYet}
			</Typography>
		)}
	</Box>
);

/** The risk figures, each with one sentence; "—" and the reason when it cannot be measured yet. */
const RiskCard = ({ returns }: { returns: Returns }) => {
	const { volatility, sharpe, sortino, maxDrawdown } = returns.risk;
	return (
		<SectionCard title={W.riskTitle}>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
					gap: { xs: 2.5, lg: 3 },
				}}
			>
				<RiskTile
					label={W.risk.volatility.label}
					value={volatility === null ? null : <Percent value={volatility} />}
					unit={W.risk.volatility.unit}
					what={W.risk.volatility.what}
				/>
				<RiskTile
					label={W.risk.sharpe.label}
					value={sharpe === null ? null : <Typography variant="numeric">{formatRatio(sharpe)}</Typography>}
					what={W.risk.sharpe.what}
				/>
				<RiskTile
					label={W.risk.sortino.label}
					value={sortino === null ? null : <Typography variant="numeric">{formatRatio(sortino)}</Typography>}
					what={W.risk.sortino.what}
				/>
				<RiskTile
					label={W.risk.maxDrawdown.label}
					value={maxDrawdown === null ? null : <Percent value={maxDrawdown.fall} />}
					what={
						maxDrawdown === null
							? W.risk.maxDrawdown.whatNone
							: W.risk.maxDrawdown.what(formatDate(maxDrawdown.peak), formatDate(maxDrawdown.trough))
					}
				/>
			</Box>
		</SectionCard>
	);
};

/**
 * How it’s worked out: the figures behind the return, laid out so anyone
 * who can see the account can check them — the period, every amount
 * counted, the rate in plain words, what the same money is compared with,
 * how the money moved, and how bumpy the ride was.
 */
export const WorkedOutTab = ({ info, phone }: { info: AccountInfo; phone: boolean }) => {
	const { period } = useScope();
	const scope = useMemo(() => ({ kind: "account" as const, id: info.account.id }), [info.account.id]);
	const returns = useReturns(scope, period);
	const data = returns.data;

	return (
		<>
			<PeriodRow>
				<Typography color="text.secondary">{W.lede}</Typography>
			</PeriodRow>
			{returns.isPending ? (
				<>
					<Skeleton variant="rounded" height={72} sx={{ borderRadius: 2.5 }} />
					<Skeleton variant="rounded" height={420} sx={{ borderRadius: 2.5 }} />
				</>
			) : !data ? (
				<LoadFailed error={returns.error} fallback={MONEY.loadFailed} onRetry={() => void returns.refetch()} />
			) : data.flags.empty ? (
				<NothingYet info={info} />
			) : (
				<Refreshing on={returns.isPlaceholderData}>
					{returns.isError && (
						<LoadFailed error={returns.error} fallback={MONEY.loadFailed} onRetry={() => void returns.refetch()} />
					)}
					<SectionCard title={W.windowTitle}>
						<Para>
							<Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>
								{W.window(formatDate(data.window.from), formatDate(data.window.to), data.window.days)}
							</Box>{" "}
							{data.pricesAsOf && W.pricesAsOf(formatDate(data.pricesAsOf))}
							{data.flags.daysOnOldPrices > 0 && ` ${W.oldPrices(data.flags.daysOnOldPrices)}`}
						</Para>
					</SectionCard>
					<Caveats flags={data.flags} />

					<Box sx={twoColumns}>
						<FlowsCard returns={data} phone={phone} />
						<XirrCard returns={data} />
					</Box>
					<Box sx={twoColumns}>
						<MovedCard returns={data} />
						<TwrCard returns={data} />
					</Box>
					<RiskCard returns={data} />

					{/* What the manager is paid from outside the account changes what the return means. */}
					<Box id="manager-fee" sx={{ scrollMarginTop: 96 }}>
						<FeePanel accountId={info.account.id} />
					</Box>

					<Box>
						<Typography variant="eyebrow" component="h2" sx={{ m: 0 }}>
							{W.notesTitle}
						</Typography>
						<Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.25 }}>
							{[data.trail.solver, ...data.trail.notes].filter(Boolean).map((note) => (
								<Typography component="li" variant="caption" key={note}>
									{note}
								</Typography>
							))}
						</Box>
					</Box>
				</Refreshing>
			)}
		</>
	);
};
