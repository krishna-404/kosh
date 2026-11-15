import { TableBody, TableCell, TableHead, TableRow } from "@connected-repo/ui-mui/data-display/Table";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { toNumber } from "@connected-repo/ui-mui/format/money";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link as TextLink } from "@connected-repo/ui-mui/navigation/Link";
import type { CashFlowRow } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { ACCOUNT, CLASSIFICATION_LABEL } from "@frontend/copy/account.copy";
import { accountPath } from "@frontend/copy/nav.copy";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import type { AccountInfo } from "../../account.types";
import { absAmount } from "../../account.utils";
import { DataTable } from "../../components/DataTable";
import { LoadFailed, NothingYet, Refreshing } from "../../components/TabStates";
import { LoadMore } from "./LoadMore";

const C = ACCOUNT.cash;
const PAGE_SIZE = 50;

type Show = "external" | "all";

/** What the line said; an opening balance has no line of its own, so it is said in words. */
const narrationOf = (row: CashFlowRow): string =>
	row.narration ?? (row.source === "opening_balance" ? C.openingNarration : C.noNarration);

/** Under "what Kosh took it to be": who decided, and whether it is the same money as a line elsewhere. */
const TookNotes = ({ row }: { row: CashFlowRow }) => {
	if (row.source === "rule" && !row.transfer) return null;
	return (
		<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 0.5 }}>
			{row.source !== "rule" && <Tag>{C.source[row.source]}</Tag>}
			{row.transfer && (
				<Typography variant="caption">
					{row.transfer.otherAccount ? (
						<>
							{C.sameMoneyAs}{" "}
							<TextLink component={Link} to={accountPath(row.transfer.otherAccount.id)}>
								{row.transfer.otherAccount.label}
							</TextLink>
						</>
					) : (
						C.sameMoneyElsewhere
					)}
				</Typography>
			)}
		</Box>
	);
};

/**
 * Money in and out, as Kosh read the ledger: each line with what it said and
 * what Kosh took it to be. By default only the lines that count towards the
 * return — deposits and withdrawals; "Every line" shows the rest.
 */
