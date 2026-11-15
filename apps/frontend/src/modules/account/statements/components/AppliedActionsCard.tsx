import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconUndo } from "@connected-repo/ui-mui/kosh/icons";
import { ConfirmDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { RowItem } from "@connected-repo/ui-mui/kosh/RowItem";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { AppliedAction } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { QUESTIONS, SPLITS, STATEMENTS } from "@frontend/copy/statements.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useEffect, useState } from "react";
import { useAppliedActions } from "../statements.queries";
import { actionBy, actionLine, formatQuantity, ratioMark } from "../statements.utils";
import type { StatementActions } from "../useStatementActions";
import { PlainList } from "./PlainList";
import { QuestionMark } from "./QuestionCard";

interface AppliedActionsCardProps {
	accountId: string;
	canEdit: boolean;
	actions: StatementActions;
}

/**
 * The splits and bonuses standing on this account: when, what each did to
 * the quantity held, and who stands behind it. Undo takes one back — it then
 * returns as a question, so nothing is lost.
 */
export const AppliedActionsCard = ({ accountId, canEdit, actions }: AppliedActionsCardProps) => {
	const applied = useAppliedActions(accountId);
	const [undoing, setUndoing] = useState<AppliedAction | null>(null);
	// The one being asked about stays in the dialog while it closes.
	const [asked, setAsked] = useState<AppliedAction | null>(null);
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (undoing) setAsked(undoing);
	}, [undoing]);

	if (applied.isPending) return <Skeleton variant="rounded" height={150} sx={{ borderRadius: 2.5 }} />;
	if (applied.isError)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void applied.refetch()}>
						{STATEMENTS.retry}
					</Button>
				}
			>
				{errorWords(applied.error, SPLITS.loadFailed)}
			</Banner>
		);
	// An account no split or bonus has touched has nothing to say here.
	if (applied.data.length === 0) return null;

	const confirm = async () => {
		if (!undoing) return;
		setBusy(true);
		await actions.undoApplied(undoing);
		setBusy(false);
		setUndoing(null);
	};
	const noun = asked ? QUESTIONS.action.noun(asked.actionType) : "";
	const declined = asked?.state === "declined";

	return (
		<SectionCard title={SPLITS.title} subtitle={SPLITS.subtitle} padding="none" sx={{ overflow: "hidden" }}>
			<PlainList>
				{applied.data.map((action) => (
					<Box component="li" key={action.applicationId}>
						<RowItem
							sx={{ pl: 2.25, pr: 1, gap: 1.5 }}
							leading={<QuestionMark>{ratioMark(action.announcement) ?? action.symbol.charAt(0)}</QuestionMark>}
							primary={`${action.symbol} · ${action.announcement}`}
							secondary={
								<>
									{actionLine(action)}
									<Box component="span" sx={{ display: "block", whiteSpace: "normal" }}>
										{actionBy(action)}
									</Box>
								</>
							}
							trailing={
								// One left out of this account says so in its own line; it needs no second label.
								canEdit && action.canUndo ? (
									<Button
										variant="text"
										startIcon={<IconUndo />}
										aria-label={SPLITS.undoLabel(`${action.symbol} ${action.announcement}`)}
										onClick={() => setUndoing(action)}
										sx={{ px: 1.25 }}
									>
										{SPLITS.undo}
									</Button>
								) : undefined
							}
						/>
					</Box>
				))}
			</PlainList>
			<ConfirmDialog
				open={undoing !== null}
				icon={<IconUndo />}
				title={
					asked
						? (declined ? SPLITS.confirmDeclinedTitle : SPLITS.confirmTitle)(asked.symbol, noun)
						: ""
				}
				confirmLabel={declined ? SPLITS.confirmDeclined : SPLITS.confirm}
				cancelLabel={SPLITS.keep}
				busy={busy}
				onConfirm={() => void confirm()}
				onCancel={() => setUndoing(null)}
			>
				{asked &&
					(declined
						? SPLITS.confirmDeclinedBody
						: SPLITS.confirmBody(formatQuantity(asked.quantityBefore), formatDate(asked.exDate)))}
			</ConfirmDialog>
		</SectionCard>
	);
};
