import { TableBody, TableCell, TableHead, TableRow } from "@connected-repo/ui-mui/data-display/Table";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { AccountInfo } from "../../account.types";
import { formatQuantity } from "../../account.utils";
import { DataTable } from "../../components/DataTable";
import { LoadFailed, NothingYet } from "../../components/TabStates";
import { LoadMore } from "./LoadMore";

const C = ACCOUNT.cash;
const PAGE_SIZE = 50;

/** Every buy and sell Kosh has for this account, newest first. */
export const TradesView = ({ info, phone }: { info: AccountInfo; phone: boolean }) => {
	const accountId = info.account.id;
	const feed = useInfiniteQuery(
		orpc.ledger.trades.infiniteOptions({
			input: (before: string | undefined) => ({
				accountId,
				limit: PAGE_SIZE,
				...(before === undefined ? {} : { before }),
			}),
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (last) => last.nextBefore ?? undefined,
		}),
	);

	if (feed.isPending) return <Skeleton variant="rounded" height={360} sx={{ borderRadius: 2.5 }} />;
	if (!feed.data)
		return <LoadFailed error={feed.error} fallback={C.tradesFailed} onRetry={() => void feed.refetch()} />;

	const rows = feed.data.pages.flatMap((page) => page.rows);
	const total = feed.data.pages[0]?.total ?? rows.length;
	if (rows.length === 0)
		return (
			<NothingYet info={info} title={C.noTrades.title} canEditBody={C.noTrades.canEdit} viewerBody={C.noTrades.viewer} />
		);

	return (
		<>
			<Typography color="text.secondary">
				<Box component="b" sx={{ color: "text.primary" }}>
					{C.tradesTotal(total)}
				</Box>
				{C.tradesNewest}
			</Typography>

			{phone ? (
				<SectionCard padding="none">
					<Box
						component="ul"
						aria-label={C.tradesCaption}
						sx={(t) => ({
							listStyle: "none",
							m: 0,
							p: 0,
							"& > li": { px: 2, py: 1.5 },
							"& > li + li": { borderTop: `1px solid ${t.vars.palette.kosh.line}` },
						})}
					>
						{rows.map((row) => (
							<li key={row.id}>
								<Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
									<Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
										{C.side[row.side]} {row.symbol}
									</Typography>
									<Money value={row.value} decimals={2} sx={{ fontWeight: 700 }} />
								</Box>
								<Typography variant="caption" component="div">
									{formatDate(row.date)} · {formatQuantity(row.quantity)} × <Money value={row.price} decimals={2} />
								</Typography>
							</li>
						))}
					</Box>
				</SectionCard>
			) : (
				<SectionCard padding="none">
					<DataTable caption={C.tradesCaption} minWidth={640}>
						<TableHead>
							<TableRow>
								<TableCell>{C.tradeColumns.date}</TableCell>
								<TableCell>{C.tradeColumns.script}</TableCell>
								<TableCell>{C.tradeColumns.side}</TableCell>
								<TableCell align="right">{C.tradeColumns.quantity}</TableCell>
								<TableCell align="right">{C.tradeColumns.price}</TableCell>
								<TableCell align="right">{C.tradeColumns.amount}</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell sx={{ whiteSpace: "nowrap" }}>
										<Typography variant="numeric">{formatDate(row.date)}</Typography>
									</TableCell>
									<TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>
										{row.symbol}
									</TableCell>
									<TableCell>{C.side[row.side]}</TableCell>
									<TableCell align="right">
										<Typography variant="numeric">{formatQuantity(row.quantity)}</Typography>
									</TableCell>
									<TableCell align="right">
										<Money value={row.price} decimals={2} />
									</TableCell>
									<TableCell align="right">
										<Money value={row.value} decimals={2} sx={{ fontWeight: 700 }} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</DataTable>
				</SectionCard>
			)}

			<LoadMore feed={feed} failed={C.moreFailed} />
		</>
	);
};
