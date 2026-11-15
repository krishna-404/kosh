import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { formatTime } from "@connected-repo/ui-mui/format/date";
import {
	IconAccounts,
	IconAddPerson,
	IconAlert,
	IconCheck,
	IconClock,
	IconClose,
	IconEdit,
	IconHolderWide,
	IconInbox,
	IconLeave,
	IconOwner,
	IconPerson,
	IconRemovePerson,
	IconSend,
	IconShare,
	IconShield,
	IconUndo,
	IconUpload,
} from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { ActivityItem, ActivityKind } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ACTIVITY, ACTIVITY_SENTENCE, type SentencePart } from "@frontend/copy/activity.copy";
import { accountPath } from "@frontend/copy/nav.copy";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Visible } from "../activity.utils";

type Target = NonNullable<ActivityItem["target"]>;

const KIND_ICON: Record<ActivityKind, typeof IconUpload> = {
	holder_added: IconPerson,
	account_added: IconAccounts,
	invited: IconAddPerson,
	access_given: IconShare,
	level_changed: IconOwner,
	invite_accepted: IconCheck,
	invite_cancelled: IconClose,
	invite_expired: IconClock,
	invite_resent: IconSend,
	invite_reported_wrong: IconAlert,
	owner_confirmed: IconShield,
	removed: IconRemovePerson,
	left: IconLeave,
	upload: IconUpload,
	undo: IconUndo,
	answer: IconEdit,
};

/** The small neutral tile that says what kind of thing happened. */
const KindTile = ({ item }: { item: ActivityItem }) => {
	// Something shared with you arrives; something you shared goes out.
	const Icon = item.kind === "access_given" && item.subject?.isMe ? IconInbox : KIND_ICON[item.kind];
	return (
		<Box
			aria-hidden
			sx={(theme) => ({
				width: 36,
				height: 36,
				flex: "none",
				display: "grid",
				placeItems: "center",
				borderRadius: "10px",
				bgcolor: theme.vars.palette.kosh.surface2,
				color: theme.vars.palette.kosh.ink2,
				"& svg": { fontSize: 18 },
			})}
		>
			<Icon />
		</Box>
	);
};

/** A way to an account's page from inside a sentence or a chip, with a finger-sized target. */
const reach = {
	position: "relative",
	"&::after": { content: '""', position: "absolute", inset: "-11px -6px" },
} as const;

/** Where it happened, under the sentence: an account, or all of a holder's accounts. */
const TargetChip = ({ target, visible }: { target: Target; visible: Visible | null }) => {
	const isAccount = target.kind === "account";
	const canOpen = isAccount && visible !== null && visible.accounts.has(target.id);
	const hiddenHolder = !isAccount && visible !== null && !visible.holders.has(target.id);
	const chip = (
		<Box
			component="span"
			data-chip
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				return {
					display: "inline-flex",
					alignItems: "center",
					gap: "5px",
					minWidth: 0,
					maxWidth: "100%",
					padding: "2px 7px",
					border: `1px solid ${k.line}`,
					borderRadius: "7px",
					color: k.ink2,
					fontSize: "0.75rem",
					fontWeight: 600,
					lineHeight: 1.4,
					transition: theme.transitions.create(["border-color", "color"], { duration: 200 }),
					"& svg": { fontSize: 14, flex: "none" },
				};
			}}
		>
			{isAccount ? <IconAccounts aria-hidden /> : <IconHolderWide aria-hidden />}
			<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
				{isAccount
					? target.label
					: hiddenHolder
						? ACTIVITY.hiddenHolderTarget
						: ACTIVITY.holderTarget(target.label)}
			</Box>
		</Box>
	);
	if (!canOpen) return chip;
	return (
		<Box
			component={Link}
			to={accountPath(target.id)}
			aria-label={ACTIVITY.openAccount(target.label)}
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				return {
					...reach,
					display: "inline-flex",
					minWidth: 0,
					maxWidth: "100%",
					borderRadius: "7px",
					textDecoration: "none",
					"&:hover [data-chip]": { borderColor: k.ink3, color: k.ink },
					"&:focus-visible": { outline: `2px solid ${k.accent}`, outlineOffset: 2 },
				};
			}}
		>
			{chip}
		</Box>
	);
};

