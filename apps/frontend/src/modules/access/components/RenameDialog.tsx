import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { RENAME } from "@frontend/copy/accounts.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";

/** What is being renamed: a person (holder) or one of their accounts. */
export type RenameSubject =
	| { kind: "person"; id: string; name: string }
	| { kind: "account"; id: string; name: string };

interface RenameDialogProps {
	/** Null means closed. */
	subject: RenameSubject | null;
	onClose: () => void;
}

/** Change what a person or an account is called in Kosh. Owners only. */
export const RenameDialog = ({ subject, onClose }: RenameDialogProps) => {
	const formId = useId();
	const snack = useSnack();
	const refresh = useRefreshPeople();
	const renamePerson = useMutation(orpc.portfolio.updatePerson.mutationOptions());
	const renameAccount = useMutation(orpc.portfolio.updateAccount.mutationOptions());
	const busy = renamePerson.isPending || renameAccount.isPending;

	// The last subject stays on screen while the dialog closes.
	const [shown, setShown] = useState(subject);
	const [name, setName] = useState("");
	const [missing, setMissing] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	useEffect(() => {
		if (!subject) return;
		setShown(subject);
		setName(subject.name);
		setMissing(false);
		setFailure(null);
	}, [subject]);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!subject) return;
		const next = name.trim();
		if (!next) return setMissing(true);
		if (next === subject.name) return onClose();
		setFailure(null);
		try {
			if (subject.kind === "person")
				await renamePerson.mutateAsync({ personId: subject.id, displayName: next });
			else await renameAccount.mutateAsync({ accountId: subject.id, label: next });
			await refresh();
			snack(RENAME.done(next));
			onClose();
		} catch (error) {
			setFailure(errorWords(error, RENAME.failed));
		}
	};

	return (
		<ResponsiveDialog
			open={subject !== null}
			onClose={onClose}
			title={RENAME.title(shown?.name ?? "")}
			maxWidth="xs"
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={busy}>
						{RENAME.cancel}
					</Button>
					<Button type="submit" form={formId} variant="contained" size="large" disabled={busy}>
						{RENAME.submit}
					</Button>
				</>
			}
		>
			<Box
				component="form"
				id={formId}
				noValidate
				onSubmit={submit}
				sx={{ display: "flex", flexDirection: "column", gap: 2 }}
			>
				<TextField
					label={shown?.kind === "account" ? RENAME.account : RENAME.person}
					value={name}
					onChange={(event) => {
						setName(event.target.value);
						setMissing(false);
					}}
					error={missing}
					helperText={missing ? RENAME.missing : undefined}
					autoFocus
					fullWidth
					autoComplete="off"
					slotProps={{ htmlInput: { maxLength: 120 } }}
				/>
				{failure && <Banner tone="bad">{failure}</Banner>}
			</Box>
		</ResponsiveDialog>
	);
};
