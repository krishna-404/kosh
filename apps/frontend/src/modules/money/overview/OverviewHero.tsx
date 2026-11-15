import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatDate, formatMonth } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconInfo } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { HeroCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Returns } from "@connected-repo/zod-schemas/kosh/money.zod";
import { MONEY } from "@frontend/copy/money.copy";
import { OVERVIEW } from "@frontend/copy/overview.copy";
import { FeeEffectNote } from "@frontend/modules/money/components/FeeEffectNote";
import { Fragment, type ReactNode } from "react";
import {
	aheadSentence,
	hasFigure,
	isMixed,
	primaryBenchmark,
	shortName,
	standingOf,
	standingTone,
} from "./overview.utils";

interface OverviewHeroProps {
	returns: Returns;
	/** How many people the accounts belong to; null while the directory is not in. */
	people: number | null;
	/** What is being looked at ("Everything you can see") — the phone's line above the value. */
	scopeLabel: string;
	phone: boolean;
	/** Room for the four parts side by side, as on the board. */
	wide: boolean;
}

/**
 * The gain colour is lime on the deep-green card; a loss stays in the card's
 * own ink, because the loss red is not readable there — its minus sign says it.
 */
const toneOf = (rate: number | null) => (rate !== null && rate > 0 ? "pos" : "plain");

/**
 * The headline: what it is all worth, how it has done a year, and what the
 * same money would have done in NIFTY — then, in rupees, how far ahead or
 * behind that leaves it. Under a year of history the yearly rate would
 * mislead, so the growth so far is shown instead and named as such.
 */
export const OverviewHero = ({ returns, people, scopeLabel, phone, wide }: OverviewHeroProps) => {
	const short = returns.flags.shortWindow;
	const rate = short ? returns.growth : returns.xirr;
	const primary = primaryBenchmark(returns.benchmarks);
	const primaryOk = primary !== null && hasFigure(primary);
	const standings = returns.benchmarks.map((b) => standingOf(b, returns.flags.pricesLoading));
	// Each run of the sentence, keyed by where it starts.
	let at = 0;
	const sentence = aheadSentence(standings).map((segment) => {
		const key = at;
		at += segment.text.length;
		return { ...segment, key };
	});

	const banner = sentence.length > 0 && (
		<Banner
			tone={standingTone(standings)}
			// Being behind a benchmark is a result to read, not an error to be interrupted with.
			calm
			// A tick (or a warning) would overstate a mixed result.
			icon={isMixed(standings) ? <IconInfo fontSize="inherit" /> : undefined}
			sx={{ alignItems: "center", py: 1.25 }}
		>
			{sentence.map((segment) =>
				segment.strong ? (
					<Typography key={segment.key} component="b" variant="numeric" sx={{ fontWeight: 700 }}>
						{segment.text}
					</Typography>
				) : (
					<Fragment key={segment.key}>{segment.text}</Fragment>
				),
			)}
		</Banner>
	);

	/** Why the primary benchmark has no figure, in a few words. */
	const primaryWhy =
		primary?.availableFrom != null ? OVERVIEW.pricesStart(formatDate(primary.availableFrom)) : OVERVIEW.notWorkedOut;

	if (phone) {
		let benchmarkPart: ReactNode = null;
		if (primary) {
			benchmarkPart = (
				<>
					{" · "}
					{OVERVIEW.onSameMoney(shortName(primary))}{" "}
					{short ? (
						<Money value={primaryOk ? primary.value : null} />
					) : (
						<Percent value={primaryOk ? primary.xirr : null} />
					)}
				</>
			);
		}
		return (
			<>
				<HeroCard>
					<Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
						{scopeLabel}
					</Typography>
					<Money value={returns.value} figure sx={{ display: "block", mt: 0.25 }} />
					<Typography variant="body2" component="div" sx={{ mt: 0.5 }}>
						<Percent value={rate} tone={toneOf(rate)} sx={{ fontWeight: 700 }} />{" "}
						{rate === null ? OVERVIEW.notWorkedOut : short ? OVERVIEW.growthLower : MONEY.aYear}
						{benchmarkPart}
					</Typography>
					<FeeEffectNote fees={returns.fees} form="short" />
				</HeroCard>
				{banner}
			</>
		);
	}

	const line = [
		MONEY.accounts(returns.scope.accounts),
		people ? OVERVIEW.people(people) : null,
		OVERVIEW.sinceMonth(formatMonth(returns.window.from)),
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<HeroCard
			sx={{
				display: "grid",
				// The value keeps its full width; the banner drops to its own row when four will not fit.
				gridTemplateColumns: wide
					? "minmax(max-content, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)"
					: "repeat(3, minmax(0, auto))",
				gap: 2.5,
				alignItems: "end",
			}}
		>
			<Stat size="lg" label={OVERVIEW.valueToday} value={<Money value={returns.value} figure />} hint={line} />
			<Stat
				label={short ? OVERVIEW.growthSoFar : OVERVIEW.yourReturn}
				value={<Percent value={rate} tone={toneOf(rate)} />}
				hint={
					<>
						{rate === null ? OVERVIEW.notWorkedOut : short ? OVERVIEW.notYearly : MONEY.aYear}
						<FeeEffectNote fees={returns.fees} form="short" />
					</>
				}
			/>
			{primary && (
				<Stat
					label={MONEY.sameMoneyIn(primary.name)}
					value={
						short ? (
							<Money value={primaryOk ? primary.value : null} />
						) : (
							<Percent value={primaryOk ? primary.xirr : null} />
						)
					}
					hint={
						!primaryOk ? (
							primaryWhy
						) : short ? (
							OVERVIEW.today
						) : (
							<>
								{MONEY.wouldBe} <Money value={primary.value} />
							</>
						)
					}
				/>
			)}
			{banner && <Box sx={wide ? undefined : { gridColumn: "1 / -1" }}>{banner}</Box>}
		</HeroCard>
	);
};
