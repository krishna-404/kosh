import { Table, TableBody, TableCell, TableHead, TableRow } from "@connected-repo/ui-mui/data-display/Table";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { RowItem, RowList } from "@connected-repo/ui-mui/kosh/RowItem";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Script } from "@connected-repo/zod-schemas/kosh/money.zod";
import { SCRIPT } from "@frontend/copy/holdings.copy";
import { useState } from "react";
import { priceWords, quantityWords, visibleCount } from "./holdings.utils";

/** How many buys and sells show before "Show all". */
const FIRST_TRADES = 10;

interface TradesCardProps {
	/** Newest first, as the API gives them. */
	trades: Script["trades"];
	phone: boolean;
}

/**
 * Every buy and sell of the script in the accounts in view — the lines its
 * figures are built from: when, in which account, how many, at what price.
 */
export const TradesCard = ({ trades, phone }: TradesCardProps) => {
	const [expanded, setExpanded] = useState(false);
	const shown = trades.slice(0, visibleCount(trades.length, expanded, FIRST_TRADES));
	const side = (trade: Script["trades"][number]) => (trade.side === "buy" ? SCRIPT.bought : SCRIPT.sold);

	return (
		<SectionCard title={SCRIPT.tradesTitle} padding="none" sx={{ overflow: "hidden" }}>
			{trades.length === 0 ? (
				<Typography variant="body2" sx={{ px: 2.5, pb: 2.5, color: "text.secondary" }}>
					{SCRIPT.noTrades}
				</Typography>
			) : phone ? (
				<RowList sx={(theme) => ({ borderTop: `1px solid ${theme.vars.palette.kosh.line}` })}>
					{shown.map((trade, index) => (
						<RowItem
							// A day can hold two identical lines; the position tells them apart.
							key={`${trade.date}-${trade.accountLabel}-${index}`}
							primary={SCRIPT.tradeLine(side(trade), quantityWords(trade.quantity), priceWords(trade.price))}
							secondary={`${formatDate(trade.date)} · ${trade.accountLabel}`}
							trailing={<Money value={trade.value} sx={{ fontSize: "0.8125rem", fontWeight: 700 }} />}
							sx={{ px: 2.5 }}
						/>
					))}
				</RowList>
			) : (
				<Table
					aria-label={SCRIPT.tradesLabel}
					sx={{
						"& td, & th": { px: 1, py: 1.5 },
						"& th": { whiteSpace: "nowrap" },
						"& tr > :first-of-type": { pl: 2.5 },
						"& tr > :last-of-type": { pr: 2.5 },
						"& tbody tr:last-of-type > td": { borderBottom: 0 },
					}}
				>
					<TableHead>
						<TableRow>
							<TableCell>{SCRIPT.tradeColumns.date}</TableCell>
							<TableCell>{SCRIPT.tradeColumns.account}</TableCell>
							<TableCell>{SCRIPT.tradeColumns.side}</TableCell>
							<TableCell align="right">{SCRIPT.tradeColumns.quantity}</TableCell>
							<TableCell align="right">{SCRIPT.tradeColumns.price}</TableCell>
							<TableCell align="right">{SCRIPT.tradeColumns.amount}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{shown.map((trade, index) => (
							<TableRow key={`${trade.date}-${trade.accountLabel}-${index}`}>
								<TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(trade.date)}</TableCell>
								<TableCell>{trade.accountLabel}</TableCell>
								<TableCell>{side(trade)}</TableCell>
								<TableCell align="right">
									<Typography variant="numeric">{quantityWords(trade.quantity)}</Typography>
								</TableCell>
								<TableCell align="right">
									<Typography variant="numeric">{priceWords(trade.price)}</Typography>
								</TableCell>
								<TableCell align="right">
									<Money value={trade.value} sx={{ fontWeight: 700 }} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
			{shown.length < trades.length && (
				<Box
					sx={(theme) => ({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: 1.5,
						px: { xs: 2, md: 2.5 },
						py: 1,
						borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
					})}
				>
					<Typography variant="body2" sx={{ flex: "1 1 180px", color: "text.secondary" }}>
						{SCRIPT.showingTrades(shown.length, trades.length)}
					</Typography>
					<Button variant="text" onClick={() => setExpanded(true)}>
						{SCRIPT.showAll(trades.length)}
					</Button>
				</Box>
			)}
		</SectionCard>
	);
};
