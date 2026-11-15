import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Collapse } from "@connected-repo/ui-mui/feedback/Collapse";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { IconAdd, IconDelete, IconHolderWide } from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { ConfirmDialog, ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { RowItem, RowList } from "@connected-repo/ui-mui/kosh/RowItem";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { WHO } from "@frontend/copy/who.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import {
	brokerNameOf,
	errorWords,
	firstNameOf,
	possessive,
} from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { rowLines } from "./rowLines";
import { TargetChoices } from "./TargetChoices";
import {
	accountsSeenBy,
	allAccounts,
	cellsFor,
	columnNames,
	type MatrixHolder,
	type MatrixPerson,
	nameOf,
	removalPlan,
	type ShareTarget,
	shareChoices,
} from "./who.utils";

interface PersonSheetProps {
	/** The person to show; null closes the sheet. */
	person: MatrixPerson | null;
	holders: MatrixHolder[];
	unconfirmed: ReadonlySet<string>;
	onClose: () => void;
	/** Open the share dialog on a target, with this person's address filled in. */
	onShare: (target: ShareTarget, email?: string) => void;
}

/**
 * One person: exactly what they can see of yours, what they cannot, and the
 * two things you can do about it — share more, or remove them from everything.
 */
export const PersonSheet = ({ person, holders, unconfirmed, onClose, onShare }: PersonSheetProps) => {
	// Keep the last person on screen while the sheet slides shut.
	const [shown, setShown] = useState(person);
	if (person && person !== shown) setShown(person);

	return (
		<ResponsiveDialog
			open={person !== null}
			onClose={onClose}
			title={shown ? nameOf(shown) : ""}
			subtitle={shown && !shown.pending && shown.name ? shown.email : undefined}
		>
			{shown && (
				<PersonDetail
					key={shown.key}
					person={shown}
					holders={holders}
					unconfirmed={unconfirmed}
					onClose={onClose}
					onShare={onShare}
				/>
			)}
		</ResponsiveDialog>
	);
};

interface PersonDetailProps extends Omit<PersonSheetProps, "person"> {
	person: MatrixPerson;
}

