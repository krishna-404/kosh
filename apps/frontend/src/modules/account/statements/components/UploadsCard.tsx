import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconUndo } from "@connected-repo/ui-mui/kosh/icons";
import { ConfirmDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { RowItem } from "@connected-repo/ui-mui/kosh/RowItem";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Upload } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { STATEMENTS, UPLOADS } from "@frontend/copy/statements.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useEffect, useState } from "react";
import { useUploads } from "../statements.queries";
import { uploadLine } from "../statements.utils";
import type { StatementActions } from "../useStatementActions";
import { PlainList } from "./PlainList";

interface UploadsCardProps {
	accountId: string;
	canEdit: boolean;
	actions: StatementActions;
	/** How many to list before "Show all". */
	atFirst?: number;
}

/**
 * Every upload so far, newest first. Undo takes an upload's lines out as a
 * unit; the upload itself stays in the list, marked as undone — nothing is
 * ever deleted, and the same file can be uploaded again.
 */
export const UploadsCard = ({ accountId, canEdit, actions, atFirst = 5 }: UploadsCardProps) => {
	const uploads = useUploads(accountId);
	const [all, setAll] = useState(false);
	const [undoing, setUndoing] = useState<Upload | null>(null);
	// The upload being asked about stays in the dialog while it closes.
	const [asked, setAsked] = useState<Upload | null>(null);
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (undoing) setAsked(undoing);
	}, [undoing]);

	if (uploads.isPending) return <Skeleton variant="rounded" height={170} sx={{ borderRadius: 2.5 }} />;
	if (uploads.isError)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void uploads.refetch()}>
						{STATEMENTS.retry}
					</Button>
				}
			>
				{errorWords(uploads.error, UPLOADS.loadFailed)}
			</Banner>
		);
	if (uploads.data.length === 0) return null;

	const shown = all ? uploads.data : uploads.data.slice(0, atFirst);
	const confirm = async () => {
		if (!undoing) return;
		setBusy(true);
		await actions.undoUpload(undoing);
		setBusy(false);
		setUndoing(null);
	};

	return (
		<SectionCard title={UPLOADS.title} padding="none" sx={{ overflow: "hidden" }}>
			<PlainList>
				{shown.map((upload) => {
					const name = upload.fileName ?? UPLOADS.unnamed;
					const undone = upload.status === "retracted";
					return (
						<Box component="li" key={upload.batchId}>
							<RowItem
								sx={{ pl: 2.25, pr: 1, gap: 1 }}
								primary={
									undone ? (
										<Box component="span" sx={(theme) => ({ color: theme.vars.palette.kosh.ink3 })}>
											{name}
										</Box>
									) : (
										name
									)
								}
								secondary={
									<>
										{uploadLine(upload)}
										{/* Allowed at this level, but not for this upload: say why instead of hiding it. */}
										{canEdit && upload.undoBlocked && (
											<Box component="span" sx={{ display: "block", whiteSpace: "normal" }}>
												{upload.undoBlocked}
											</Box>
										)}
									</>
								}
								trailing={
									undone ? (
										<Tag sx={{ mr: 1 }}>{UPLOADS.undone}</Tag>
									) : canEdit && upload.canUndo ? (
										<Button
											variant="text"
											startIcon={<IconUndo />}
											aria-label={UPLOADS.undoLabel(name)}
											onClick={() => setUndoing(upload)}
											sx={{ px: 1.25 }}
										>
											{UPLOADS.undo}
										</Button>
									) : undefined
								}
							/>
						</Box>
					);
				})}
			</PlainList>
			{uploads.data.length > atFirst && (
				<Box sx={(theme) => ({ px: 1, py: 0.5, borderTop: `1px solid ${theme.vars.palette.kosh.line}` })}>
					<Button variant="text" onClick={() => setAll((was) => !was)}>
						{all ? UPLOADS.showFewer : UPLOADS.showAll(uploads.data.length)}
					</Button>
				</Box>
			)}
			<ConfirmDialog
				open={undoing !== null}
				icon={<IconUndo />}
				title={UPLOADS.confirmTitle(asked?.fileName ?? UPLOADS.unnamed)}
				confirmLabel={UPLOADS.confirm}
				cancelLabel={UPLOADS.keep}
				busy={busy}
				onConfirm={() => void confirm()}
				onCancel={() => setUndoing(null)}
			>
				{UPLOADS.confirmBody(asked?.added ?? 0)}
			</ConfirmDialog>
		</SectionCard>
	);
};
