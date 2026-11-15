import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconFile, IconUpload } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { UPLOAD } from "@frontend/copy/statements.copy";
import { type ChangeEvent, type DragEvent, type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ACCEPTED_FILES, readableBrokers } from "../statements.utils";
import { OwnLayoutHelp } from "./OwnLayoutHelp";

/** What the tab can ask of the upload area: come into view and take the focus. */
export interface UploadAreaHandle {
	focus: () => void;
	/** Open the file picker — only ever from a click, or the browser will not. */
	open: () => void;
}

interface UploadAreaProps {
	/** The account's broker by name ("Zerodha"); null for an account at "another broker". */
	broker: string | null;
	/** False for a broker whose statements Kosh has no reader for yet. */
	readable: boolean;
	/** `lead`: the account has no statements, so this is the first thing on the tab. */
	variant: "aside" | "lead";
	/** A phone has nothing to drop from: a button instead of a drop area. */
	phone: boolean;
	/** A file is being read or checked right now. */
	busy: boolean;
	onFile: (file: File) => void;
	ref?: Ref<UploadAreaHandle>;
}

const hasFiles = (event: { dataTransfer: DataTransfer | null }): boolean =>
	Boolean(event.dataTransfer?.types.includes("Files"));

/**
 * Where a statement comes in: drop it, or choose it. Nobody says what kind
 * of statement it is — Kosh works that out and shows what it read before
 * anything is saved.
 */
export const UploadArea = ({ broker, readable, variant, phone, busy, onFile, ref }: UploadAreaProps) => {
	const snack = useSnack();
	const root = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);
	const input = useRef<HTMLInputElement>(null);
	const [over, setOver] = useState(false);

	useImperativeHandle(
		ref,
		() => ({
			focus: () => {
				const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
				root.current?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
				button.current?.focus({ preventScroll: true });
			},
			open: () => input.current?.click(),
		}),
		[],
	);

	// A file dropped beside the area would otherwise replace the page with the file.
	useEffect(() => {
		const keep = (event: globalThis.DragEvent) => {
			if (hasFiles(event)) event.preventDefault();
		};
		window.addEventListener("dragover", keep);
		window.addEventListener("drop", keep);
		return () => {
			window.removeEventListener("dragover", keep);
			window.removeEventListener("drop", keep);
		};
	}, []);

	// Kosh has no reader for this broker's own files: its own layout is the way in.
	const ownLayout = readable ? (
		<OwnLayoutHelp lead={UPLOAD.ownLayout.another} />
	) : (
		<Banner tone="info" title={UPLOAD.notRead.title(broker ?? "")}>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				{UPLOAD.notRead.body(readableBrokers())}
				<OwnLayoutHelp />
			</Box>
		</Banner>
	);

	const take = (files: FileList | null) => {
		const file = files?.[0];
		if (!file) return;
		if (files.length > 1) snack(UPLOAD.oneAtATime);
		onFile(file);
	};
	const onPick = (event: ChangeEvent<HTMLInputElement>) => {
		take(event.target.files);
		// So the same file can be chosen again after a cancel.
		event.target.value = "";
	};
	const onDrop = (event: DragEvent) => {
		if (!hasFiles(event)) return;
		event.preventDefault();
		setOver(false);
		if (!busy) take(event.dataTransfer.files);
	};

	const formats = broker ? UPLOAD.formats : UPLOAD.formatsReadAs(readableBrokers());
	const picker = (
		<input ref={input} type="file" hidden accept={ACCEPTED_FILES} onChange={onPick} tabIndex={-1} aria-hidden />
	);
	const open = () => input.current?.click();

	if (phone)
		return (
			<Box ref={root} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				{picker}
				{variant === "lead" && (
					<SectionCard>
						<EmptyState icon={<IconFile />} title={UPLOAD.empty.title} sx={{ py: 3, px: 0 }}>
							{UPLOAD.empty.body(broker ?? readableBrokers())}
						</EmptyState>
					</SectionCard>
				)}
				<Button
					ref={button}
					variant="contained"
					size="large"
					fullWidth
					startIcon={<IconUpload />}
					onClick={open}
					disabled={busy}
				>
					{UPLOAD.button}
				</Button>
				<Typography variant="caption" sx={{ textAlign: "center" }}>
					{formats}
				</Typography>
				{ownLayout}
			</Box>
		);

	const lead = variant === "lead";
	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
		<Box
			ref={root}
			onDragEnter={(event) => hasFiles(event) && setOver(true)}
			onDragOver={(event) => hasFiles(event) && setOver(true)}
			onDragLeave={(event) => {
				// Leaving for a child is not leaving.
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
			}}
			onDrop={onDrop}
			sx={(theme) => ({
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 1,
				p: lead ? { md: 6 } : "22px",
				textAlign: "center",
				border: `2px dashed ${over ? theme.vars.palette.kosh.accent : theme.vars.palette.kosh.line2}`,
				borderRadius: "18px",
				bgcolor: over ? theme.vars.palette.kosh.accentSoft : theme.vars.palette.kosh.surface,
				transition: theme.transitions.create(["background-color", "border-color"], { duration: 200 }),
			})}
		>
			{picker}
			<Box
				aria-hidden
				sx={(theme) => ({
					display: "grid",
					color: theme.vars.palette.kosh.accentText,
					"& svg": { fontSize: lead ? 40 : 28 },
				})}
			>
				<IconUpload />
			</Box>
			{lead && (
				<>
					<Typography variant="h2">{UPLOAD.empty.title}</Typography>
					<Typography color="text.secondary" sx={{ maxWidth: 460 }}>
						{UPLOAD.empty.body(broker ?? readableBrokers())}
					</Typography>
				</>
			)}
			<Typography variant="subtitle2" component="div" sx={lead ? { mt: 1.5 } : undefined} aria-live="polite">
				{over ? UPLOAD.dropNow : UPLOAD.drop(broker)}
			</Typography>
			<Typography variant="caption">{formats}</Typography>
			<Button
				ref={button}
				variant={lead ? "contained" : "outlined"}
				size={lead ? "large" : "medium"}
				onClick={open}
				disabled={busy}
				sx={{ mt: 0.5 }}
			>
				{UPLOAD.choose}
			</Button>
		</Box>
		{ownLayout}
		</Box>
	);
};
