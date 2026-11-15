import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import type { Period } from "@connected-repo/zod-schemas/kosh/money.zod";
import { MONEY } from "@frontend/copy/money.copy";

/** The stretches of time the design offers, shortest first. */
const SHOWN: readonly Period[] = ["1y", "3y", "all"];

interface PeriodToggleProps {
	value: Period;
	onChange: (period: Period) => void;
	fullWidth?: boolean;
}

/** 1 year · 3 years · Since you started. */
export const PeriodToggle = ({ value, onChange, fullWidth }: PeriodToggleProps) => (
	<Segmented<Period>
		ariaLabel={MONEY.periodLabel}
		value={SHOWN.includes(value) ? value : "all"}
		onChange={onChange}
		fullWidth={fullWidth}
		options={SHOWN.map((period) => ({ value: period, label: MONEY.period[period] }))}
	/>
);
