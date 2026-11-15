import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { LinearProgress } from "@connected-repo/ui-mui/feedback/LinearProgress";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconAdd, IconAlert, IconCheck, IconCopy, IconHelp } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Tag, type TagTone } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { StatementPreview } from "@connected-repo/zod-schemas/kosh/statements.zod";
import { UPLOAD } from "@frontend/copy/statements.copy";
import { type ReactNode, useEffect, useState } from "react";
import {
	isUsableDay,
	type PreviewFact,
	previewFacts,
	previewHeadline,
	problemWords,
	todayIso,
} from "../statements.utils";
import type { UploadFlow, UploadStep } from "../useUploadFlow";

interface UploadPreviewDialogProps {
	flow: UploadFlow;
	/** The account's broker by name, for "what to try"; null when it is "another broker". */
	broker: string | null;
	/** Open the file picker again. */
	onChooseAnother: () => void;
}

type Row = StatementPreview["rows"][number];

const ROWS_AT_FIRST = 5;

const FACT_ICON: Record<PreviewFact["key"], ReactNode> = {
	new: <IconAdd />,
	duplicate: <IconCopy />,
	questions: <IconHelp />,
	error: <IconAlert />,
};

const ROW_TONE: Record<Row["status"], TagTone> = { new: "new", duplicate: "neutral", question: "pending" };

/** One sentence about the file's lines, with a small picture of which kind it is. */
const Fact = ({ fact }: { fact: PreviewFact }) => (
	<Box component="li" sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
		<Box
			aria-hidden
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				return {
					display: "grid",
					pt: "1px",
					color: fact.tone === "bad" ? k.dangerText : fact.tone === "ask" ? k.sunText : k.accentText,
					"& svg": { fontSize: 18 },
				};
			}}
		>
			{fact.key === "questions" && fact.tone === "plain" ? <IconCheck /> : FACT_ICON[fact.key]}
		</Box>
		<Typography component="span">{fact.text}</Typography>
	</Box>
);

/** One line of the file: what it says, when, how much, and what will happen to it. */
const PreviewRow = ({ row, signed }: { row: Row; signed: boolean }) => (
	<Box component="li" sx={{ display: "flex", flexDirection: "column", gap: 0.5, px: 1.75, py: 1.25 }}>
		<Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
			<Typography component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
				{row.text}
			</Typography>
			{row.amount !== null && (
				<Money
					value={row.amount}
					decimals={2}
					sign={signed ? "always" : "auto"}
					spacedSign={signed}
					sx={{ fontWeight: 600 }}
				/>
			)}
		</Box>
		<Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
			{row.date && (
				<Typography variant="caption" component="span">
					{formatDate(row.date)}
				</Typography>
			)}
			<Tag tone={ROW_TONE[row.status]}>{UPLOAD.rowStatus[row.status]}</Tag>
		</Box>
	</Box>
);

/** The first few lines as Kosh read them, each with what will happen to it; the rest on request. */
const PreviewRows = ({ preview }: { preview: StatementPreview }) => {
	const [all, setAll] = useState(false);
	if (preview.rows.length === 0) return null;
	const total = preview.rows.length + preview.moreRows;
	const shown = all ? preview.rows : preview.rows.slice(0, ROWS_AT_FIRST);
	// Ledger lines carry their direction; a trade's amount is just its value.
	const signed = preview.detected?.kind === "ledger";
	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
			<Typography variant="subtitle2" component="h3">
				{UPLOAD.rowsTitle}
			</Typography>
			<Box
				component="ul"
				sx={(theme) => ({
					m: 0,
					p: 0,
					listStyle: "none",
					border: `1px solid ${theme.vars.palette.kosh.line}`,
					borderRadius: "14px",
					"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
				})}
			>
				{shown.map((row, index) => (
					// A file can list the same reference twice; its place in the file tells them apart.
					<PreviewRow key={`${row.ref}:${index}`} row={row} signed={signed} />
				))}
			</Box>
			{all && preview.moreRows > 0 && <Typography variant="caption">{UPLOAD.moreRows(preview.moreRows)}</Typography>}
			{preview.rows.length > ROWS_AT_FIRST && (
				<Button variant="text" onClick={() => setAll((was) => !was)} sx={{ alignSelf: "flex-start" }}>
					{all ? UPLOAD.showFewerRows : UPLOAD.showAllRows(total)}
				</Button>
			)}
		</Box>
	);
};

/** What the statement is and what adding it would do — shared by every verdict that got that far. */
const WhatKoshRead = ({ preview }: { preview: StatementPreview }) => {
	const headline = previewHeadline(preview);
	const facts = previewFacts(preview.summary, preview.detected?.kind ?? null);
	if (!headline && facts.length === 0) return null;
	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
			{headline && (
				<Typography variant="subtitle1" component="p" sx={{ m: 0 }}>
					{headline}
				</Typography>
			)}
			{facts.length > 0 && (
				<Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0.75 }}>
					{facts.map((fact) => (
						<Fact key={fact.key} fact={fact} />
					))}
				</Box>
			)}
		</Box>
	);
};

