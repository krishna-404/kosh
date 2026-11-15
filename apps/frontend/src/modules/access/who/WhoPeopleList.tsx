import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { IconChevronRight, IconClock } from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { RowItem, RowList } from "@connected-repo/ui-mui/kosh/RowItem";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { WHO } from "@frontend/copy/who.copy";
import { PersonAvatar } from "./PersonAvatar";
import { rowLines } from "./rowLines";
import {
	accountsSeenBy,
	allAccounts,
	levelCounts,
	type MatrixHolder,
	type MatrixPerson,
	nameOf,
} from "./who.utils";

/** The compact level sticker the phone list counts accounts with. */
const COUNT_BADGE = {
	height: 24,
	padding: "0 9px 0 7px",
	gap: "4px",
	fontSize: "0.6875rem",
	"& svg": { fontSize: 13 },
} as const;

interface WhoPeopleListProps {
	holders: MatrixHolder[];
	/** Everyone but the signed-in person, already filtered. */
	people: MatrixPerson[];
	unconfirmed: ReadonlySet<string>;
	onOpenPerson: (person: MatrixPerson) => void;
}

/**
 * "By person" on a phone: one list to scroll with a thumb. Each person says
 * how much of yours they see and at which levels; tapping opens the detail.
 */
export const WhoPeopleList = ({ holders, people, unconfirmed, onOpenPerson }: WhoPeopleListProps) => {
	const total = allAccounts(holders).length;
	return (
		<>
			<SectionCard padding="none" sx={{ overflow: "hidden" }}>
				<RowList sx={(theme) => rowLines(theme.vars.palette.kosh.line)}>
					{people.map((person) => {
						const seen = accountsSeenBy(person, holders, unconfirmed);
						const only = seen.length === 1 ? seen[0] : undefined;
						const summary = only
							? only.account.label
							: seen.length === total
								? WHO.allAccounts(total)
								: WHO.someAccounts(seen.length, total);
						return (
							<RowItem
								key={person.key}
								leading={<PersonAvatar person={person} size="md" />}
								primary={nameOf(person)}
								secondary={
									<>
										<Box sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</Box>
										<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
											{levelCounts(seen).map(({ level, count }) => (
												<LevelBadge key={level} level={level} label={String(count)} sx={COUNT_BADGE} />
											))}
											{person.pending && (
												<Tag tone="pending" icon={<IconClock />}>
													{WHO.invited}
												</Tag>
											)}
										</Box>
									</>
								}
								trailing={
									<Box
										aria-hidden
										sx={(theme) => ({ display: "flex", color: theme.vars.palette.kosh.ink3 })}
									>
										<IconChevronRight />
									</Box>
								}
								onClick={() => onOpenPerson(person)}
								sx={{ minHeight: 72, py: 1.5, px: 1.75 }}
							/>
						);
					})}
				</RowList>
			</SectionCard>
			<Typography variant="caption">{WHO.countsNote(total)}</Typography>
		</>
	);
};
