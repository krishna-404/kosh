import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconFile } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { UPLOAD } from "@frontend/copy/statements.copy";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { brokerNameOf } from "@frontend/modules/access/people.utils";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { AccountTodayCard } from "./components/AccountTodayCard";
import { AppliedActionsCard } from "./components/AppliedActionsCard";
import { HistoryCard } from "./components/HistoryCard";
import { QuestionsSection } from "./components/QuestionsSection";
import { UploadArea, type UploadAreaHandle } from "./components/UploadArea";
import { UploadPreviewDialog } from "./components/UploadPreviewDialog";
import { UploadsCard } from "./components/UploadsCard";
import { useUploads } from "./statements.queries";
import { canUploadTo } from "./statements.utils";
import { useStatementActions } from "./useStatementActions";
import { useUploadFlow } from "./useUploadFlow";

export interface StatementsTabProps {
	accountId: string;
	/** The caller can edit this account: upload, undo, answer. Without it the tab is read-only. */
	canEdit: boolean;
}

/**
 * "Statements and questions" for one account: where statements come in and
 * where Kosh asks about anything it is not sure of.
 *
 * - Questions waiting for an answer — until then the figures use Kosh's best
 *   guess, and say so.
 * - Upload → see what Kosh read → add it → undo. Nothing is saved before the
 *   person says so, and nothing is ever deleted: an undone upload stays in
 *   the list, marked as undone.
 * - How complete the history is, the splits and bonuses applied, and what
 *   the account is worth today.
 *
 * Someone who can only view sees all of it, without the buttons.
 * Opened with `?upload=1`, the upload area comes into view with the focus.
 */
export const StatementsTab = ({ accountId, canEdit }: StatementsTabProps) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	// Beside the sidebar, two columns need a wide window; in between it is one column of desktop pieces.
	const twoColumns = useMediaQuery(theme.breakpoints.up("lg"));
	const [params, setParams] = useSearchParams();

	const directory = useDirectory();
	const uploads = useUploads(accountId);
	const actions = useStatementActions();
	const area = useRef<UploadAreaHandle>(null);
	const questionsTop = useRef<HTMLDivElement>(null);
	// New questions appear above the upload area: after an upload that raised some, show them.
	const flow = useUploadFlow(accountId, actions, (raised) => {
		if (raised === 0) return;
		const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		questionsTop.current?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
	});

	const account = directory.data?.accounts.find((candidate) => candidate.id === accountId);
	// An account at "another broker" takes what Kosh can read; it has no broker name to ask for.
	const broker = account && account.broker !== "manual" ? brokerNameOf(account) : null;
	const readable = account ? canUploadTo(account.broker) : true;

	// Until the uploads are known, the area's place is not: it leads an account with none.
	const settled = !uploads.isPending && !directory.isPending;
	const lead = uploads.data?.length === 0;
	const hasStatements = uploads.data?.some((upload) => upload.status === "applied") ?? false;

	const focusUpload = () => area.current?.focus();

	// `?upload=1` — from "Upload statement" on the page — brings the area into view, once.
	const wantsUpload = params.get("upload") === "1";
	const areaReady = canEdit && settled;
	useEffect(() => {
		if (!wantsUpload || !areaReady) return;
		area.current?.focus();
		setParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.delete("upload");
				return next;
			},
			{ replace: true },
		);
	}, [wantsUpload, areaReady, setParams]);

	const uploadArea = !canEdit ? null : settled ? (
		<UploadArea
			ref={area}
			broker={broker}
			readable={readable}
			variant={lead ? "lead" : "aside"}
			phone={phone}
			busy={flow.state.step === "reading" || flow.busy !== null}
			onFile={flow.choose}
		/>
	) : (
		<Skeleton variant="rounded" height={phone ? 52 : 168} sx={{ borderRadius: 2.25 }} />
	);
	// Nothing to look at and nothing the person may add.
	const nothingHere = lead && !canEdit && (
		<SectionCard>
			<EmptyState icon={<IconFile />} title={UPLOAD.empty.title}>
				{UPLOAD.empty.readOnly}
			</EmptyState>
		</SectionCard>
	);

	const questions = (
		// Clear of the bar that stays at the top of a phone when scrolled to.
		<Box ref={questionsTop} sx={{ scrollMarginTop: "88px", "&:empty": { display: "none" } }}>
			<QuestionsSection
				accountId={accountId}
				canEdit={canEdit}
				phone={phone}
				hasUploads={hasStatements}
				actions={actions}
				onUpload={focusUpload}
			/>
		</Box>
	);
	const uploadsCard = <UploadsCard accountId={accountId} canEdit={canEdit} actions={actions} atFirst={phone ? 3 : 5} />;
	const history = <HistoryCard accountId={accountId} />;
	const splits = <AppliedActionsCard accountId={accountId} canEdit={canEdit} actions={actions} />;
	const dialog = canEdit && (
		<UploadPreviewDialog flow={flow} broker={broker} onChooseAnother={() => area.current?.open()} />
	);

	const column = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 } as const;

	// One column, in the phone board's order: the questions, the uploads, then the way to upload.
	if (!twoColumns)
		return (
			<Box sx={column}>
				{lead && uploadArea}
				{nothingHere}
				{questions}
				{uploadsCard}
				{!lead && uploadArea}
				{history}
				{splits}
				<AccountTodayCard accountId={accountId} />
				{dialog}
			</Box>
		);

	// Wide: questions and the record on the left; uploading, the uploads and today's figures on the right.
	return (
		<Box sx={{ display: "flex", alignItems: "flex-start", gap: 2.5 }}>
			<Box sx={{ ...column, flex: 1, gap: 1.75 }}>
				{lead && uploadArea}
				{nothingHere}
				{questions}
				{history}
				{splits}
			</Box>
			<Box component="aside" sx={{ ...column, width: 360, flex: "none" }}>
				{!lead && uploadArea}
				{uploadsCard}
				<AccountTodayCard accountId={accountId} />
			</Box>
			{dialog}
		</Box>
	);
};
