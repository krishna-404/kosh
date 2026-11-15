import { type Amount, toNumber } from "./money";

export interface PercentOptions {
	decimals?: number;
	/** `auto`: a minus when negative · `always`: + or − · `never`: no sign. */
	sign?: "auto" | "always" | "never";
	/** `%` for a rate, ` pts` for a difference between two rates, `` for bare. */
	suffix?: "%" | " pts" | "";
}

const MINUS = "−";

/**
 * A rate given as a fraction (0.142) → "14.2%".
 * Differences between two rates are percentage points: `suffix: " pts"`.
 */
export const formatPercent = (fraction: Amount, options: PercentOptions = {}): string => {
	const { decimals = 1, sign = "auto", suffix = "%" } = options;
	const n = toNumber(fraction) * 100;
	if (!Number.isFinite(n)) return "—";
	const body = Math.abs(n).toFixed(decimals);
	const isZero = Number(body) === 0;
	let prefix = "";
	if (!isZero && sign !== "never") {
		if (n < 0) prefix = MINUS;
		else if (sign === "always") prefix = "+";
	}
	return `${prefix}${body}${suffix}`;
};
