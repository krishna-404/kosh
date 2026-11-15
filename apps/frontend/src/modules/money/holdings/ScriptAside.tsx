import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatMonth } from "@connected-repo/ui-mui/format/date";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { IconChevronRight } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";
import { KIND_OF_ONE, SCRIPT } from "@frontend/copy/holdings.copy";
import { BROKER_LABEL } from "@frontend/copy/levels.copy";
import { accountPath } from "@frontend/copy/nav.copy";
import type { ReactNode } from "react";
import { quantityWords } from "./holdings.utils";
import { linkedRow, RowLink } from "./RowLink";

interface HeldInCardProps {
	heldIn: Holding["heldIn"];
}

/** The accounts that hold the script now: how much each has, since when — each row opens that account. */
export const HeldInCard = ({ heldIn }: HeldInCardProps) => (
	<SectionCard title={SCRIPT.heldTitle} padding="none" sx={{ overflow: "hidden" }}>
		{heldIn.length === 0 ? (
			<Typography variant="body2" sx={{ px: 2.5, pb: 2.5, color: "text.secondary" }}>
				{SCRIPT.notHeld}
			</Typography>
		) : (
			<Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
				{heldIn.map((account) => (
					<Box
						component="li"
						key={account.accountId}
						sx={[
							linkedRow,
							(theme) => ({
								display: "flex",
								alignItems: "center",
								gap: 1.5,
								minHeight: 64,
								pl: 2.5,
								pr: 1.25,
								py: 1.25,
								borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
								"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
							}),
						]}
					>
						<BrokerMark broker={BROKER_LABEL[account.broker]} />
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<RowLink to={accountPath(account.accountId)}>{account.label}</RowLink>
							<Typography variant="caption" component="div" sx={{ color: "text.secondary" }}>
								{SCRIPT.since(formatMonth(account.since))}
							</Typography>
						</Box>
						<Box sx={{ flex: "none", textAlign: "right" }}>
							<Money value={account.value} sx={{ display: "block", fontSize: "0.8125rem", fontWeight: 700 }} />
							<Typography variant="caption" component="div" sx={{ color: "text.secondary" }}>
								{SCRIPT.heldQuantity(quantityWords(account.quantity))}
							</Typography>
						</Box>
						<IconChevronRight aria-hidden sx={(theme) => ({ flex: "none", color: theme.vars.palette.kosh.ink3 })} />
					</Box>
				))}
			</Box>
		)}
	</SectionCard>
);

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
	<Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
		<Typography variant="body2" component="dt" sx={{ color: "text.secondary" }}>
			{label}
		</Typography>
		<Typography
			variant="body2"
			component="dd"
			sx={{ m: 0, fontWeight: 700, color: "text.primary", textAlign: "right", overflowWrap: "anywhere" }}
		>
			{children}
		</Typography>
	</Box>
);

interface AboutScriptCardProps {
	holding: Holding;
}

/** What the script is: its symbol, its kind, its ISIN, and how much of the holdings in view it makes up. */
export const AboutScriptCard = ({ holding }: AboutScriptCardProps) => (
	<SectionCard title={SCRIPT.aboutTitle}>
		<Box component="dl" sx={{ m: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
			<Fact label={SCRIPT.symbol}>{holding.symbol}</Fact>
			<Fact label={SCRIPT.kind}>{KIND_OF_ONE[holding.assetClass]}</Fact>
			{holding.isin && <Fact label={SCRIPT.isin}>{holding.isin}</Fact>}
			{!holding.sold && (
				<Fact label={SCRIPT.shareOfHoldings}>
					{holding.weight > 0 && holding.weight < 0.0005
						? SCRIPT.underTenth
						: formatPercent(holding.weight, { decimals: 1 })}
				</Fact>
			)}
		</Box>
	</SectionCard>
);