/** Draws one piece of a sentence: words, a bold name, a way to an account, a level, a tag. */
const renderPart = (part: SentencePart, index: number, visible: Visible | null): ReactNode => {
	if (typeof part === "string") return part;
	if ("strong" in part) return <b key={index}>{part.strong}</b>;
	if ("account" in part) {
		// Not (or no longer) theirs to see: the server sends no name, so none is shown.
		if (visible !== null && !visible.accounts.has(part.account.id)) return ACTIVITY.hiddenAccount;
		if (visible === null) return <b key={index}>{part.account.label}</b>;
		return (
			<Box
				key={index}
				component={Link}
				to={accountPath(part.account.id)}
				sx={(theme) => {
					const k = theme.vars.palette.kosh;
					return {
						...reach,
						color: "inherit",
						fontWeight: 700,
						textDecoration: "underline",
						textDecorationColor: k.line2,
						textDecorationThickness: "1.5px",
						textUnderlineOffset: "3px",
						"&:hover": { textDecorationColor: k.ink },
						"&:focus-visible": { outline: `2px solid ${k.accent}`, outlineOffset: 2, borderRadius: "4px" },
					};
				}}
			>
				{part.account.label}
			</Box>
		);
	}
	if ("holder" in part) {
		const hidden = visible !== null && !visible.holders.has(part.holder.id);
		if (part.form === "name") return hidden ? ACTIVITY.hiddenHolder : <b key={index}>{part.holder.label}</b>;
		return hidden ? ACTIVITY.hiddenHolderAccounts : <b key={index}>{ACTIVITY.allOf(part.holder.label)}</b>;
	}
	if ("level" in part)
		return (
			// The word before a level ("—", "from", "to") never parts from its badge.
			<Box key={index} component="span" sx={{ whiteSpace: "nowrap" }}>
				{part.lead}
				<LevelBadge level={part.level} sx={{ height: 24, verticalAlign: "middle", my: "2px" }} />
			</Box>
		);
	return (
		<Tag key={index} tone="pending" icon={<IconClock aria-hidden />} sx={{ verticalAlign: "middle" }}>
			{ACTIVITY.notSignedInYet}
		</Tag>
	);
};

interface ActivityEntryProps {
	item: ActivityItem;
	/** An invite nobody has signed in with yet (see `waitingInvites`). */
	waiting: boolean;
	/** What the person can see, for links and names; null when that is not known. */
	visible: Visible | null;
}

/**
 * One thing that happened: when, what kind, a sentence, and where. On
 * desktop the time has its own column; on a phone it follows the target on a
 * second line.
 */
export const ActivityEntry = ({ item, waiting, visible }: ActivityEntryProps) => {
	const sentence = ACTIVITY_SENTENCE[item.kind](item, { waiting });
	const time = formatTime(item.at);
	const stamp = new Date(item.at).toISOString();
	const chip = item.target && !sentence.namesTarget && (
		<TargetChip target={item.target} visible={visible} />
	);

	return (
		<Box
			component="li"
			sx={{
				display: "grid",
				gridTemplateColumns: { xs: "36px minmax(0, 1fr)", md: "56px 36px minmax(0, 1fr)" },
				columnGap: 1.5,
				alignItems: "start",
				minHeight: { xs: 64, md: 0 },
				px: { xs: 1.75, md: 2.5 },
				py: 1.5,
			}}
		>
			<Typography
				component="time"
				dateTime={stamp}
				variant="numeric"
				sx={(theme) => ({
					display: { xs: "none", md: "block" },
					pt: "9px",
					fontSize: "0.75rem",
					color: theme.vars.palette.kosh.ink3,
				})}
			>
				{time}
			</Typography>
			<KindTile item={item} />
			{/* A one-line sentence sits level with the tile; a longer entry starts at its top. */}
			<Box sx={{ minWidth: 0, alignSelf: "center" }}>
				<Typography component="p" sx={{ m: 0, overflowWrap: "anywhere" }}>
					{sentence.parts.map((part, index) => renderPart(part, index, visible))}
				</Typography>
				<Box
					sx={{
						display: { xs: "flex", md: chip ? "flex" : "none" },
						alignItems: "center",
						gap: 0.75,
						mt: 0.5,
						minWidth: 0,
					}}
				>
					{chip}
					<Typography
						component="time"
						dateTime={stamp}
						variant="numeric"
						sx={(theme) => ({
							display: { md: "none" },
							flex: "none",
							fontSize: "0.75rem",
							color: theme.vars.palette.kosh.ink3,
						})}
					>
						{time}
					</Typography>
				</Box>
			</Box>
		</Box>
	);
};
