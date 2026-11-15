import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useId } from "react";
import type { DayGroup, Visible } from "../activity.utils";
import { ActivityEntry } from "./ActivityEntry";

interface ActivityFeedProps {
	days: readonly DayGroup[];
	/** Ids of invite entries still waiting for someone to sign in. */
	waiting: ReadonlySet<string>;
	/** What the person can see, for links and names; null when that is not known. */
	visible: Visible | null;
	/** A card per day (phone) rather than one card with a strip per day (desktop). */
	cards: boolean;
}

interface DayProps extends Omit<ActivityFeedProps, "days"> {
	day: DayGroup;
}

const Day = ({ day, waiting, visible, cards }: DayProps) => {
	const headingId = useId();
	const entries = (
		<Box
			component="ul"
			aria-labelledby={headingId}
			sx={(theme) => ({
				m: 0,
				p: 0,
				listStyle: "none",
				"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
			})}
		>
			{day.items.map((item) => (
				<ActivityEntry key={item.id} item={item} waiting={waiting.has(item.id)} visible={visible} />
			))}
		</Box>
	);
	const heading = (
		<Typography
			id={headingId}
			variant="eyebrow"
			component="h2"
			sx={(theme) =>
				cards
					? { m: 0, px: 0.5, pt: 0.5 }
					: { m: 0, px: 2.5, py: 1.25, bgcolor: theme.vars.palette.kosh.surface2 }
			}
		>
			{day.label}
		</Typography>
	);
	return cards ? (
		<Box component="section" sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
			{heading}
			<SectionCard padding="none" component="div" sx={{ overflow: "hidden" }}>
				{entries}
			</SectionCard>
		</Box>
	) : (
		<Box component="section">
			{heading}
			{entries}
		</Box>
	);
};

/** What happened, newest first, under day headings. Read-only by nature. */
export const ActivityFeed = ({ days, waiting, visible, cards }: ActivityFeedProps) => {
	const sections = days.map((day) => (
		<Day key={day.label} day={day} waiting={waiting} visible={visible} cards={cards} />
	));
	return cards ? (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>{sections}</Box>
	) : (
		<SectionCard padding="none" component="div" sx={{ overflow: "hidden" }}>
			{sections}
		</SectionCard>
	);
};
