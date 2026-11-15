import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { type Amount, formatMoney, type MoneyOptions, toNumber } from "../format/money";
import { formatPercent, type PercentOptions } from "../format/percent";

/** `auto` colours by sign (gain / loss); `plain` keeps the surrounding colour. */
export type FigureTone = "plain" | "auto" | "pos" | "neg";

const toneColor = (tone: FigureTone, n: number) => (theme: Theme) => {
	const k = theme.vars.palette.kosh;
	if (tone === "pos") return k.pos;
	if (tone === "neg") return k.neg;
	if (tone === "auto" && n > 0) return k.pos;
	if (tone === "auto" && n < 0) return k.neg;
	return "inherit";
};

interface FigureBaseProps {
	tone?: FigureTone;
	/** Render as the big headline figure instead of inline. */
	figure?: boolean;
	/** Shown when there is no value yet. */
	placeholder?: string;
	sx?: SxProps<Theme>;
}

interface MoneyProps extends FigureBaseProps, MoneyOptions {
	value: Amount | null | undefined;
}

/** An amount in rupees — always tabular, always grouped the Indian way. */
export const Money = ({
	value,
	tone = "plain",
	figure = false,
	placeholder = "—",
	sx,
	...format
}: MoneyProps) => {
	const missing = value === null || value === undefined;
	const n = missing ? 0 : toNumber(value);
	return (
		<Typography
			component="span"
			variant={figure ? "figure" : "numeric"}
			sx={[
				(theme) => ({ color: toneColor(tone, n)(theme), whiteSpace: "nowrap" }),
				...(Array.isArray(sx) ? sx : [sx]),
			]}
		>
			{missing ? placeholder : formatMoney(value, format)}
		</Typography>
	);
};

interface PercentProps extends FigureBaseProps, PercentOptions {
	/** A fraction: 0.142 is 14.2%. */
	value: Amount | null | undefined;
}

/** A rate or a difference between rates. */
export const Percent = ({
	value,
	tone = "plain",
	figure = false,
	placeholder = "—",
	sx,
	...format
}: PercentProps) => {
	const missing = value === null || value === undefined;
	const n = missing ? 0 : toNumber(value);
	return (
		<Typography
			component="span"
			variant={figure ? "figure" : "numeric"}
			sx={[
				(theme) => ({ color: toneColor(tone, n)(theme), whiteSpace: "nowrap" }),
				...(Array.isArray(sx) ? sx : [sx]),
			]}
		>
			{missing ? placeholder : formatPercent(value, format)}
		</Typography>
	);
};