const PersonDetail = ({ person, holders, unconfirmed, onClose, onShare }: PersonDetailProps) => {
	const snack = useSnack();
	const theme = useTheme();
	const touch = useMediaQuery(theme.breakpoints.down("md"));
	const refresh = useRefreshPeople();
	const remove = useMutation(orpc.access.revoke.mutationOptions());
	const [choosing, setChoosing] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [removing, setRemoving] = useState(false);

	// A person's first name; an invite has only its address.
	const short = person.name ? firstNameOf(person.name) : person.email;
	// In a heading or on a button, an address is too long to repeat.
	const brief = person.name ? short : WHO.thisAddress;
	const total = allAccounts(holders).length;
	const seen = accountsSeenBy(person, holders, unconfirmed);
	const seenIds = new Set(seen.map((s) => s.account.id));
	const hidden = holders.flatMap((holder) =>
		holder.accounts.filter((a) => !seenIds.has(a.id)).map((account) => ({ holder, account })),
	);
	const choices = shareChoices(holders, person);
	const plan = removalPlan(person, holders);
	// What "remove from everything" cannot reach: accounts seen through a
	// holder the signed-in person only partly owns.
	const staying = seen.filter((s) => s.via === "holder" && !s.holder.ownsHolder);

	const removeEverything = async () => {
		setRemoving(true);
		let done = 0;
		let firstError: unknown;
		// One at a time: each removal is checked on its own (an account always keeps an owner).
		for (const grantId of plan.grantIds) {
			try {
				await remove.mutateAsync({ grantId });
				done += 1;
			} catch (error) {
				firstError ??= error;
			}
		}
		await refresh();
		setRemoving(false);
		setConfirming(false);
		if (firstError === undefined) {
			snack(
				person.pending
					? WHO.cancelled(person.email)
					: staying.length > 0
						? WHO.removedExcept(
								short,
								staying.map((s) => s.account.label),
							)
						: WHO.removed(short),
			);
			onClose();
		} else if (done === 0) {
			snack(errorWords(firstError, WHO.removeFailed));
		} else {
			snack({
				message: WHO.removedPartly(
					short,
					done,
					plan.grantIds.length,
					errorWords(firstError, WHO.removeFailed),
				),
				duration: 10000,
			});
		}
	};

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
			<Typography variant="body2">
				{person.pending ? WHO.invitedTo(person.email, touch) : WHO.seesThese(short, touch)}
			</Typography>

			<Box
				sx={(theme) => ({
					border: `1px solid ${theme.vars.palette.kosh.line}`,
					borderRadius: 2,
					overflow: "hidden",
				})}
			>
				<RowList sx={(theme) => rowLines(theme.vars.palette.kosh.line)}>
					{cellsFor(person, holders, unconfirmed).flatMap(({ holder, wide, accounts }) => {
						const whose = possessive(firstNameOf(holder.displayName));
						return [
							...(wide
								? [
										<RowItem
											key={`holder-${holder.id}`}
											leading={
												<Box
													aria-hidden
													sx={(theme) => ({
														width: 38,
														display: "grid",
														placeItems: "center",
														color: theme.vars.palette.kosh.ink2,
													})}
												>
													<IconHolderWide />
												</Box>
											}
											primary={WHO.allOf(whose)}
											secondary={WHO.andAnyNew(columnNames(holder))}
											trailing={<LevelBadge level={wide.level} />}
											onClick={
												holder.ownsHolder ? () => onShare({ personId: holder.id }) : undefined
											}
											sx={(theme) => ({ bgcolor: theme.vars.palette.kosh.surface2 })}
										/>,
									]
								: []),
							...holder.accounts.flatMap((account, index) => {
								const entry = accounts[index];
								if (!entry) return [];
								return [
									<RowItem
										key={account.id}
										leading={<BrokerMark broker={brokerNameOf(account)} />}
										primary={account.label}
										secondary={wide ? WHO.onTopOf(whose) : WHO.onlyThisAccount}
										trailing={<LevelBadge level={entry.level} />}
										onClick={() => onShare({ accountId: account.id })}
									/>,
								];
							}),
						];
					})}
				</RowList>
			</Box>
			{plan.stuck.map(({ holder }) => (
				<Typography variant="caption" key={holder.id}>
					{WHO.notYoursNote(possessive(firstNameOf(holder.displayName)))}
				</Typography>
			))}

			<Typography variant="eyebrow" component="h3" sx={{ mt: 1 }}>
				{WHO.notSharedWith(brief)}
			</Typography>
			{hidden.length === 0 ? (
				<Typography variant="body2">{WHO.nothingHidden(total)}</Typography>
			) : (
				<Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
					{hidden.map(({ holder, account }) => (
						<Box
							component="li"
							key={account.id}
							sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}
						>
							<BrokerMark broker={brokerNameOf(account)} size={30} />
							<Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
								<Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
									{account.label}
								</Box>
								{` · ${holder.displayName}`}
							</Typography>
						</Box>
					))}
				</Box>
			)}

			<Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1.5 }}>
				{choices.length > 0 && (
					<>
						<Button
							variant="outlined"
							size="large"
							fullWidth
							startIcon={<IconAdd />}
							aria-expanded={choosing}
							onClick={() => setChoosing((open) => !open)}
							sx={LONG_LABEL}
						>
							{WHO.shareMore(brief)}
						</Button>
						<Collapse in={choosing} unmountOnExit>
							<Typography variant="body2" sx={{ mt: 0.75, mb: 1 }}>
								{WHO.shareMoreChoose(brief)}
							</Typography>
							<TargetChoices choices={choices} onChoose={(target) => onShare(target, person.email)} />
						</Collapse>
					</>
				)}
				{plan.grantIds.length > 0 && (
					<Button
						variant="text"
						color="error"
						fullWidth
						startIcon={<IconDelete />}
						onClick={() => setConfirming(true)}
						sx={LONG_LABEL}
					>
						{person.pending
							? WHO.cancelInvites(plan.grantIds.length)
							: WHO.removeFromEverything(short)}
					</Button>
				)}
			</Box>

			<ConfirmDialog
				open={confirming}
				tone="danger"
				icon={<IconDelete />}
				title={person.pending ? WHO.cancelTitle(person.email) : WHO.removeTitle(short)}
				confirmLabel={person.pending ? WHO.cancelConfirm : WHO.removeConfirm(short)}
				cancelLabel={person.pending ? WHO.keepInvite : WHO.keep}
				busy={removing}
				onConfirm={() => void removeEverything()}
				onCancel={() => setConfirming(false)}
			>
				{person.pending ? WHO.cancelBody : WHO.removeBody(seen.length - staying.length)}
				{plan.stuck.map(({ holder }) => (
					<Box component="span" key={holder.id} sx={{ display: "block", mt: 1 }}>
						{WHO.removeStuck(
							holder.accounts.map((a) => a.label),
							possessive(firstNameOf(holder.displayName)),
						)}
					</Box>
				))}
			</ConfirmDialog>
		</Box>
	);
};

/** A button whose label carries a name or an address may need a second line. */
const LONG_LABEL = { whiteSpace: "normal", py: 1, overflowWrap: "anywhere" } as const;
