import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import {
	IconAdd,
	IconCheck,
	IconChevronRight,
	IconClock,
	IconClose,
	IconDelete,
	IconEdit,
	IconLeave,
	IconMail,
	IconMore,
	IconSend,
} from "@connected-repo/ui-mui/kosh/icons";
import { LEVEL_LABEL, LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type { AccessEntry } from "@connected-repo/zod-schemas/kosh/people.zod";
import { SHARING } from "@frontend/copy/sharing.copy";
import { possessive } from "@frontend/modules/access/people.utils";
import { type ReactNode, useState } from "react";
import { ActionMenu, type MenuAction } from "../ActionMenu";
import { LevelMenuButton, levelChoices, levelRank } from "../levels";
import {
	entryFirstName,
	entryName,
	type ShareTarget,
	sentWhen,
	sinceDay,
	worksUntil,
} from "./share.utils";

/** What the rows can ask the dialog to do. The dialog confirms, saves and says what happened. */
export interface ShareActions {
	setLevel: (change: {
		entry: AccessEntry;
		target: ShareTarget;
		level: AccessLevel;
		/** Their level on that same target before; null when this adds one. */
		previous: AccessLevel | null;
		what: string;
	}) => void;
	remove: (entry: AccessEntry) => void;
	leave: (entry: AccessEntry) => void;
	resend: (entry: AccessEntry) => void;
	cancelInvite: (entry: AccessEntry) => void;
	confirmOwner: (entry: AccessEntry) => void;
	/** Show another target's sharing in this dialog, optionally ready to invite. */
	open: (target: ShareTarget, invite?: { email: string; level: AccessLevel }) => void;
}

/** Where the dialog is, for the rows. */
export interface ShareContext {
	target: ShareTarget;
	/** The target in words: "Anil · Zerodha", or "all of Anil's accounts". */
	what: string;
	holderId: string;
	holderFirstName: string;
	/** The signed-in person owns the holder, so holder-wide access is theirs to change. */
	ownsHolder: boolean;
	/** The signed-in person is the holder's only settled owner. */
	soleOwner: boolean;
	/** The holder's accounts, for "Give more on one account…". */
	holderAccounts: readonly { id: string; label: string; broker: string }[];
	busy: boolean;
}

/**
 * `own`: access on the dialog's own target.
 * `holder`: access to all of the holder's accounts, seen from one account.
 * `account`: access to one account, seen from its holder.
 */
type EntryPlace = "own" | "holder" | "account";

interface EntryRowProps {
	entry: AccessEntry;
	place: EntryPlace;
	/** For `account`: which account, in words and as a broker mark. */
	account?: { id: string; label: string; broker: string };
	context: ShareContext;
	actions: ShareActions;
}

type MenuMode = "main" | "levels" | "accounts";

/** One person, or one invite, with access: who, since when, their level, and what can be done. */
export const EntryRow = ({ entry, place, account, context, actions }: EntryRowProps) => {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [mode, setMode] = useState<MenuMode>("main");
	const name = entryName(entry);
	const first = entryFirstName(entry);
	const invite = entry.pending;

	const openMenu = (element: HTMLElement) => {
		setMode("main");
		setAnchor(element);
	};

	// Where this entry's own access lives.
	const entryTarget: ShareTarget =
		place === "account" && account
			? { accountId: account.id }
			: place === "holder"
				? { personId: context.holderId }
				: context.target;
	const entryWhat =
		place === "account" && account
			? account.label
			: place === "holder"
				? SHARING.allOf(possessive(context.holderFirstName))
				: context.what;

	// ── The quiet second line ──
	let line: ReactNode;
	if (invite) {
		if (entry.expired && entry.expiresAt !== null)
			line = SHARING.inviteRanOut(worksUntil(entry) ?? "");
		else if (place === "account" && account)
			line = SHARING.inviteOnAccount(account.label, sentWhen(entry));
		else line = SHARING.inviteLine(sentWhen(entry), worksUntil(entry));
	} else if (place === "account" && account) {
		line = (
			<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
				<BrokerMark broker={account.broker} size={20} sx={{ borderRadius: "6px" }} />
				{account.label}
			</Box>
		);
	} else if (entry.addedHolder) {
		line = SHARING.added(context.holderFirstName, sinceDay(entry));
	} else if (place === "holder" && !entry.isMe) {
		line = (
			<>
				{SHARING.cantLower}
				{context.ownsHolder && (
					<>
						{" · "}
						<Link
							component="button"
							type="button"
							onClick={() => actions.open({ personId: context.holderId })}
						>
							{SHARING.changeOn(context.holderFirstName)}
						</Link>
					</>
				)}
			</>
		);
	} else if (entry.isMe) {
		line = SHARING.sinceOnly(sinceDay(entry));
	} else {
		line = SHARING.since(entry.email, sinceDay(entry));
	}

	// ── What can be done ──
	const levelPick = (level: AccessLevel) =>
		actions.setLevel({
			entry,
			target: entryTarget,
			level,
			previous: entry.level,
			what: entryWhat,
		});

	// A level that can be changed is a button; otherwise it is the plain badge.
	let levelButtonLabel: string | null = null;
	let menu: MenuAction[] = [];
	let menuTitle = name;

	if (entry.isMe) {
		// Their own row: nothing to change but leaving, and only where the access is.
		if (place === "own") {
			menuTitle = SHARING.moreForYou;
			menu = [
				{
					key: "leave",
					label: SHARING.leave,
					icon: <IconLeave />,
					tone: "danger",
					hint: context.soleOwner ? SHARING.leaveBlockedHint : SHARING.leaveHint(entryWhat),
					onSelect: () => actions.leave(entry),
				},
			];
		}
	} else if (invite) {
		if (place !== "holder") {
			menuTitle = SHARING.moreForInvite(entry.email);
			menu =
				mode === "levels"
					? levelChoices({ current: entry.level, onPick: levelPick })
					: [
							{
								key: "resend",
								label: SHARING.sendAgain,
								icon: <IconSend />,
								onSelect: () => actions.resend(entry),
							},
							...(entry.expired
								? []
								: [
										{
											key: "level",
											label: SHARING.changeLevel,
											icon: <IconEdit />,
											keepOpen: true,
											onSelect: () => setMode("levels"),
										},
									]),
							{
								key: "cancel",
								label: SHARING.cancelInvite,
								icon: <IconClose />,
								tone: "danger" as const,
								onSelect: () => actions.cancelInvite(entry),
							},
						];
		}
	} else if (place === "own") {
		// Someone on this very target: change their level, or remove them.
		const canGiveMore =
			"personId" in context.target && entry.level !== "owner" && context.holderAccounts.length > 0;
		const nextUp: AccessLevel = entry.level === "view" ? "edit" : "owner";
		const giveMoreOn = (accountId: string) =>
			actions.open({ accountId }, { email: entry.email, level: nextUp });
		menu =
			mode === "accounts"
				? context.holderAccounts.map((a) => ({
						key: a.id,
						label: a.label,
						icon: <BrokerMark broker={a.broker} size={24} sx={{ borderRadius: "7px" }} />,
						onSelect: () => giveMoreOn(a.id),
					}))
				: [
						...(entry.needsConfirmation
							? [
									{
										key: "confirm",
										label: SHARING.confirmOwner(first),
										icon: <IconCheck />,
										hint: SHARING.waitingToConfirmHint,
										onSelect: () => actions.confirmOwner(entry),
									},
								]
							: []),
						...levelChoices({ current: entry.level, onPick: levelPick }),
						...(canGiveMore
							? [
									{
										key: "more",
										label: SHARING.giveMore,
										icon: <IconAdd />,
										hint: SHARING.giveMoreHint(
											LEVEL_LABEL[nextUp],
											context.holderAccounts[0]?.label ?? "",
										),
										divider: true,
										keepOpen: context.holderAccounts.length > 1,
										onSelect: () => {
											const only = context.holderAccounts[0];
											if (context.holderAccounts.length === 1 && only) giveMoreOn(only.id);
											else setMode("accounts");
										},
									},
								]
							: []),
						{
							key: "remove",
							label: SHARING.remove(first),
							icon: <IconDelete />,
							tone: "danger" as const,
							hint: SHARING.removeHint(entryWhat),
							divider: !canGiveMore,
							onSelect: () => actions.remove(entry),
						},
					];
		levelButtonLabel = SHARING.levelOf(name, LEVEL_LABEL[entry.level]);
	} else if (place === "holder" && levelRank(entry.level) < levelRank("owner")) {
		// Has all of the holder's accounts: it can be raised for this one account, never lowered.
		menu = levelChoices({
			current: entry.level,
			floor: entry.level,
			floorHint: SHARING.holderLevelHint(context.holderFirstName),
			onPick: (level) =>
				actions.setLevel({
					entry,
					target: context.target,
					level,
					previous: null,
					what: context.what,
				}),
		});
		levelButtonLabel = SHARING.raiseHere(name, LEVEL_LABEL[entry.level]);
	}

	return (
		<Box
			component="li"
			sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, minHeight: 60 }}
		>
			{invite ? (
				<HolderAvatar name="Invite" size="sm">
					<IconMail />
				</HolderAvatar>
			) : (
				<HolderAvatar name={name} colorKey={entry.userId ?? entry.email} size="sm" />
			)}
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Box
					sx={{
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						columnGap: 1,
						rowGap: 0.25,
					}}
				>
					<Typography variant="subtitle2" component="span" sx={{ overflowWrap: "anywhere" }}>
						{name}
						{entry.isMe && ` ${SHARING.you}`}
					</Typography>
					{invite && !entry.expired && (
						<Tag tone="pending" icon={<IconClock />}>
							{SHARING.invited}
						</Tag>
					)}
					{invite && entry.expired && <Tag>{SHARING.expired}</Tag>}
					{entry.needsConfirmation && <Tag tone="pending">{SHARING.waitingToConfirm}</Tag>}
				</Box>
				<Typography variant="caption" component="div" sx={{ overflowWrap: "anywhere" }}>
					{line}
				</Typography>
				{entry.needsConfirmation && place !== "holder" && (
					<Button
						variant="outlined"
						startIcon={<IconCheck />}
						disabled={context.busy}
						onClick={() => actions.confirmOwner(entry)}
						sx={{ mt: 1 }}
					>
						{SHARING.confirmOwner(first)}
					</Button>
				)}
			</Box>
			{levelButtonLabel ? (
				<LevelMenuButton
					level={entry.level}
					ariaLabel={levelButtonLabel}
					open={Boolean(anchor)}
					onClick={(event) => openMenu(event.currentTarget)}
				/>
			) : (
				<LevelBadge level={entry.level} />
			)}
			{place === "account" && account && !invite && (
				<IconButton
					aria-label={SHARING.openSharing(account.label)}
					onClick={() => actions.open({ accountId: account.id })}
					sx={{ mr: -1 }}
				>
					<IconChevronRight />
				</IconButton>
			)}
			{menu.length > 0 && !levelButtonLabel && (
				<IconButton
					aria-label={menuTitle}
					aria-haspopup="menu"
					onClick={(event) => openMenu(event.currentTarget)}
					sx={{ mr: -1 }}
				>
					<IconMore />
				</IconButton>
			)}
			{menu.length > 0 && (
				<ActionMenu
					anchorEl={anchor}
					onClose={() => setAnchor(null)}
					title={menuTitle}
					sheetTitle={
						<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
							{invite ? (
								<HolderAvatar name="Invite">
									<IconMail />
								</HolderAvatar>
							) : (
								<HolderAvatar name={name} colorKey={entry.userId ?? entry.email} />
							)}
							<Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
								{entry.isMe ? SHARING.youAlone : name}
							</Box>
						</Box>
					}
					sheetSubtitle={line}
					doneLabel={SHARING.done}
					actions={menu}
				/>
			)}
		</Box>
	);
};
