import { IconLeave, IconOwner } from "@connected-repo/ui-mui/kosh/icons";
import { LEVEL_LABEL } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { ConfirmDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Directory } from "@connected-repo/zod-schemas/kosh/people.zod";
import { SHARED } from "@frontend/copy/shared.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import {
	errorWords,
	firstNameOf,
	possessive,
	refusalCode,
} from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { SharedAccount } from "./shared.utils";

interface StopSeeingDialogProps {
	/** The account to leave; null closes the dialog. */
	row: SharedAccount | null;
	directory: Directory;
	onClose: () => void;
	/** The account has no other owner: open sharing on it to choose one. */
	onChooseOwner: (target: { accountId: string } | { personId: string }) => void;
}

/**
 * "Stop seeing this": the signed-in person gives up their own access.
 * What that means depends on how the account reached them, and the dialog
 * says which before anything happens:
 *
 * - shared on its own — it goes;
 * - shared as "all of a person's accounts" — all of that person's go;
 * - shared both ways, with more on this one — only the extra goes, and the
 *   account stays at the level the rest have.
 */
export const StopSeeingDialog = ({ row, directory, onClose, onChooseOwner }: StopSeeingDialogProps) => {
	const snack = useSnack();
	const refresh = useRefreshPeople();
	const leave = useMutation(orpc.access.revoke.mutationOptions());
	const [busy, setBusy] = useState(false);
	const [lastOwner, setLastOwner] = useState(false);

	// Keep the last account on screen while the dialog closes.
	const [shown, setShown] = useState(row);
	if (row && row !== shown) {
		setShown(row);
		setLastOwner(false);
	}
	if (!shown) return null;

	const { account, holder } = shown;
	const wide = account.via === "holder";
	const whose = possessive(firstNameOf(holder?.displayName ?? account.label));
	const sharer = firstNameOf(account.sharedBy.name);
	// What all of the holder's accounts give, when this one has more of its own.
	const underneath = !wide ? (holder?.myLevel ?? null) : null;
	// Leaving "all of a person's accounts" takes every shared account of theirs.
	const siblings = wide
		? directory.accounts.filter(
				(a) => a.personId === account.personId && a.id !== account.id && a.sharedBy !== null,
			)
		: [];
	const grantIds = [
		...new Set([
			...siblings.filter((a) => a.via === "account").map((a) => a.myGrantId),
			account.myGrantId,
		]),
	];

	const confirm = async () => {
		setBusy(true);
		let done = 0;
		let failure: unknown;
		for (const grantId of grantIds) {
			try {
				await leave.mutateAsync({ grantId });
				done += 1;
			} catch (error) {
				failure = error;
				break;
			}
		}
		if (done > 0) await refresh();
		setBusy(false);
		if (failure === undefined) {
			snack(
				wide
					? SHARED.stoppedWide(whose)
					: underneath
						? SHARED.steppedDown(LEVEL_LABEL[underneath], account.label)
						: SHARED.stopped(account.label),
			);
			onClose();
		} else if (refusalCode(failure) === "LAST_OWNER") {
			setLastOwner(true);
		} else {
			const why = errorWords(failure, SHARED.stopFailed);
			snack(done > 0 ? SHARED.stopPartly(why) : why);
		}
	};

	if (lastOwner)
		return (
			<ConfirmDialog
				open={row !== null}
				icon={<IconOwner />}
				title={SHARED.lastOwnerTitle(wide ? (holder?.displayName ?? account.label) : account.label)}
				confirmLabel={SHARED.chooseOwner}
				cancelLabel={SHARED.keepMeOwner}
				onConfirm={() => {
					onClose();
					onChooseOwner(wide ? { personId: account.personId } : { accountId: account.id });
				}}
				onCancel={onClose}
			>
				{SHARED.lastOwnerBody}
			</ConfirmDialog>
		);

	const words = wide
		? {
				title: SHARED.stopWideTitle(whose),
				confirm: SHARED.stopWideConfirm(whose),
				body: (
					<>
						{SHARED.stopWideBody(
							account.label,
							whose,
							siblings.map((a) => a.label),
						)}
						<Box component="span" sx={{ display: "block", mt: 1 }}>
							{SHARED.stopWideAfter(sharer)}
						</Box>
					</>
				),
			}
		: underneath
			? {
					title: SHARED.stepDownTitle(LEVEL_LABEL[account.myLevel], account.label),
					confirm: SHARED.stepDownConfirm(LEVEL_LABEL[account.myLevel]),
					body: SHARED.stepDownBody(account.label, whose, LEVEL_LABEL[underneath]),
				}
			: {
					title: SHARED.stopTitle(account.label),
					confirm: SHARED.stopConfirm,
					body: SHARED.stopBody(sharer),
				};

	return (
		<ConfirmDialog
			open={row !== null}
			tone="danger"
			icon={<IconLeave />}
			title={words.title}
			confirmLabel={words.confirm}
			cancelLabel={SHARED.keep}
			busy={busy}
			onConfirm={() => void confirm()}
			onCancel={onClose}
		>
			{words.body}
		</ConfirmDialog>
	);
};
