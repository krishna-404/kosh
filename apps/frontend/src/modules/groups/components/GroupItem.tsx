import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { IconMore } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { GROUPS } from "@frontend/copy/groups.copy";
import { GroupTile } from "./GroupTile";

interface GroupItemProps {
	name: string;
	/** Its place among the person's groups, oldest first — picks the tile's colour. */
	tile: number;
	/** "Family", "Fund manager"… — only when the group has a kind. */
	kindLabel: string | null;
	/** The labels of the accounts in it that the person can still see. */
	memberLabels: readonly string[];
	/**
	 * What the group is worth. Left `undefined` while no account has a value,
	 * so the figure is not on the page at all; null when only this group has none.
	 */
	total?: number | null;
	/** A card of its own (phone) rather than a row of the list (desktop). */
	card: boolean;
	onMore: (anchor: HTMLElement) => void;
}

/**
 * One saved group without its comparison: its name, its kind, what is in it.
 * Shown while there is nothing to compare — no statement in any group's
 * accounts yet, or the figures did not load — so the groups can still be
 * changed. A row of one list on desktop, a card of its own on a phone.
 */
export const GroupItem = ({
	name,
	tile,
	kindLabel,
	memberLabels,
	total,
	card,
	onMore,
}: GroupItemProps) => {
	const count = GROUPS.accountsCount(memberLabels.length);
	const empty = memberLabels.length === 0;
	const members = empty ? GROUPS.noMembers : GROUPS.membersLine(memberLabels);

	const icon = <GroupTile index={tile} />;
	const title = (
		<Typography variant="subtitle2" component="h2" noWrap sx={{ minWidth: 0 }}>
			{name}
		</Typography>
	);
	const kind = kindLabel && <Tag>{kindLabel}</Tag>;
	const more = (
		<IconButton
			aria-label={GROUPS.more(name)}
			aria-haspopup="menu"
			onClick={(event) => onMore(event.currentTarget)}
			sx={{ mr: -1 }}
		>
			<IconMore />
		</IconButton>
	);

	if (card)
		return (
			<SectionCard component="li" sx={{ listStyle: "none" }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1.25, my: -0.5 }}>
					{icon}
					<Box sx={{ flex: 1, minWidth: 0 }}>{title}</Box>
					{kind}
					{more}
				</Box>
				{/* A headline figure only when there is one: an empty group has no dash for a headline. */}
				{typeof total === "number" && (
					<Money value={total} figure sx={{ display: "block", mt: 1.5, fontSize: "1.5rem" }} />
				)}
				<Typography
					variant="caption"
					component="p"
					sx={(theme) => ({ m: 0, mt: 1.25, color: theme.vars.palette.kosh.ink2 })}
				>
					{empty ? (
						members
					) : (
						<>
							<b>{count}</b>
							{" — "}
							{members}
						</>
					)}
				</Typography>
			</SectionCard>
		);

	return (
		<Box
			component="li"
			sx={{ display: "flex", alignItems: "center", gap: 1.75, minHeight: 68, px: 2.5, py: 1.25 }}
		>
			{icon}
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					{title}
					{kind}
				</Box>
				<Typography variant="caption" component="p" sx={{ m: 0, mt: 0.25 }}>
					{members}
				</Typography>
			</Box>
			{!empty && (
				<Typography variant="body2" noWrap sx={{ flex: "none" }}>
					{count}
				</Typography>
			)}
			{total !== undefined && (
				<Money value={total} sx={{ flex: "none", minWidth: 120, textAlign: "right", fontWeight: 700 }} />
			)}
			{more}
		</Box>
	);
};
