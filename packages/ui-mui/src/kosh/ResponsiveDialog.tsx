import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { type ReactNode, useId } from "react";
import { radii } from "../theme/tokens";
import { SpotIcon } from "./EmptyState";
import { IconClose } from "./icons";

interface ResponsiveDialogProps {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	subtitle?: ReactNode;
	children?: ReactNode;
	/** Buttons at the bottom; on a phone they stack full-width. */
	actions?: ReactNode;
	maxWidth?: "xs" | "sm" | "md" | "lg";
	/** Hide the close button (the dialog still closes on Escape / backdrop). */
	hideClose?: boolean;
}

/**
 * A dialog on desktop, a bottom sheet on a phone — same content, same
 * focus handling. Every overlay in Kosh goes through this.
 */
export const ResponsiveDialog = ({
	open,
	onClose,
	title,
	subtitle,
	children,
	actions,
	maxWidth = "sm",
	hideClose = false,
}: ResponsiveDialogProps) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("sm"));
	const titleId = useId();

	const header = (
		<Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 3, pt: phone ? 1 : 3 }}>
			<Box sx={{ flex: 1, minWidth: 0, pt: 0.5 }}>
				<Typography id={titleId} variant="h2">
					{title}
				</Typography>
				{subtitle && (
					<Typography variant="body2" sx={{ mt: 0.5 }}>
						{subtitle}
					</Typography>
				)}
			</Box>
			{!hideClose && (
				<IconButton aria-label="Close" onClick={onClose} sx={{ mr: -1.5, mt: -0.5 }}>
					<IconClose />
				</IconButton>
			)}
		</Box>
	);
	const body = <Box sx={{ px: 3, py: 2, overflowY: "auto", flex: 1, minHeight: 0 }}>{children}</Box>;
	const footer = actions && (
		<Box
			sx={{
				display: "flex",
				flexDirection: phone ? "column-reverse" : "row",
				justifyContent: "flex-end",
				gap: 1,
				px: 3,
				pb: 3,
				pt: 1,
				"& > *": phone ? { width: "100%" } : undefined,
			}}
		>
			{actions}
		</Box>
	);

	if (phone) {
		return (
			<Drawer
				anchor="bottom"
				open={open}
				onClose={onClose}
				slotProps={{
					paper: {
						role: "dialog",
						"aria-modal": true,
						"aria-labelledby": titleId,
						sx: {
							borderRadius: `${radii.sheet}px ${radii.sheet}px 0 0`,
							maxHeight: "92dvh",
							display: "flex",
							flexDirection: "column",
						},
					},
				}}
			>
				<Box
					aria-hidden
					sx={(t) => ({
						width: 44,
						height: 5,
						borderRadius: 3,
						bgcolor: t.vars.palette.kosh.line2,
						mx: "auto",
						mt: 1.25,
						mb: 0.5,
						flex: "none",
					})}
				/>
				{header}
				{body}
				{footer}
			</Drawer>
		);
	}
	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth} aria-labelledby={titleId}>
			{header}
			{body}
			{footer}
		</Dialog>
	);
};

interface ConfirmDialogProps {
	open: boolean;
	title: ReactNode;
	/** What will happen, in a sentence or two. */
	children?: ReactNode;
	/** The verb, never "OK": "Remove Ramesh", "Undo upload". */
	confirmLabel: string;
	cancelLabel?: string;
	tone?: "default" | "danger";
	/** A picture for the decision (key, alert…). */
	icon?: ReactNode;
	busy?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/** A yes/no decision. The confirm button names what it does. */
export const ConfirmDialog = ({
	open,
	title,
	children,
	confirmLabel,
	cancelLabel = "Cancel",
	tone = "default",
	icon,
	busy = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) => (
	<ResponsiveDialog
		open={open}
		onClose={onCancel}
		maxWidth="xs"
		hideClose
		title={
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
				{icon && <SpotIcon tone={tone === "danger" ? "warn" : "accent"}>{icon}</SpotIcon>}
				<span>{title}</span>
			</Box>
		}
		actions={
			<>
				<Button variant="text" onClick={onCancel} disabled={busy}>
					{cancelLabel}
				</Button>
				<Button
					variant="contained"
					color={tone === "danger" ? "error" : "primary"}
					onClick={onConfirm}
					disabled={busy}
				>
					{confirmLabel}
				</Button>
			</>
		}
	>
		{children && <Typography color="text.secondary">{children}</Typography>}
	</ResponsiveDialog>
);
