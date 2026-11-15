import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import {
	IconAddPerson,
	IconCalc,
	IconCheck,
	IconEdit,
	IconLock,
	IconUpload,
} from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { AccessLevel, HolderKind } from "@connected-repo/zod-schemas/enums.zod";
import {
	LEVEL_EDIT_CAN,
	LEVEL_OWNER_CAN,
	LEVEL_SEES,
	OWNER_WARNING,
} from "@frontend/copy/levels.copy";
import { SHARING } from "@frontend/copy/sharing.copy";
import { possessive } from "@frontend/modules/access/people.utils";
import type { ReactNode } from "react";

interface CheckPanelProps {
	email: string;
	level: AccessLevel;
	/** The account being shared, or every account the holder has now. */
	accounts: readonly { id: string; label: string; broker: string }[];
	/** Set when the whole holder is shared: new accounts are included too. */
	holder: { id: string; displayName: string; firstName: string; kind: HolderKind } | null;
	/** "Anil · Groww, Kabir's accounts, or any other account" */
	wontSee: string;
	/** Said when this changes a level someone already has. */
	changeNote: string | null;
	/** Under a single account's name: whether it is all they will see. */
	accountCaption: string;
	/** Why sending failed, if it did. */
	failure: string | null;
}

const Item = ({
	icon,
	tone,
	children,
}: {
	icon: ReactNode;
	/** `pos`: a green tick for what they get. */
	tone?: "pos";
	children: ReactNode;
}) => (
	<Box
		component="li"
		sx={(theme) => ({
			display: "flex",
			alignItems: "flex-start",
			gap: 1.25,
			fontSize: "0.84375rem",
			lineHeight: 1.4,
			"& svg": {
				fontSize: 18,
				flex: "none",
				mt: "1px",
				color: tone === "pos" ? theme.vars.palette.kosh.pos : theme.vars.palette.kosh.ink2,
			},
		})}
	>
		{icon}
		<span>{children}</span>
	</Box>
);

const List = ({ title, children }: { title: string; children: ReactNode }) => (
	<Box>
		<Typography variant="caption" component="h4" sx={{ fontWeight: 700, m: 0, mb: 1 }}>
			{title}
		</Typography>
		<Box
			component="ul"
			sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.125 }}
		>
			{children}
		</Box>
	</Box>
);

const EDIT_ICONS = [<IconUpload key="upload" aria-hidden />, <IconEdit key="answer" aria-hidden />];
const OWNER_ICONS = [
	<IconAddPerson key="invite" aria-hidden />,
	<IconCalc key="fee" aria-hidden />,
];

/**
 * "Check before you send": exactly what the address typed will get, what it
 * will not, and — for Owner — what that hands over. Every invite passes
 * through here; nothing is sent until the button under it is pressed.
 */
export const CheckPanel = ({
	email,
	level,
	accounts,
	holder,
	wontSee,
	changeNote,
	accountCaption,
	failure,
}: CheckPanelProps) => (
	<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
		<Typography variant="h4" component="h3" sx={{ overflowWrap: "anywhere" }}>
			{SHARING.whatTheyGet(email || SHARING.thisPerson)}
		</Typography>

		<Box
			sx={(theme) => ({
				border: `1px solid ${theme.vars.palette.kosh.line}`,
				borderRadius: "14px",
				bgcolor: theme.vars.palette.kosh.surface,
				px: 1.75,
				py: 1.5,
				display: "flex",
				flexDirection: "column",
				gap: 1.25,
			})}
		>
			{holder ? (
				<>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<HolderAvatar
							name={holder.displayName}
							colorKey={holder.id}
							kind={holder.kind}
							size="sm"
						/>
						<Typography variant="subtitle2" component="div" sx={{ flex: 1, minWidth: 0 }}>
							{SHARING.groupHolder(possessive(holder.firstName))}
						</Typography>
						<LevelBadge level={level} />
					</Box>
					<Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}>
						{accounts.map((account) => (
							<Box
								component="li"
								key={account.id}
								sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.84375rem" }}
							>
								<BrokerMark broker={account.broker} size={24} sx={{ borderRadius: "7px" }} />
								{account.label}
							</Box>
						))}
					</Box>
					<Typography variant="caption">{SHARING.andLater(holder.firstName)}</Typography>
				</>
			) : (
				accounts.map((account) => (
					<Box key={account.id} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<BrokerMark broker={account.broker} />
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Typography variant="subtitle2" component="div">
								{account.label}
							</Typography>
							<Typography variant="caption" component="div">
								{accountCaption}
							</Typography>
						</Box>
						<LevelBadge level={level} />
					</Box>
				))
			)}
		</Box>

		{changeNote && <Typography variant="body2">{changeNote}</Typography>}

		{/* Above the lists, so it is read before the send button is in reach. */}
		{level === "owner" && <Banner tone="warn">{OWNER_WARNING}</Banner>}

		<List title={SHARING.willSee}>
			{LEVEL_SEES.map((words) => (
				<Item key={words} tone="pos" icon={<IconCheck aria-hidden />}>
					{words}
				</Item>
			))}
		</List>

		{level !== "view" && (
			<List title={SHARING.willBeAble}>
				{LEVEL_EDIT_CAN.map((words, index) => (
					<Item key={words} icon={EDIT_ICONS[index]}>
						{words}
					</Item>
				))}
				{level === "owner" &&
					LEVEL_OWNER_CAN.map((words, index) => (
						<Item key={words} icon={OWNER_ICONS[index]}>
							{words}
						</Item>
					))}
			</List>
		)}

		<List title={SHARING.wontSee}>
			<Item icon={<IconLock aria-hidden />}>{wontSee}</Item>
			{level !== "owner" && <Item icon={<IconLock aria-hidden />}>{SHARING.whoElse}</Item>}
		</List>

		<Typography variant="caption">{SHARING.startsWhen}</Typography>

		{failure && <Banner tone="bad">{failure}</Banner>}
	</Box>
);