/** The lines that could not be read, each with the reason the reader gave. */
const Errors = ({ preview }: { preview: StatementPreview }) =>
	preview.errors.length === 0 ? null : (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
			<Typography variant="subtitle2" component="h3">
				{UPLOAD.errorsTitle}
			</Typography>
			<Box component="ul" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
				{preview.errors.map((error) => (
					<Typography component="li" variant="body2" key={`${error.row}:${error.message}`} sx={{ overflowWrap: "anywhere" }}>
						{UPLOAD.errorRow(error.row, error.message)}
					</Typography>
				))}
			</Box>
			{preview.summary.error > preview.errors.length && (
				<Typography variant="caption">{UPLOAD.moreRows(preview.summary.error - preview.errors.length)}</Typography>
			)}
		</Box>
	);

/**
 * What Kosh read from a chosen file, before anything is saved: the kind of
 * statement, the dates it covers, how many lines are new, already in or to
 * be asked about, and any it could not read. Then "Add N lines" or Cancel.
 * A file that cannot go in gets the reason and what to try instead.
 */
export const UploadPreviewDialog = ({ flow, broker, onChooseAnother }: UploadPreviewDialogProps) => {
	const { state, busy, applyError } = flow;
	// The last file stays on screen while the dialog closes.
	const [shown, setShown] = useState<UploadStep>(state);
	useEffect(() => {
		if (state.step !== "idle") setShown(state);
	}, [state]);

	const open = state.step !== "idle";
	const another = (
		<Button
			variant="contained"
			onClick={() => {
				flow.close();
				onChooseAnother();
			}}
		>
			{UPLOAD.chooseAnother}
		</Button>
	);
	const closeButton = (label: string) => (
		<Button variant="text" onClick={flow.close} disabled={busy === "adding"}>
			{label}
		</Button>
	);

	if (shown.step === "idle") return null;

	if (shown.step === "reading")
		return (
			<ResponsiveDialog
				open={open}
				onClose={flow.close}
				title={UPLOAD.reading(shown.fileName)}
				subtitle={UPLOAD.nothingSavedYet}
				actions={closeButton(UPLOAD.cancel)}
			>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }} role="status">
					<LinearProgress aria-label={UPLOAD.reading(shown.fileName)} />
					<Typography variant="body2">{UPLOAD.readingBody}</Typography>
				</Box>
			</ResponsiveDialog>
		);

	if (shown.step === "failed")
		return (
			<ResponsiveDialog
				open={open}
				onClose={flow.close}
				title={UPLOAD.failedTitle}
				subtitle={shown.fileName}
				actions={
					<>
						{closeButton(UPLOAD.close)}
						{another}
					</>
				}
			>
				<Banner tone="bad">{shown.message}</Banner>
			</ResponsiveDialog>
		);

	const { preview } = shown;
	const problem = problemWords(preview, broker);
	const { needsDate } = shown;

	// It can go in — or it can once the day it is for is known.
	if (preview.canApply || needsDate) {
		const dayGiven = isUsableDay(shown.asOf);
		const dayBad = shown.asOf !== "" && !dayGiven;
		return (
			<ResponsiveDialog
				open={open}
				onClose={flow.close}
				title={preview.canApply ? UPLOAD.previewTitle : UPLOAD.problemTitle.needs_date}
				subtitle={`${shown.fileName} · ${UPLOAD.nothingSavedYet}`}
				actions={
					<>
						{closeButton(UPLOAD.cancel)}
						<Button
							variant="contained"
							size="large"
							onClick={flow.apply}
							disabled={!preview.canApply || busy !== null || (needsDate && !dayGiven)}
						>
							{busy === "adding" ? UPLOAD.adding : UPLOAD.add(preview.summary.new)}
						</Button>
					</>
				}
			>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
					<WhatKoshRead preview={preview} />
					{needsDate && (
						<TextField
							label={UPLOAD.dateLabel}
							type="date"
							value={shown.asOf}
							onChange={(event) => flow.setAsOf(event.target.value)}
							error={dayBad}
							helperText={
								dayGiven ? UPLOAD.dateHelper : `${UPLOAD.dateWhy} ${UPLOAD.dateNeeded}`
							}
							disabled={busy === "adding"}
							slotProps={{ htmlInput: { max: todayIso() } }}
							sx={{ maxWidth: 320 }}
						/>
					)}
					{busy === "checking" && <LinearProgress aria-label={UPLOAD.reading(shown.fileName)} />}
					<PreviewRows preview={preview} />
					{applyError && <Banner tone="bad">{applyError}</Banner>}
				</Box>
			</ResponsiveDialog>
		);
	}

	// It cannot go in: say why, show what was read all the same, and what to try.
	const code = preview.problem?.code;
	const tone = code === "already_uploaded" || code === "nothing_new" ? "info" : code === "has_errors" ? "bad" : "warn";
	return (
		<ResponsiveDialog
			open={open}
			onClose={flow.close}
			title={problem?.title ?? UPLOAD.failedTitle}
			subtitle={shown.fileName}
			actions={
				<>
					{closeButton(UPLOAD.close)}
					{another}
				</>
			}
		>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
				<Banner tone={tone}>{problem?.body}</Banner>
				{code === "has_errors" && (
					<>
						{/* Nothing from this file goes in, so nothing here says "will be added". */}
						<Typography variant="subtitle1" component="p" sx={{ m: 0 }}>
							{previewHeadline(preview)}
						</Typography>
						<Errors preview={preview} />
					</>
				)}
				{problem?.tryThis && <Typography variant="body2">{problem.tryThis}</Typography>}
			</Box>
		</ResponsiveDialog>
	);
};
