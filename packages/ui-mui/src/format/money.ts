/** A decimal string from the API ("2062200.00") or a plain number. */
export type Amount = string | number;

export interface MoneyOptions {
	/** `full`: ₹2,06,22,000 · `compact`: ₹2.06 Cr, ₹39.1 L (full below ₹1 L). */
	notation?: "full" | "compact";
	/** Paise are shown only where the ledger needs them. */
	decimals?: 0 | 2;
	/** `auto`: a minus when negative · `always`: + or − · `never`: no sign. */
	sign?: "auto" | "always" | "never";
	/** Put a space after the sign, as in the "how the money moved" list. */
	spacedSign?: boolean;
}

const MINUS = "−";
const CRORE = 10_000_000;
const LAKH = 100_000;

export const toNumber = (value: Amount): number =>
	typeof value === "number" ? value : Number(value);

/** 20622000 → "2,06,22,000" (Indian grouping: 3, then 2s). */
export const groupIndian = (digits: string): string => {
	if (digits.length <= 3) return digits;
	const last3 = digits.slice(-3);
	const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
	return `${rest},${last3}`;
};

const trimZeros = (s: string): string => s.replace(/\.?0+$/, "");

/** The amount without sign or symbol. */
const magnitude = (abs: number, notation: "full" | "compact", decimals: 0 | 2): string => {
	if (notation === "compact" && abs >= CRORE) return `${trimZeros((abs / CRORE).toFixed(2))} Cr`;
	if (notation === "compact" && abs >= LAKH) return `${trimZeros((abs / LAKH).toFixed(2))} L`;
	const fixed = abs.toFixed(decimals);
	const [whole = "0", fraction] = fixed.split(".");
	return fraction ? `${groupIndian(whole)}.${fraction}` : groupIndian(whole);
};

/** Rupees, the way an Indian statement writes them. */
export const formatMoney = (value: Amount, options: MoneyOptions = {}): string => {
	const { notation = "full", decimals = 0, sign = "auto", spacedSign = false } = options;
	const n = toNumber(value);
	if (!Number.isFinite(n)) return "—";
	const body = `₹${magnitude(Math.abs(n), notation, decimals)}`;
	// A value that rounds to zero carries no sign.
	const isZero = /^₹0(\.0+)?$/.test(body);
	let prefix = "";
	if (!isZero && sign !== "never") {
		if (n < 0) prefix = MINUS;
		else if (sign === "always") prefix = "+";
	}
	return prefix ? `${prefix}${spacedSign ? " " : ""}${body}` : body;
};
