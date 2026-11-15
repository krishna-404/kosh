import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import { IconChevronRight } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";
import { HOLDINGS } from "@frontend/copy/holdings.copy";
import { scriptPath } from "@frontend/copy/nav.copy";
import type { ReactNode } from "react";
import { heldInWords, pointsOf } from "./holdings.utils";
import { linkedRow, RowLink } from "./RowLink";

interface HoldingsListProps {
	/** The rows to draw, already filtered, ordered and cut to length. */
	rows: readonly Holding[];
	/** A short name for the account a script sits in — the holder's first name. */
	shortNameOf: (account: { accountId: string; label: string }) => string;
	/** The scope, as a query string, carried to each script's page. */
	search: string;
	footer: ReactNode;
}

/**
 * Phone: one script a row — its value, return and where it is held on the
 * left; how far ahead or behind NIFTY it is, in points and in rupees, on
 * the right. The row opens the script.
 */
export const HoldingsList = ({ rows, shortNameOf, search, footer }: HoldingsListProps) => (
	<Box>
		<Box component="ul" aria-label={HOLDINGS.tableLabel} sx={{ listStyle: "none", m: 0, p: 0 }}>
			{rows.map((holding) => {
				const points = pointsOf(holding);
				const line = [
					holding.sold ? null : formatMoney(holding.value),
					holding.xirr === null ? null : formatPercent(holding.xirr),
					heldInWords(holding.heldIn, 1, shortNameOf),
				].filter((part): part is string => part !== null);
				return (
					<Box
						component="li"
						key={holding.instrumentId}
						sx={[
							linkedRow,
							(theme) => ({
								display: "flex",
								alignItems: "center",
								gap: 1,
								minHeight: 64,
								pl: 2,
								pr: 1,
								py: 1.25,
								"& + &": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
								"&:active": { bgcolor: theme.vars.palette.kosh.surface2 },
							}),
						]}
					>
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 0.75, rowGap: 0.25 }}>
								<RowLink to={`${scriptPath(holding.instrumentId)}${search}`}>{holding.name}</RowLink>
								{holding.sold && <Tag>{HOLDINGS.sold}</Tag>}
								{!holding.sold && holding.price === null && <Tag tone="pending">{HOLDINGS.noMarketPrice}</Tag>}
							</Box>
							<Typography
								variant="caption"
								component="div"
								noWrap
								sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}
							>
								{line.join(" · ")}
							</Typography>
						</Box>
						<Box sx={{ textAlign: "right", flex: "none" }}>
							{holding.effect === null ? (
								<Typography variant="caption" sx={{ color: "text.secondary" }}>
									{HOLDINGS.notComparedShort}
								</Typography>
							) : (
								<>
									{points !== null && (
										<Percent
											value={points}
											sign="always"
											suffix=" pts"
											tone="auto"
											sx={{ display: "block", fontSize: "0.8125rem", fontWeight: 700 }}
										/>
									)}
									<Money
										value={holding.effect}
										sign="always"
										tone={points === null ? "auto" : "plain"}
										sx={{
											display: "block",
											fontSize: points === null ? "0.8125rem" : "0.75rem",
											fontWeight: points === null ? 700 : 500,
											color: points === null ? undefined : "text.secondary",
										}}
									/>
								</>
							)}
						</Box>
						<IconChevronRight aria-hidden sx={(theme) => ({ flex: "none", color: theme.vars.palette.kosh.ink3 })} />
					</Box>
				);
			})}
		</Box>
		{footer}
	</Box>
);
