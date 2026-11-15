import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import type { FeeEffect } from "@connected-repo/zod-schemas/kosh/income.zod";
import { MONEY } from "@frontend/copy/money.copy";

interface FeeEffectNoteProps {
	/** From any figure that carries it; nothing is drawn when no fee is counted. */
	fees: FeeEffect | null | undefined;
	/** `short` for a table row or a hero line; `full` also says what the fees came to. */
	form?: "short" | "full";
}

/**
 * "After the fund manager's fees. Before fees: 14.8% a year." — said beside
 * a return whenever a fee paid from outside the account has been counted in
 * it, so the reader always knows which of the two they are looking at.
 */
export const FeeEffectNote = ({ fees, form = "full" }: FeeEffectNoteProps) => {
	if (!fees) return null;
	const before = fees.xirrBefore === null ? null : formatPercent(fees.xirrBefore);
	return (
		<Typography variant="caption" component="div" sx={{ color: "inherit", opacity: 0.85 }}>
			{form === "short" ? MONEY.fees.short(before) : MONEY.fees.full(formatMoney(fees.total), before)}
		</Typography>
	);
};
