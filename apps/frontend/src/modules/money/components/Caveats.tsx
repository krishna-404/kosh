import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { MONEY } from "@frontend/copy/money.copy";

interface CaveatsProps {
	flags: Partial<Returns["flags"]>;
	/** The day prices run to; shown small, since every figure depends on it. */
	pricesAsOf?: string | null;
	/** Leave the "questions waiting" line out where the page already says it its own way. */
	hideQuestions?: boolean;
}

/**
 * What stands between these figures and the exact truth, said plainly:
 * prices still loading, a holding with no price, an account with no ledger,
 * questions unanswered, too little history for a yearly rate. Shown wherever
 * the figures are, so a number is never more confident than it should be.
 */
export const Caveats = ({ flags, pricesAsOf, hideQuestions = false }: CaveatsProps) => {
	const lines = [
		flags.pricesLoading ? MONEY.pricesLoading : null,
		flags.shortWindow ? MONEY.shortWindow : null,
		flags.accountsWithoutLedger ? MONEY.noLedger(flags.accountsWithoutLedger) : null,
		flags.unpricedHoldings ? MONEY.unpriced(flags.unpricedHoldings) : null,
		!hideQuestions && flags.questionsWaiting ? MONEY.questionsWaiting(flags.questionsWaiting) : null,
	].filter((line): line is string => line !== null);

	if (lines.length === 0 && !pricesAsOf) return null;
	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
			{lines.map((line) => (
				<Banner key={line} tone={line === MONEY.pricesLoading ? "info" : "warn"}>
					{line}
				</Banner>
			))}
			{pricesAsOf && (
				<Typography variant="caption" sx={{ color: "text.secondary" }}>
					{MONEY.pricesAsOf(formatDate(pricesAsOf))}
				</Typography>
			)}
		</Box>
	);
};
