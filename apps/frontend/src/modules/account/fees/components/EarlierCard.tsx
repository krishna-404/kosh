import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { FeeArrangement } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { arrangementSentence } from "../fees.utils";

interface EarlierCardProps {
	/** Arrangements that ran before the one running now, newest first. */
	earlier: readonly FeeArrangement[];
	/** Fees were charged on this account, so what these came to is still in the return. */
	charged: boolean;
	today: string;
}

/** What the manager was paid before — listed quietly, each as its sentence with its dates. */
export const EarlierCard = ({ earlier, charged, today }: EarlierCardProps) => (
	<SectionCard title={FEES.earlier.title} subtitle={charged ? FEES.earlier.lead : undefined}>
		<Box
			component="ul"
			sx={(theme) => ({
				m: 0,
				p: 0,
				listStyle: "none",
				"& > li": { py: 1.25 },
				"& > li:first-of-type": { pt: 0 },
				"& > li:last-of-type": { pb: 0 },
				"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
			})}
		>
			{earlier.map((arrangement) => (
				<Typography key={arrangement.id} component="li" variant="body2">
					{arrangementSentence(arrangement, today)}
				</Typography>
			))}
		</Box>
	</SectionCard>
);
