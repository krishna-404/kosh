import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { ButtonBase } from "@connected-repo/ui-mui/form/ButtonBase";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { DivergingBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconAlert, IconTrend } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import type { Holding, Holdings } from "@connected-repo/zod-schemas/kosh/money.zod";
import { MONEY } from "@frontend/copy/money.copy";
import { ROUTES, scriptPath } from "@frontend/copy/nav.copy";
import { OVERVIEW } from "@frontend/copy/overview.copy";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { heldInLine, largest, type Movers, pointsOf, staleSx, topMovers } from "./overview.utils";

interface ScriptListsProps {
	holdings: Holdings | undefined;
	isPending: boolean;
	/** What to say when the scripts could not be loaded; null when they were. */
	failed: string | null;
	onRetry: () => void;
	/** These are still the scripts of the selection being left. */
	stale: boolean;
	/** The scope and period, as a query string, carried to Holdings and to a script. */
	search: string;
	phone: boolean;
	/** Room for the two cards side by side. */
	wide: boolean;
}

const WORDS = OVERVIEW.scripts;

/** What a list says when it has no rows — never "every script did better" unless every one did. */
const emptyWords = (side: "ahead" | "behind", movers: Movers): { title: string; body?: string } => {
	if (movers.aheadCount + movers.behindCount === 0 && movers.uncompared > 0) return { title: WORDS.noneCompared };
	const title = side === "behind" ? WORDS.nothingBehind : WORDS.nothingAhead;
	const others = side === "behind" ? movers.aheadCount : movers.behindCount;
	if (others === movers.total)
		return { title, body: side === "behind" ? WORDS.nothingBehindAll : WORDS.nothingAheadAll };
	return { title, body: movers.uncompared > 0 ? WORDS.notCompared(movers.uncompared) : undefined };
};

const Nothing = ({ side, movers }: { side: "ahead" | "behind"; movers: Movers }) => {
	const words = emptyWords(side, movers);
	return (
		<Box sx={{ px: 2.5, pt: 0.5, pb: 2.5 }}>
			<Typography variant="subtitle2">{words.title}</Typography>
			{words.body && <Typography variant="body2">{words.body}</Typography>}
		</Box>
	);
};

const Rows = ({ children }: { children: ReactNode }) => (
	<Box
		component="ul"
		sx={(theme) => ({
			listStyle: "none",
			m: 0,
			p: 0,
			"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
		})}
	>
		{children}
	</Box>
);

interface ScriptRowProps {
	holding: Holding;
	/** The largest gap in points among the rows shown: the longest bar. */
	max: number;
	search: string;
	phone: boolean;
}

/** One script: where it is held, how far ahead or behind NIFTY a year, and what that came to in rupees. */
const ScriptRow = ({ holding, max, search, phone }: ScriptRowProps) => {
	const points = pointsOf(holding);
	const heldIn = heldInLine(
		holding.heldIn.map((h) => h.label),
		phone ? 1 : 2,
	);
	return (
		<li>
			<ButtonBase
				component={RouterLink}
				to={`${scriptPath(holding.instrumentId)}${search}`}
				sx={(theme) => ({
					display: phone ? "flex" : "grid",
					gridTemplateColumns: "minmax(0, 1fr) 110px 86px 96px",
					alignItems: "center",
					gap: phone ? 1.25 : 1.5,
					width: "100%",
					minHeight: phone ? 60 : 52,
					px: 2.5,
					py: phone ? 1.25 : 0.75,
					textAlign: "left",
					transition: theme.transitions.create("background-color", { duration: 200 }),
					"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
					"&.Mui-focusVisible": { outlineOffset: -2 },
				})}
			>
				{/* A long name or two accounts take a second line rather than being cut short. */}
				<Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
					<Typography variant="subtitle2" component="div">
						{holding.name}
					</Typography>
					{heldIn && (
						<Typography variant="caption" component="div">
							{heldIn}
						</Typography>
					)}
				</Box>
				<DivergingBar value={points ?? 0} max={max} width={phone ? 64 : 110} />
				{phone ? (
					<Percent
						value={points}
						sign="always"
						suffix=" pts"
						tone="auto"
						sx={{ flex: "none", minWidth: 64, textAlign: "right", fontWeight: 700, fontSize: "0.8125rem" }}
					/>
				) : (
					<>
						<Percent value={points} sign="always" suffix=" pts" sx={{ textAlign: "right", fontWeight: 700 }} />
						<Money
							value={holding.effect}
							sign="always"
							sx={(theme) => ({
								textAlign: "right",
								fontSize: "0.8125rem",
								color: theme.vars.palette.kosh.ink2,
							})}
						/>
					</>
				)}
			</ButtonBase>
		</li>
	);
};

