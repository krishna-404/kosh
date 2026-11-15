import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconOwner } from "@connected-repo/ui-mui/kosh/icons";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { HolderKind } from "@connected-repo/zod-schemas/enums.zod";
import { ADD_PERSON } from "@frontend/copy/accounts.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords, firstNameOf } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";
import { ChoiceRows } from "./ChoiceRows";

export interface AddedPerson {
	id: string;
	displayName: string;
	kind: HolderKind;
	isMe: boolean;
}

interface AddPersonDialogProps {
	open: boolean;
	onClose: () => void;
	/** "Add yourself": the name to start from. The new person is linked to whoever is signed in. */
	selfName?: string | null;
	onAdded: (person: AddedPerson) => void;
}

const KINDS: readonly HolderKind[] = ["login", "no_login", "huf"];

const ownerNote = (name: string, kind: HolderKind, self: boolean): string => {
	if (self) return ADD_PERSON.ownerNoteSelf;
	if (kind === "huf") return ADD_PERSON.ownerNoteHuf;
	const first = firstNameOf(name);
	return first ? ADD_PERSON.ownerNote(first) : ADD_PERSON.ownerNoteBlank;
};

/**
 * Add a holder: someone whose investments are tracked here. Whoever adds
 * them becomes their owner, and the dialog says so before the button does it.
 */
export const AddPersonDialog = ({ open, onClose, selfName, onAdded }: AddPersonDialogProps) => {
	const self = selfName !== undefined && selfName !== null;
	const formId = useId();
	const refresh = useRefreshPeople();
	const create = useMutation(orpc.portfolio.createPerson.mutationOptions());

	const [name, setName] = useState("");
	const [kind, setKind] = useState<HolderKind>("login");
	const [nameMissing, setNameMissing] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	// Each opening starts clean.
	useEffect(() => {
		if (!open) return;
		setName(selfName ?? "");
		setKind("login");
		setNameMissing(false);
		setFailure(null);
	}, [open, selfName]);

	const trimmed = name.trim();
	const first = kind === "huf" ? trimmed : firstNameOf(trimmed);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!trimmed) {
			setNameMissing(true);
			return;
		}
		setFailure(null);
		try {
			const person = { displayName: trimmed, kind: self ? ("login" as const) : kind, isMe: self };
			const { id } = await create.mutateAsync(person);
			await refresh();
			onAdded({ id, ...person });
			onClose();
		} catch (error) {
			setFailure(errorWords(error, ADD_PERSON.failed));
		}
	};

	return (
		<ResponsiveDialog
			open={open}
			onClose={onClose}
			title={self ? ADD_PERSON.titleSelf : ADD_PERSON.title}
			maxWidth="xs"
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={create.isPending}>
						{ADD_PERSON.cancel}
					</Button>
					<Button
						type="submit"
						form={formId}
						variant="contained"
						size="large"
						disabled={create.isPending}
					>
						{self ? ADD_PERSON.titleSelf : ADD_PERSON.submit(first)}
					</Button>
				</>
			}
		>
			<Box
				component="form"
				id={formId}
				noValidate
				onSubmit={submit}
				sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}
			>
				<TextField
					label={ADD_PERSON.name}
					placeholder={self ? undefined : ADD_PERSON.namePlaceholder}
					value={name}
					onChange={(event) => {
						setName(event.target.value);
						setNameMissing(false);
					}}
					error={nameMissing}
					helperText={
						nameMissing ? ADD_PERSON.nameMissing : self ? ADD_PERSON.nameSelfHelp : undefined
					}
					autoFocus
					fullWidth
					autoComplete="off"
					slotProps={{ htmlInput: { maxLength: 120 } }}
				/>
				{!self && (
					<ChoiceRows<HolderKind>
						label={ADD_PERSON.who}
						name="holder-kind"
						value={kind}
						onChange={setKind}
						options={KINDS.map((value) => ({ value, ...ADD_PERSON.kinds[value] }))}
					/>
				)}
				<Banner icon={<IconOwner fontSize="inherit" />}>{ownerNote(trimmed, kind, self)}</Banner>
				{failure && <Banner tone="bad">{failure}</Banner>}
			</Box>
		</ResponsiveDialog>
	);
};
