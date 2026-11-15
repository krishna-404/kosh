import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { ButtonBase } from "@connected-repo/ui-mui/form/ButtonBase";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { formatPercent } from "@connected-repo/ui-mui/format/percent";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { DivergingBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconGroup } from "@connected-repo/ui-mui/kosh/icons";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import type { GroupsCompared as GroupsComparedData, Period } from "@connected-repo/zod-schemas/kosh/money.zod";
import { GROUP_KIND_LABEL } from "@frontend/copy/levels.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { ROUTES } from "@frontend/copy/nav.copy";
import { OVERVIEW } from "@frontend/copy/overview.copy";
import { Link as RouterLink } from "react-router";
import { EVERYTHING, scopeSearch } from "../scope";
import { type GroupRow, isRanked, largest, staleSx, topGroups } from "./overview.utils";

interface GroupsComparedProps {
	compared: GroupsComparedData | undefined;
	isPending: boolean;
	/** What to say when the comparison could not be loaded; null when it was. */
	failed: string | null;
	onRetry: () => void;
	/** These are still the figures of the period being left. */
	stale: boolean;
	period: Period;
	phone: boolean;
	/** Room for the "Kind" column. */
	wide: boolean;
}

const WORDS = OVERVIEW.groups;

/** The Overview narrowed to one group, over the same period. */
const groupPath = (group: GroupRow, period: Period): string =>
	`${ROUTES.overview}${scopeSearch({ kind: "group", id: group.groupId }, period)}`;

/** "+2.4 pts ahead" — or why there is no such figure. */
const Versus = ({ group }: { group: GroupRow }) => {
	if (group.shortHistory) return <>{WORDS.notEnoughHistory}</>;
	const points = group.aheadPoints;
	if (points === null) return <>—</>;
	return (
		<>
			<Percent value={points} sign="always" suffix=" pts" tone="auto" sx={{ fontWeight: 700 }} />{" "}
			{points < 0 ? MONEY.behind : MONEY.ahead}
		</>
	);
};

/**
 * "Your groups, compared": each group judged on its own money against
 * NIFTY, best first. A row opens the Overview for that group. Groups can
 * share accounts, so there is no total.
 */
