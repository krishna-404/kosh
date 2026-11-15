import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { formatMoney } from "@connected-repo/ui-mui/format/money";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { type BarColor, CompareBar } from "@connected-repo/ui-mui/kosh/Bars";
import { IconCheck, IconChevronDown, IconGroup } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import type { Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { GROUPS } from "@frontend/copy/groups.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useWhatIf } from "@frontend/modules/money/money.queries";
import { type ReactNode, useId, useState } from "react";
import { sharingWith, smallButAhead, type WhatIfLine, whatIfLines } from "../groups.utils";

interface WhatIfChoice {
	id: string;
	name: string;
	/** False while nothing is uploaded in its accounts: there is no money to follow. */
	hasFigures: boolean;
}

interface WhatIfCardProps {
	/** The person's groups, in the table's order. */
	choices: readonly WhatIfChoice[];
	/** The same groups with their accounts, to leave out the ones that share any. */
	groups: readonly Pick<Group, "id" | "name" | "accountIds">[];
	/** What each group is worth now. */
	worth: ReadonlyMap<string, number>;
	/** Narrow layout: compact amounts, the difference under the value. */
	phone: boolean;
}

/** The bar's colour says what kind of thing a row is; its label says which. */
const colorOf = (line: WhatIfLine): BarColor => {
	if (line.kind === "self") return "accent";
	if (line.kind === "group") return "alt";
	return line.id === "nifty50" ? "nifty" : line.id === "gold" ? "gold" : "neutral";
};

/**
 * "What if the money in [group] had followed another group?" — the group's
 * own deposits and withdrawals, earning what each other group and each
 * benchmark earned over the same days, beside what really happened.
 */
export const WhatIfCard = ({ choices, groups, worth, phone }: WhatIfCardProps) => {
	const menuId = useId();
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [picked, setPicked] = useState<string | null>(null);

	const available = choices.filter((choice) => choice.hasFigures);
	// The first group with figures, until the person picks — or when their pick is gone.
	const chosen = available.find((choice) => choice.id === picked) ?? available[0];
	const query = useWhatIf(chosen?.id ?? null, "all");
	if (!chosen) return null;

	// While another group's answer is still on its way, the last one is not shown under the new name.
	const data = query.data?.groupId === chosen.id ? query.data : undefined;
	const own = groups.find((group) => group.id === chosen.id);
	const leftOut = own ? sharingWith(own, groups) : [];
	const lines = data ? whatIfLines(data, new Set(leftOut.map((group) => group.id))) : [];
	const alone = choices.length === 1;

	const whyNot = (line: WhatIfLine): string => {
		if (line.kind === "benchmark") return GROUPS.whatIf.noPrices;
		const known = choices.find((choice) => choice.id === line.id);
		return known && !known.hasFigures ? GROUPS.whatIf.noFiguresYet : GROUPS.whatIf.startedLater;
	};
	const startedLater = lines.filter(
		(line) => line.value === null && whyNot(line) === GROUPS.whatIf.startedLater,
	);

	const small = data ? smallButAhead(lines, Number(data.value), worth) : null;
	const smallWorth = small ? worth.get(small.id) : undefined;
	const caution =
		small && smallWorth !== undefined && data
			? GROUPS.whatIf.cautionSmaller(
					small.name,
					formatMoney(smallWorth, { notation: "compact" }),
					chosen.name,
					formatMoney(data.value, { notation: "compact" }),
				)
			: GROUPS.whatIf.caution;

	const notation = phone ? "compact" : "full";
	const figure = (line: WhatIfLine): ReactNode => {
		const value =
			line.value === null ? "—" : <Money value={line.value} notation={notation} />;
		const second =
			line.kind === "self" ? (
				GROUPS.whatIf.happened
			) : line.difference === null ? (
				whyNot(line)
			) : (
				<Money value={line.difference} notation={notation} sign="always" tone="auto" />
			);
		return (
			// The same widths on every row, so the bars start and end together.
			<Box
				component="span"
				sx={{
					display: "inline-grid",
					gridTemplateColumns: phone ? "92px" : "112px 104px",
					columnGap: 1.5,
					alignItems: "baseline",
					textAlign: "right",
				}}
			>
				<span>{value}</span>
				<Typography variant="caption" component="span" noWrap sx={{ fontWeight: 500 }}>
					{second}
				</Typography>
			</Box>
		);
	};

	return (
		<SectionCard>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
				<Typography
					variant={phone ? "h3" : "h2"}
					component="h2"
					sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px" }}
				>
					<span>{GROUPS.whatIf.lead}</span>
					{available.length > 1 ? (
						<Button
							variant="outlined"
							startIcon={<IconGroup />}
							endIcon={<IconChevronDown />}
							aria-haspopup="menu"
							aria-controls={anchor ? menuId : undefined}
							aria-expanded={anchor ? true : undefined}
							// Named by the group alone, so the heading reads as one sentence.
							title={GROUPS.whatIf.pick}
							onClick={(event) => setAnchor(event.currentTarget)}
							sx={{ maxWidth: "100%", minHeight: 40 }}
						>
							<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								{chosen.name}
							</Box>
						</Button>
					) : (
						<span>{chosen.name}</span>
					)}
					<span>{alone ? GROUPS.whatIf.tailAlone : GROUPS.whatIf.tail}</span>
				</Typography>

				<Typography variant="body2" sx={{ mt: -0.5, maxWidth: 760 }}>
					{alone ? GROUPS.whatIf.explainAlone(chosen.name) : GROUPS.whatIf.explain(chosen.name)}{" "}
					{alone
						? GROUPS.whatIf.onlyGroup
						: leftOut.length > 0 &&
							GROUPS.whatIf.leftOut(
								leftOut.map((group) => group.name),
								chosen.name,
							)}
				</Typography>

				{query.isError && !data ? (
					<Banner
						tone="bad"
						action={
							<Button variant="outlined" onClick={() => void query.refetch()}>
								{GROUPS.retry}
							</Button>
						}
					>
						{errorWords(query.error, GROUPS.whatIf.failed)}
					</Banner>
				) : !data ? (
					<Box aria-busy sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						{[0, 1, 2].map((row) => (
							<Skeleton key={row} variant="rounded" height={20} />
						))}
					</Box>
				) : (
					<>
						<Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
							{lines.map((line) => (
								<CompareBar
									key={line.id}
									label={line.name}
									value={line.share}
									color={colorOf(line)}
									emphasis={line.kind === "self"}
									figure={figure(line)}
								/>
							))}
						</Box>
						{startedLater.length > 0 && (
							<Typography variant="caption">
								{GROUPS.whatIf.startedLaterNote(
									startedLater.map((line) => line.name),
									chosen.name,
								)}
							</Typography>
						)}
						<Banner sx={{ mt: 0.5 }}>{caution}</Banner>
					</>
				)}
			</Box>

			<Menu
				id={menuId}
				anchorEl={anchor}
				open={anchor !== null}
				onClose={() => setAnchor(null)}
				slotProps={{ paper: { sx: { minWidth: 240, maxWidth: 360, maxHeight: "70vh" } } }}
			>
				{choices.map((choice) => {
					const on = choice.id === chosen.id;
					return (
						<MenuItem
							key={choice.id}
							role="menuitemradio"
							aria-checked={on}
							selected={on}
							// Listed, so it is clear why it cannot be picked: there is no money in it to follow yet.
							disabled={!choice.hasFigures}
							onClick={() => {
								setPicked(choice.id);
								setAnchor(null);
							}}
						>
							<Box component="span" sx={{ flex: 1, minWidth: 0 }}>
								<Box component="span" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
									{choice.name}
								</Box>
								{!choice.hasFigures && (
									<Typography component="span" variant="caption" sx={{ display: "block" }}>
										{GROUPS.whatIf.nothingYet}
									</Typography>
								)}
							</Box>
							{/* The tick, not only the tint, says which one is chosen. */}
							<IconCheck fontSize="small" aria-hidden sx={{ visibility: on ? "visible" : "hidden" }} />
						</MenuItem>
					);
				})}
			</Menu>
		</SectionCard>
	);
};