export const LedgerView = ({ info, phone }: { info: AccountInfo; phone: boolean }) => {
	const accountId = info.account.id;
	const [show, setShow] = useState<Show>("external");
	const feed = useInfiniteQuery(
		orpc.ledger.cashFlows.infiniteOptions({
			input: (before: string | undefined) => ({
				accountId,
				show,
				limit: PAGE_SIZE,
				...(before === undefined ? {} : { before }),
			}),
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (last) => last.nextBefore ?? undefined,
			// Changing the filter keeps the lines on screen (dimmed) until the new ones arrive.
			placeholderData: keepPreviousData,
		}),
	);

	const rows = feed.data?.pages.flatMap((page) => page.rows) ?? [];
	const totals = feed.data?.pages[0]?.totals;
	/** The lines on screen are for the filter that is chosen, not left over from the other one. */
	const settled = feed.isSuccess && !feed.isPlaceholderData;

	// No deposits or withdrawals can mean two things: a ledger with only other
	// lines in it, or no ledger at all. One line of "every line" tells them apart.
	const noExternal = show === "external" && settled && rows.length === 0;
	const anyLine = useQuery(
		orpc.ledger.cashFlows.queryOptions({
			input: { accountId, show: "all", limit: 1 },
			enabled: noExternal,
		}),
	);
	const noLedger = settled && rows.length === 0 && (show === "all" || anyLine.data?.rows.length === 0);

	const filter = (
		<FilterChips<Show>
			ariaLabel={C.showLabel}
			value={show}
			onChange={setShow}
			options={[
				{ value: "external", label: C.showExternal },
				{ value: "all", label: C.showAll },
			]}
		/>
	);

	if (feed.isPending || (noExternal && anyLine.isPending))
		return (
			<>
				{filter}
				<Skeleton variant="rounded" height={360} sx={{ borderRadius: 2.5 }} />
			</>
		);
	if (!feed.data)
		return (
			<>
				{filter}
				<LoadFailed error={feed.error} fallback={C.loadFailed} onRetry={() => void feed.refetch()} />
			</>
		);
	// Nothing at all in the ledger: there is no filter worth offering.
	if (noLedger)
		return (
			<NothingYet info={info} title={C.noLedger.title} canEditBody={C.noLedger.canEdit} viewerBody={C.noLedger.viewer} />
		);

	return (
		<Refreshing on={feed.isPlaceholderData}>
			<Typography color="text.secondary" sx={{ maxWidth: 720 }}>
				{C.lede}
				{totals && (
					<>
						{" "}
						{C.totals} <Money value={totals.in} sx={{ fontWeight: 700, color: "text.primary" }} /> {C.totalIn},{" "}
						<Money value={absAmount(totals.out)} sx={{ fontWeight: 700, color: "text.primary" }} /> {C.totalOut}.
					</>
				)}
			</Typography>
			{filter}

			{rows.length === 0 ? (
				<Banner>{C.noExternal}</Banner>
			) : phone ? (
				<SectionCard padding="none">
					<Box
						component="ul"
						aria-label={C.caption}
						sx={(t) => ({
							listStyle: "none",
							m: 0,
							p: 0,
							"& > li": { px: 2, py: 1.5 },
							"& > li + li": { borderTop: `1px solid ${t.vars.palette.kosh.line}` },
						})}
					>
						{rows.map((row) => {
							const into = toNumber(row.amount) >= 0;
							return (
								<li key={row.id}>
									<Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
										<Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>
											{CLASSIFICATION_LABEL[row.classification]}
										</Typography>
										{/* The sign and the word say which way the money went — not the colour alone. */}
										<Typography component="span" sx={{ flex: "none", fontWeight: 700 }}>
											<Money value={row.amount} decimals={2} sign="always" spacedSign tone="auto" />{" "}
											<Typography component="span" variant="caption">
												{into ? C.in : C.out}
											</Typography>
										</Typography>
									</Box>
									<Typography variant="caption" component="div">
										{formatDate(row.date)}
									</Typography>
									<Typography variant="body2" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>
										{narrationOf(row)}
									</Typography>
									<TookNotes row={row} />
								</li>
							);
						})}
					</Box>
				</SectionCard>
			) : (
				<SectionCard padding="none">
					<DataTable caption={C.caption} minWidth={720}>
						<TableHead>
							<TableRow>
								<TableCell>{C.columns.date}</TableCell>
								<TableCell>{C.columns.said}</TableCell>
								<TableCell>{C.columns.took}</TableCell>
								<TableCell align="right">{C.columns.moneyIn}</TableCell>
								<TableCell align="right">{C.columns.moneyOut}</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{rows.map((row) => {
								const amount = toNumber(row.amount);
								return (
									<TableRow key={row.id}>
										<TableCell sx={{ whiteSpace: "nowrap" }}>
											<Typography variant="numeric">{formatDate(row.date)}</Typography>
										</TableCell>
										<TableCell sx={{ maxWidth: 340, overflowWrap: "anywhere" }}>
											<Typography variant="body2" component="span">
												{narrationOf(row)}
											</Typography>
										</TableCell>
										<TableCell sx={{ minWidth: 190 }}>
											{CLASSIFICATION_LABEL[row.classification]}
											<TookNotes row={row} />
										</TableCell>
										<TableCell align="right">
											{amount > 0 && <Money value={row.amount} decimals={2} sx={{ fontWeight: 700 }} />}
										</TableCell>
										<TableCell align="right">
											{amount < 0 && <Money value={absAmount(row.amount)} decimals={2} sx={{ fontWeight: 700 }} />}
											{amount === 0 && <Money value={0} decimals={2} />}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</DataTable>
				</SectionCard>
			)}

			<LoadMore feed={feed} failed={C.moreFailed} />
		</Refreshing>
	);
};
