import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { KoshTheme } from "@connected-repo/ui-mui/theme/ThemeProvider";
import { HOLDINGS, KIND_LABEL } from "@frontend/copy/holdings.copy";
import { type AssetClass, type MakeUpPart, shareWords } from "./holdings.utils";

/** A kind keeps its colour whatever else is held; the catch-all is neutral. */
const kindColor = (theme: KoshTheme, kind: AssetClass): string => {
	const k = theme.vars.palette.kosh;
	return { stocks: k.seriesYou, funds: k.seriesNifty, gold: k.seriesGold, bonds: k.seriesAlt, other: k.ink3 }[kind];
};

interface MakeUpCardProps {
	/** The kinds held, in their fixed order (see `makeUp`). */
	parts: readonly MakeUpPart[];
}

/**
 * What the holdings are made of: one bar split by kind of asset, and under
 * it each kind's name, share and value. The names and figures carry the
 * meaning; the colours only tie a row to its piece of the bar.
 */
export const MakeUpCard = ({ parts }: MakeUpCardProps) => {
	if (parts.length === 0) return null;
	const named = parts.map((part) => HOLDINGS.kindShare(KIND_LABEL[part.assetClass], shareWords(part.share)));
	return (
		<SectionCard padding="none" sx={{ overflow: "hidden" }}>
			<Typography component="h2" sx={srOnly}>
				{HOLDINGS.makeUpTitle}
			</Typography>
			<Box
				role="img"
				aria-label={HOLDINGS.makeUpSummary(named)}
				sx={(theme) => ({
					display: "flex",
					gap: "2px",
					height: 14,
					// The gap between pieces is the card showing through, not a line drawn round them.
					bgcolor: theme.vars.palette.kosh.surface,
				})}
			>
				{parts.map((part, index) => (
					<Box
						key={part.assetClass}
						title={`${named[index]} · ${formatMoney(part.value)}`}
						sx={(theme) => ({
							flex: `${part.share} 1 0`,
							minWidth: 3,
							bgcolor: kindColor(theme, part.assetClass),
						})}
					/>
				))}
			</Box>
			<Box
				component="ul"
				sx={(theme) => ({
					listStyle: "none",
					m: 0,
					p: 0,
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: `repeat(${parts.length}, minmax(0, 1fr))` },
					"& > li + li": {
						borderTop: { xs: `1px solid ${theme.vars.palette.kosh.line}`, md: 0 },
						borderLeft: { xs: 0, md: `1px solid ${theme.vars.palette.kosh.line}` },
					},
				})}
			>
				{parts.map((part, index) => (
					<Box
						component="li"
						key={part.assetClass}
						sx={{
							display: "flex",
							flexDirection: { xs: "row", md: "column" },
							alignItems: { xs: "center", md: "flex-start" },
							justifyContent: "space-between",
							gap: { xs: 1.5, md: 0.5 },
							px: 2,
							py: { xs: 1.25, md: 1.75 },
						}}
					>
						<Typography
							variant="caption"
							component="span"
							sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary", fontWeight: 600 }}
						>
							<Box
								aria-hidden
								sx={(theme) => ({
									width: 10,
									height: 10,
									flex: "none",
									borderRadius: "3px",
									bgcolor: kindColor(theme, part.assetClass),
								})}
							/>
							{named[index]}
						</Typography>
						<Money value={part.value} sx={{ fontSize: { xs: "0.9375rem", md: "1.125rem" }, fontWeight: 700 }} />
					</Box>
				))}
			</Box>
		</SectionCard>
	);
};

/** Read out, not shown. */
const srOnly = {
	position: "absolute",
	width: "1px",
	height: "1px",
	overflow: "hidden",
	clipPath: "inset(50%)",
	whiteSpace: "nowrap",
} as const;
