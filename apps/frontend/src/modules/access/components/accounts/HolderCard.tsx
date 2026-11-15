import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { AvatarStack, HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import {
	IconAdd,
	IconAddPerson,
	IconEdit,
	IconMore,
	IconPerson,
} from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import type {
	DirectoryAccount,
	DirectoryHolder,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { ACCOUNTS } from "@frontend/copy/accounts.copy";
import { brokerNameOf, firstNameOf } from "@frontend/modules/access/people.utils";
import { useState } from "react";
import { ActionMenu, type MenuAction } from "../ActionMenu";
import {
	AccountRowShell,
	AccountRows,
	MoneyCells,
	phoneReturn,
	RowLink,
	raised,
	totalValue,
} from "./accountRow.parts";

interface HolderCardActions {
	onShareHolder: (holder: DirectoryHolder) => void;
	onShareAccount: (account: DirectoryAccount) => void;
	onRenameHolder: (holder: DirectoryHolder) => void;
	onRenameAccount: (account: DirectoryAccount) => void;
	onAddAccount: (holder: DirectoryHolder) => void;
	onSetIsMe: (holder: DirectoryHolder, isMe: boolean) => void;
}

interface HolderCardProps extends HolderCardActions {
	holder: DirectoryHolder;
	/** This holder's accounts that the signed-in person owns. */
	accounts: readonly DirectoryAccount[];
	withMoney: boolean;
	/** Nobody is marked "This is me" yet, so the menu may offer it. */
	canClaimMe: boolean;
}

/** "3 people", "2 owners", "3 · 1 invited" — beside the faces. Owners only. */
const AccessWords = ({ access }: { access: NonNullable<DirectoryAccount["access"]> }) => (
	<>
		{ACCOUNTS.accessLine(access.people.length, access.owners, access.invited)}
		{access.invited > 0 && (
			<>
				{" · "}
				<Box
					component="span"
					sx={(theme) => ({ color: theme.vars.palette.kosh.sunText, fontWeight: 600 })}
				>
					{ACCOUNTS.invited(access.invited)}
				</Box>
			</>
		)}
	</>
);

const OwnedAccountRow = ({
	account,
	withMoney,
	showLevelOnPhone,
	onShare,
	onRename,
}: {
	account: DirectoryAccount;
	withMoney: boolean;
	showLevelOnPhone: boolean;
	onShare: () => void;
	onRename: () => void;
}) => {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const { access } = account;
	const returns = phoneReturn(account);

	return (
		<AccountRowShell withMoney={withMoney}>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}>
				<BrokerMark broker={brokerNameOf(account)} />
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<RowLink account={account} />
					{/* Phone: the second line carries what the desktop columns do. */}
					<Typography
						variant="caption"
						component="div"
						sx={{ display: { xs: "block", md: "none" } }}
					>
						{returns}
						{returns && access && " · "}
						{access && <AccessWords access={access} />}
					</Typography>
				</Box>
			</Box>
			{withMoney && <MoneyCells account={account} />}
			{withMoney && account.value !== null && (
				<Box sx={{ display: { xs: "block", md: "none" }, fontWeight: 700 }}>
					<Money value={account.value} />
				</Box>
			)}
			<Box sx={{ display: { xs: showLevelOnPhone ? "block" : "none", md: "block" } }}>
				<LevelBadge level={account.myLevel} />
			</Box>
			<Box
				sx={{
					display: { xs: "none", md: "flex" },
					alignItems: "center",
					gap: 1,
					minWidth: 0,
				}}
			>
				{access && (
					<>
						<AvatarStack people={access.people.map((p) => ({ id: p.key, name: p.name }))} max={3} />
						<Typography variant="body2" component="span" noWrap>
							<AccessWords access={access} />
						</Typography>
					</>
				)}
			</Box>
			<Box sx={[raised, { display: "flex", justifyContent: "flex-end", flex: "none" }]}>
				<IconButton
					aria-label={ACCOUNTS.shareAccount(account.label)}
					onClick={onShare}
					sx={{ display: { xs: "none", md: "inline-flex" } }}
				>
					<IconAddPerson />
				</IconButton>
				<IconButton
					aria-label={ACCOUNTS.moreFor(account.label)}
					aria-haspopup="menu"
					onClick={(event) => setAnchor(event.currentTarget)}
				>
					<IconMore />
				</IconButton>
			</Box>
			<ActionMenu
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				title={account.label}
				actions={[
					{ key: "share", label: ACCOUNTS.share, icon: <IconAddPerson />, onSelect: onShare },
					{ key: "rename", label: ACCOUNTS.rename, icon: <IconEdit />, onSelect: onRename },
				]}
			/>
		</AccountRowShell>
	);
};

/**
 * One person (or HUF) the signed-in person is an owner for: who they are,
 * the accounts held in their name, and — for each — who has access.
 */
export const HolderCard = ({
	holder,
	accounts,
	withMoney,
	canClaimMe,
	onShareHolder,
	onShareAccount,
	onRenameHolder,
	onRenameAccount,
	onAddAccount,
	onSetIsMe,
}: HolderCardProps) => {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const ownsHolder = holder.myLevel === "owner";
	const first = firstNameOf(holder.displayName);
	const total = withMoney ? totalValue(accounts) : null;

	const menu: MenuAction[] = ownsHolder
		? [
				{
					key: "share",
					label: ACCOUNTS.shareAll(first, holder.kind),
					icon: <IconAddPerson />,
					onSelect: () => onShareHolder(holder),
				},
				{
					key: "add",
					label: ACCOUNTS.addAccountFor(first),
					icon: <IconAdd />,
					onSelect: () => onAddAccount(holder),
				},
				{
					key: "rename",
					label: ACCOUNTS.rename,
					icon: <IconEdit />,
					onSelect: () => onRenameHolder(holder),
				},
				...(holder.isMe
					? [
							{
								key: "not-me",
								label: ACCOUNTS.thisIsntMe,
								icon: <IconPerson />,
								onSelect: () => onSetIsMe(holder, false),
							},
						]
					: canClaimMe && holder.kind === "login"
						? [
								{
									key: "me",
									label: ACCOUNTS.thisIsMe,
									hint: ACCOUNTS.thisIsMeHint,
									icon: <IconPerson />,
									onSelect: () => onSetIsMe(holder, true),
								},
							]
						: []),
			]
		: [];

	return (
		<SectionCard padding="none" sx={{ overflow: "hidden" }}>
			<Box
				sx={(theme) => ({
					display: "flex",
					alignItems: "center",
					gap: 1.5,
					px: { xs: 2, md: 2.5 },
					py: 1.5,
					bgcolor: theme.vars.palette.kosh.surface2,
				})}
			>
				<HolderAvatar name={holder.displayName} colorKey={holder.id} kind={holder.kind} />
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography variant="h5" component="h3" noWrap>
						{holder.displayName}
						{holder.isMe && (
							<Box
								component="span"
								sx={(theme) => ({ color: theme.vars.palette.kosh.ink3, fontWeight: 600 })}
							>
								{` · ${ACCOUNTS.you}`}
							</Box>
						)}
					</Typography>
					<Typography variant="caption" component="div" noWrap>
						{/* A phone has no room for both: with a total, the count gives way. */}
						<Box
							component="span"
							sx={{ display: { xs: total === null ? "inline" : "none", md: "inline" } }}
						>
							{ACCOUNTS.holderLine(holder.kind, accounts.length)}
							{total !== null && " · "}
						</Box>
						{total !== null && <Money value={total} />}
					</Typography>
				</Box>
				{holder.myLevel && <LevelBadge level={holder.myLevel} />}
				{ownsHolder && (
					<>
						<Button
							variant="outlined"
							startIcon={<IconAddPerson />}
							onClick={() => onShareHolder(holder)}
							sx={{ display: { xs: "none", md: "inline-flex" }, flex: "none" }}
						>
							{ACCOUNTS.shareAll(first, holder.kind)}
						</Button>
						<IconButton
							aria-label={ACCOUNTS.moreFor(holder.displayName)}
							aria-haspopup="menu"
							onClick={(event) => setAnchor(event.currentTarget)}
							sx={{ mr: -1 }}
						>
							<IconMore />
						</IconButton>
					</>
				)}
			</Box>

			{accounts.length > 0 ? (
				<AccountRows>
					{accounts.map((account) => (
						<OwnedAccountRow
							key={account.id}
							account={account}
							withMoney={withMoney}
							showLevelOnPhone={!ownsHolder}
							onShare={() => onShareAccount(account)}
							onRename={() => onRenameAccount(account)}
						/>
					))}
				</AccountRows>
			) : (
				<Box
					sx={{
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: 1.5,
						px: { xs: 2, md: 2.5 },
						py: 2,
					}}
				>
					<Typography variant="body2" sx={{ flex: "1 1 220px" }}>
						{ACCOUNTS.noAccountsYet(first)}
					</Typography>
					<Button variant="outlined" startIcon={<IconAdd />} onClick={() => onAddAccount(holder)}>
						{ACCOUNTS.addAccount}
					</Button>
				</Box>
			)}

			<ActionMenu
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				title={ACCOUNTS.moreFor(holder.displayName)}
				sheetTitle={holder.displayName}
				actions={menu}
			/>
		</SectionCard>
	);
};
