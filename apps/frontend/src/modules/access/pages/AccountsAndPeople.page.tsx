import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconAccounts, IconAdd, IconAddPerson } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import type {
	DirectoryAccount,
	DirectoryHolder,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { Page } from "@frontend/components/layout/Page";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import { ACCOUNTS, ADD_ACCOUNT, ADD_PERSON } from "@frontend/copy/accounts.copy";
import { NAV } from "@frontend/copy/nav.copy";
import { ActionMenu } from "@frontend/modules/access/components/ActionMenu";
import { AddAccountDialog } from "@frontend/modules/access/components/AddAccountDialog";
import {
	type AddedPerson,
	AddPersonDialog,
} from "@frontend/modules/access/components/AddPersonDialog";
import {
	ColumnCaptions,
	hasMoney,
	totalValue,
} from "@frontend/modules/access/components/accounts/accountRow.parts";
import { HolderCard } from "@frontend/modules/access/components/accounts/HolderCard";
import { SharedAccounts } from "@frontend/modules/access/components/accounts/SharedAccounts";
import { WelcomeState } from "@frontend/modules/access/components/accounts/WelcomeState";
import { RenameDialog, type RenameSubject } from "@frontend/modules/access/components/RenameDialog";
import {
	ShareDialog,
	type ShareDialogProps,
} from "@frontend/modules/access/components/ShareDialog";
import { useDirectory, useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords, firstNameOf } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";

type Scope = "everything" | "shared";

const SectionTitle = ({ children }: { children: ReactNode }) => (
	<Typography variant="eyebrow" component="h2" sx={{ mb: -1, mt: 0.5 }}>
		{children}
	</Typography>
);

const LoadingCards = () => (
	<Box aria-busy aria-label="Loading your accounts" sx={{ display: "grid", gap: 2.25 }}>
		{[148, 96, 96].map((height, index) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder list
			<Skeleton key={index} variant="rounded" height={height} sx={{ borderRadius: "20px" }} />
		))}
	</Box>
);

/**
 * Accounts and people: everyone whose investments the signed-in person can
 * see, their broker accounts, and — where they are an owner — who else has
 * access. Adding people and accounts, and all sharing, start here.
 */