const Title = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
	<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
		{icon}
		{children}
	</Box>
);

/**
 * The scripts that did most, in rupees, against the same money in NIFTY:
 * the three furthest ahead and the three furthest behind. On a phone only
 * the ones behind are listed — "Needs a look".
 */
export const ScriptLists = ({ holdings, isPending, failed, onRetry, stale, search, phone, wide }: ScriptListsProps) => {
	if (failed)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={onRetry}>
						{MONEY.retry}
					</Button>
				}
			>
				{failed}
			</Banner>
		);

	const columns = { display: "grid", gridTemplateColumns: wide ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 2.25 };

	if (isPending || !holdings)
		return phone ? (
			<Skeleton variant="rounded" height={232} sx={{ borderRadius: 2.5 }} />
		) : (
			<Box sx={columns}>
				<Skeleton variant="rounded" height={214} sx={{ borderRadius: 2.5 }} />
				<Skeleton variant="rounded" height={214} sx={{ borderRadius: 2.5 }} />
			</Box>
		);

	// Nothing held now (everything sold, or cash only): there is nothing to list.
	if (holdings.holdings.length === 0) return null;

	const movers = topMovers(holdings.holdings);
	const max = largest([...movers.ahead, ...movers.behind].map(pointsOf));
	const all = (
		<Link
			component={RouterLink}
			to={`${ROUTES.holdings}${search}`}
			variant={phone ? "body2" : "caption"}
			sx={[{ flex: "none" }, phone && { display: "inline-flex", alignItems: "center", minHeight: 44, my: -1.5 }]}
		>
			{WORDS.all(movers.total)}
		</Link>
	);
	const list = (side: "ahead" | "behind") =>
		movers[side].length > 0 ? (
			<Rows>
				{movers[side].map((holding) => (
					<ScriptRow key={holding.instrumentId} holding={holding} max={max} search={search} phone={phone} />
				))}
			</Rows>
		) : (
			<Nothing side={side} movers={movers} />
		);

	if (phone)
		return (
			<SectionCard
				padding="none"
				title={WORDS.needsALook}
				subtitle={WORDS.behindTitle}
				action={all}
				sx={staleSx(stale)}
			>
				{list("behind")}
			</SectionCard>
		);

	return (
		<Box aria-busy={stale} sx={[columns, staleSx(stale)]}>
			<SectionCard
				padding="none"
				title={
					<Title
						icon={
							<IconTrend
								aria-hidden
								fontSize="small"
								sx={(theme) => ({ color: theme.vars.palette.kosh.pos })}
							/>
						}
					>
						{WORDS.aheadTitle}
					</Title>
				}
				action={
					<Typography variant="caption" sx={{ flex: "none" }}>
						{WORDS.sameMoney}
					</Typography>
				}
			>
				{list("ahead")}
			</SectionCard>
			<SectionCard
				padding="none"
				title={
					<Title
						icon={
							<IconAlert
								aria-hidden
								fontSize="small"
								sx={(theme) => ({ color: theme.vars.palette.kosh.dangerText })}
							/>
						}
					>
						{WORDS.behindTitle}
					</Title>
				}
				action={all}
			>
				{list("behind")}
			</SectionCard>
		</Box>
	);
};