export const GroupsCompared = ({
	compared,
	isPending,
	failed,
	onRetry,
	stale,
	period,
	phone,
	wide,
}: GroupsComparedProps) => {
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
	if (isPending || !compared) return <Skeleton variant="rounded" height={232} sx={{ borderRadius: 2.5 }} />;
	if (compared.groups.length === 0) return null;

	const rows = topGroups(compared.groups);
	const compareAll = (
		<Link
			component={RouterLink}
			to={`${ROUTES.groups}${scopeSearch(EVERYTHING, period)}`}
			variant="body2"
			sx={[{ flex: "none" }, phone && { display: "inline-flex", alignItems: "center", minHeight: 44, my: -1.5 }]}
		>
			{WORDS.compareAll}
		</Link>
	);

	if (phone) {
		const max = largest(rows.map((g) => (isRanked(g) ? g.aheadPoints : null)));
		return (
			<SectionCard padding="none" title={WORDS.title} action={compareAll} sx={staleSx(stale)}>
				<Box
					component="ul"
					sx={(theme) => ({
						listStyle: "none",
						m: 0,
						p: 0,
						"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
					})}
				>
					{rows.map((group) => {
						const ranked = isRanked(group);
						const line = [
							group.kind ? GROUP_KIND_LABEL[group.kind] : null,
							formatMoney(group.value, { notation: "compact" }),
							ranked && group.xirr !== null ? formatPercent(group.xirr) : null,
							group.shortHistory ? WORDS.notEnoughHistory : null,
						]
							.filter(Boolean)
							.join(" · ");
						return (
							<li key={group.groupId}>
								<ButtonBase
									component={RouterLink}
									to={groupPath(group, period)}
									sx={(theme) => ({
										display: "flex",
										alignItems: "center",
										gap: 1.25,
										width: "100%",
										minHeight: 60,
										px: 2.5,
										py: 1.25,
										textAlign: "left",
										"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
										"&.Mui-focusVisible": { outlineOffset: -2 },
									})}
								>
									<Box sx={{ flex: 1, minWidth: 0 }}>
										<Typography variant="subtitle2" component="div" noWrap>
											{group.name}
										</Typography>
										<Typography variant="caption" component="div" noWrap>
											{line}
										</Typography>
									</Box>
									{ranked && (
										<>
											<DivergingBar value={group.aheadPoints ?? 0} max={max} width={64} />
											<Percent
												value={group.aheadPoints}
												sign="always"
												suffix=" pts"
												tone="auto"
												sx={{
													flex: "none",
													minWidth: 64,
													textAlign: "right",
													fontWeight: 700,
													fontSize: "0.8125rem",
												}}
											/>
										</>
									)}
								</ButtonBase>
							</li>
						);
					})}
				</Box>
			</SectionCard>
		);
	}

	const grid = {
		display: "grid",
		gridTemplateColumns: wide
			? "minmax(0, 1fr) 130px 70px 176px 110px"
			: "minmax(0, 1fr) 110px 64px 176px",
		gap: 1.5,
		alignItems: "center",
		px: 2.5,
	};
	const right = { textAlign: "right" };

	return (
		<SectionCard padding="none" title={WORDS.title} action={compareAll} sx={staleSx(stale)}>
			<Box role="table" aria-label={WORDS.title}>
				<Box role="row" sx={[grid, { minHeight: 30 }]}>
					{[
						{ label: WORDS.colGroup },
						{ label: WORDS.colMoney, sx: right },
						{ label: WORDS.colReturn, sx: right },
						{ label: WORDS.colVs },
						...(wide ? [{ label: WORDS.colKind, sx: right }] : []),
					].map((column) => (
						<Typography
							key={column.label}
							role="columnheader"
							variant="caption"
							sx={[
								{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" },
								column.sx ?? {},
							]}
						>
							{column.label}
						</Typography>
					))}
				</Box>
				{rows.map((group) => (
					<Box
						role="row"
						key={group.groupId}
						sx={[
							grid,
							(theme) => ({
								position: "relative",
								minHeight: 50,
								py: 0.75,
								borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
								transition: theme.transitions.create("background-color", { duration: 200 }),
								"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
							}),
						]}
					>
						<Box role="cell" sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
							<IconGroup aria-hidden sx={(theme) => ({ color: theme.vars.palette.kosh.ink2 })} />
							<Box sx={{ minWidth: 0 }}>
								{/* The name is the link; it is stretched over the whole row. */}
								<Link
									component={RouterLink}
									to={groupPath(group, period)}
									variant="subtitle2"
									underline="none"
									noWrap
									sx={(theme) => ({
										display: "block",
										color: theme.vars.palette.kosh.ink,
										"&::after": { content: '""', position: "absolute", inset: 0 },
										"&:focus-visible": { outline: "none" },
										"&:focus-visible::after": {
											outline: `2px solid ${theme.vars.palette.kosh.accent}`,
											outlineOffset: -2,
										},
									})}
								>
									{group.name}
								</Link>
								<Typography variant="caption" component="div" noWrap>
									{MONEY.accounts(group.accounts)}
								</Typography>
							</Box>
						</Box>
						<Box role="cell" sx={right}>
							<Money value={group.value} sx={{ fontWeight: 700 }} />
						</Box>
						<Box role="cell" sx={right}>
							{/* Under a year of history a yearly rate would mislead, so none is shown. */}
							<Percent value={group.shortHistory ? null : group.xirr} sx={{ fontWeight: 700 }} />
						</Box>
						<Typography role="cell" variant="body2" component="div">
							<Versus group={group} />
						</Typography>
						{wide && (
							<Box role="cell" sx={right}>
								{group.kind && <Tag>{GROUP_KIND_LABEL[group.kind]}</Tag>}
							</Box>
						)}
					</Box>
				))}
			</Box>
		</SectionCard>
	);
};