export default function AccountsAndPeoplePage() {
	const { user } = useSessionInfo();
	const directory = useDirectory();
	const snack = useSnack();
	const refresh = useRefreshPeople();
	const updatePerson = useMutation(orpc.portfolio.updatePerson.mutationOptions());

	const [personOpen, setPersonOpen] = useState(false);
	const [personSelf, setPersonSelf] = useState(false);
	const [accountOpen, setAccountOpen] = useState(false);
	const [accountHolderId, setAccountHolderId] = useState<string | null>(null);
	const [share, setShare] = useState<ShareDialogProps["target"]>(null);
	const [rename, setRename] = useState<RenameSubject | null>(null);
	const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);
	const [scope, setScope] = useState<Scope>("everything");

	const view = useMemo(() => {
		const holders = directory.data?.holders ?? [];
		const accounts = directory.data?.accounts ?? [];
		const owned = accounts.filter((a) => a.myLevel === "owner");
		return {
			holders,
			accounts,
			byId: new Map(holders.map((h) => [h.id, h])),
			owned,
			shared: accounts.filter((a) => a.myLevel !== "owner"),
			// A card for every holder they own, or own at least one account of.
			ownerHolders: holders.filter(
				(h) => h.myLevel === "owner" || owned.some((a) => a.personId === h.id),
			),
			// Only a holder's owner can add an account to it.
			addableHolders: holders.filter((h) => h.myLevel === "owner"),
			holdersWithAccounts: new Set(accounts.map((a) => a.personId)).size,
			withMoney: hasMoney(accounts),
			total: totalValue(accounts),
			someoneIsMe: holders.some((h) => h.isMe),
		};
	}, [directory.data]);

	const meName = directory.data?.me.name || user?.name || "";
	const meEmail = directory.data?.me.email || user?.email || "";
	const canAddAccount = view.addableHolders.length > 0;

	const openAddPerson = (self: boolean) => {
		setPersonSelf(self);
		setPersonOpen(true);
	};
	const openAddAccount = (holder?: DirectoryHolder) => {
		setAccountHolderId(holder?.id ?? null);
		setAccountOpen(true);
	};

	const onPersonAdded = (person: AddedPerson) => {
		const invite = person.kind === "login" && !person.isMe;
		snack({
			message: ADD_PERSON.added(person.displayName),
			actionLabel: invite ? ADD_PERSON.inviteThem : ACCOUNTS.addAccount,
			onAction: () => {
				if (invite) setShare({ personId: person.id });
				else {
					setAccountHolderId(person.id);
					setAccountOpen(true);
				}
			},
		});
	};

	const setIsMe = async (holder: DirectoryHolder, isMe: boolean) => {
		try {
			await updatePerson.mutateAsync({ personId: holder.id, isMe });
			await refresh();
			snack(
				isMe ? ACCOUNTS.markedAsMe(holder.displayName) : ACCOUNTS.unmarkedAsMe(holder.displayName),
			);
		} catch (error) {
			snack(errorWords(error, ACCOUNTS.loadFailed));
		}
	};

	const cardActions = {
		onShareHolder: (holder: DirectoryHolder) => setShare({ personId: holder.id }),
		onShareAccount: (account: DirectoryAccount) => setShare({ accountId: account.id }),
		onRenameHolder: (holder: DirectoryHolder) =>
			setRename({ kind: "person", id: holder.id, name: holder.displayName }),
		onRenameAccount: (account: DirectoryAccount) =>
			setRename({ kind: "account", id: account.id, name: account.label }),
		onAddAccount: openAddAccount,
		onSetIsMe: setIsMe,
	};

	const empty = directory.isSuccess && view.holders.length === 0 && view.accounts.length === 0;
	const populated = directory.isSuccess && !empty;
	const showOwned = view.ownerHolders.length > 0;
	const showShared = view.shared.length > 0;

	const subtitle = populated ? (
		<>
			{ACCOUNTS.summaryLead}{" "}
			{view.total !== null ? (
				<>
					<Box component="b" sx={(theme) => ({ color: theme.vars.palette.kosh.ink })}>
						<Money value={view.total} />
					</Box>{" "}
					{ACCOUNTS.summaryWithTotal(view.accounts.length, view.holdersWithAccounts)}
				</>
			) : (
				ACCOUNTS.summary(
					view.accounts.length,
					view.accounts.length === 0 ? view.holders.length : view.holdersWithAccounts,
				)
			)}
		</>
	) : undefined;

	const dialogs = (
		<>
			<AddPersonDialog
				open={personOpen}
				onClose={() => setPersonOpen(false)}
				selfName={personSelf ? meName : null}
				onAdded={onPersonAdded}
			/>
			<AddAccountDialog
				open={accountOpen}
				onClose={() => setAccountOpen(false)}
				holders={view.addableHolders}
				initialHolderId={accountHolderId}
				onAdded={(account) => snack(ADD_ACCOUNT.added(account.label))}
				onChangeAccess={(personId) => setShare({ personId })}
			/>
			<RenameDialog subject={rename} onClose={() => setRename(null)} />
			<ShareDialog target={share} onClose={() => setShare(null)} />
		</>
	);

	return (
		<Page
			title={NAV.accounts}
			subtitle={subtitle}
			actions={
				populated ? (
					// On a phone the "+" in the app bar offers the same two.
					<Box sx={{ display: { xs: "none", md: "flex" }, gap: 1.25 }}>
						<Button
							variant="outlined"
							startIcon={<IconAddPerson />}
							onClick={() => openAddPerson(false)}
						>
							{ACCOUNTS.addPerson}
						</Button>
						{canAddAccount && (
							<Button variant="contained" startIcon={<IconAdd />} onClick={() => openAddAccount()}>
								{ACCOUNTS.addAccount}
							</Button>
						)}
					</Box>
				) : undefined
			}
			barAction={
				populated ? (
					<IconButton
						aria-label={canAddAccount ? ACCOUNTS.addMenuLabel : ACCOUNTS.addPerson}
						aria-haspopup={canAddAccount ? "menu" : undefined}
						onClick={(event) =>
							canAddAccount ? setAddMenu(event.currentTarget) : openAddPerson(false)
						}
					>
						<IconAdd />
					</IconButton>
				) : undefined
			}
		>
			{directory.isPending && <LoadingCards />}

			{directory.isError && (
				<Banner
					tone="bad"
					action={
						<Button variant="text" color="error" onClick={() => directory.refetch()}>
							{ACCOUNTS.retry}
						</Button>
					}
				>
					{errorWords(directory.error, ACCOUNTS.loadFailed)}
				</Banner>
			)}

			{empty && (
				<WelcomeState
					firstName={firstNameOf(meName) || meName}
					email={meEmail}
					onAddYourself={() => openAddPerson(true)}
					onAddSomeoneElse={() => openAddPerson(false)}
				/>
			)}

			{populated && (
				<>
					{showOwned && showShared && (
						<Segmented<Scope>
							ariaLabel="Which accounts to show"
							fullWidth
							value={scope}
							onChange={setScope}
							options={[
								{ value: "everything", label: "Everything" },
								{ value: "shared", label: NAV.shared },
							]}
							sx={{ display: { xs: "flex", md: "none" } }}
						/>
					)}

					{view.accounts.length > 0 && <ColumnCaptions withMoney={view.withMoney} />}

					{showOwned && (
						<Box
							sx={{
								display: {
									xs: scope === "shared" && showShared ? "none" : "contents",
									md: "contents",
								},
							}}
						>
							<SectionTitle>{ACCOUNTS.owned}</SectionTitle>
							{view.ownerHolders.map((holder) => (
								<HolderCard
									key={holder.id}
									holder={holder}
									accounts={view.owned.filter((a) => a.personId === holder.id)}
									withMoney={view.withMoney}
									canClaimMe={!view.someoneIsMe}
									{...cardActions}
								/>
							))}
						</Box>
					)}

					{showShared && (
						<>
							<SectionTitle>{ACCOUNTS.shared}</SectionTitle>
							<SharedAccounts
								accounts={view.shared}
								holders={view.byId}
								withMoney={view.withMoney}
							/>
						</>
					)}
				</>
			)}

			<ActionMenu
				anchorEl={addMenu}
				onClose={() => setAddMenu(null)}
				title={ACCOUNTS.addMenuLabel}
				actions={[
					{
						key: "account",
						label: ACCOUNTS.addAccount,
						icon: <IconAccounts />,
						onSelect: () => openAddAccount(),
					},
					{
						key: "person",
						label: ACCOUNTS.addPerson,
						icon: <IconAddPerson />,
						onSelect: () => openAddPerson(false),
					},
				]}
			/>
			{dialogs}
		</Page>
	);
}
