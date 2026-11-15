/**
 * Decimal-string money math for the import pipeline — BigInt only, never
 * IEEE floats (money precision is load-bearing for fund-flow returns).
 * Kept local to imports; the metrics engine has its own decimal kernel.
 */

interface Parsed {
	value: bigint;
	scale: number;
}

function parse(s: string): Parsed {
	const neg = s.startsWith("-");
	const body = neg ? s.slice(1) : s;
	const [int = "", frac = ""] = body.split(".");
	if (!/^\d+$/.test(int) || (frac !== "" && !/^\d+$/.test(frac))) {
		throw new Error(`Not a decimal string: ${s}`);
	}
	const value = BigInt(int + frac || "0");
	return { value: neg ? -value : value, scale: frac.length };
}

/** Round a scaled bigint to `targetScale` decimals, half-up on magnitude. */
function rescale(value: bigint, scale: number, targetScale: number): bigint {
	if (scale === targetScale) return value;
	if (scale < targetScale) return value * 10n ** BigInt(targetScale - scale);
	const drop = 10n ** BigInt(scale - targetScale);
	const neg = value < 0n;
	const abs = neg ? -value : value;
	const q = abs / drop;
	const r = abs % drop;
	const rounded = r * 2n >= drop ? q + 1n : q;
	return neg ? -rounded : rounded;
}

function format(value: bigint, scale: number): string {
	const neg = value < 0n;
	const abs = neg ? -value : value;
	const s = abs.toString().padStart(scale + 1, "0");
	const int = s.slice(0, s.length - scale) || "0";
	const frac = scale > 0 ? `.${s.slice(s.length - scale)}` : "";
	return `${neg ? "-" : ""}${int}${frac}`;
}

/** Multiply two decimal strings, returning a 2-dp money string (half-up). */
export function mulToMoney(a: string, b: string): string {
	const pa = parse(a);
	const pb = parse(b);
	const product = pa.value * pb.value;
	return format(rescale(product, pa.scale + pb.scale, 2), 2);
}

/**
 * Signed cash-flow amount from a Zerodha ledger line: credit is money INTO
 * the account (+), debit is money OUT (−). Exactly one of the two is nonzero
 * (the parser rejects rows with both). Returns a 2-dp money string.
 */
export function signedFlowAmount(
	debit: string | null,
	credit: string | null,
): string {
	const c = credit ? parse(credit) : { value: 0n, scale: 0 };
	const d = debit ? parse(debit) : { value: 0n, scale: 0 };
	const scale = Math.max(c.scale, d.scale, 2);
	const net =
		rescale(c.value, c.scale, scale) - rescale(d.value, d.scale, scale);
	return format(rescale(net, scale, 2), 2);
}

/** Any decimal string as 2-dp money, half-up: "100000.000000" → "100000.00". */
export function toMoney(s: string | null): string {
	if (s === null || s === "") return "0.00";
	const p = parse(s);
	return format(rescale(p.value, p.scale, 2), 2);
}

/** a + b, as 2-dp money. */
export function addMoney(a: string, b: string): string {
	const pa = parse(toMoney(a));
	const pb = parse(toMoney(b));
	return format(pa.value + pb.value, 2);
}

/** −a, as 2-dp money. */
export function negateMoney(a: string): string {
	const p = parse(toMoney(a));
	return format(-p.value, 2);
}

/** -1, 0 or 1 as a is below, equal to or above b. */
export function compareMoney(a: string, b: string): -1 | 0 | 1 {
	const d = parse(toMoney(a)).value - parse(toMoney(b)).value;
	return d < 0n ? -1 : d > 0n ? 1 : 0;
}

export const isZeroMoney = (a: string | null): boolean => compareMoney(a ?? "0", "0") === 0;

/** A quantity or price without padding zeros: "10.000000" → "10", "410.2500" → "410.25". */
export function trimDecimal(s: string): string {
	return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
