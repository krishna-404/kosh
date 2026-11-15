import { Box } from "@connected-repo/ui-mui/layout/Box";
import { PeriodToggle } from "@frontend/modules/money/components/PeriodToggle";
import { useScope } from "@frontend/modules/money/scope";
import type { ReactNode } from "react";

/**
 * The stretch of time the figures below cover: 1 year · 3 years · Since you
 * started. It lives in the address (`?over=1y`), so Returns and "How it’s
 * worked out" always show the same period.
 */
export const PeriodRow = ({ children }: { children?: ReactNode }) => {
	const { period, setPeriod } = useScope();
	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: { xs: "column", md: "row" },
				// Natural width on a phone too: stretched, "Since you started" breaks in two.
				alignItems: { xs: "flex-start", md: "center" },
				gap: 1.5,
			}}
		>
			<Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
			<PeriodToggle value={period} onChange={setPeriod} />
		</Box>
	);
};
