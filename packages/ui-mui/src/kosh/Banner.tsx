import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo } from "./icons";

export type BannerTone = "info" | "warn" | "bad" | "good";

const SEVERITY = { info: "info", warn: "warning", bad: "error", good: "success" } as const;
const DEFAULT_ICON = {
	info: <IconInfo fontSize="inherit" />,
	warn: <IconAlert fontSize="inherit" />,
	bad: <IconAlert fontSize="inherit" />,
	good: <IconCheck fontSize="inherit" />,
};

interface BannerProps {
	tone?: BannerTone;
	/** Overrides the tone's icon; `false` shows none. */
	icon?: ReactNode | false;
	title?: ReactNode;
	/** A button on the right, e.g. "Remove now". */
	action?: ReactNode;
	children?: ReactNode;
	sx?: SxProps<Theme>;
}

/** An in-page note: what is happening and, if anything, what to do. */
export const Banner = ({ tone = "info", icon, title, action, children, sx }: BannerProps) => (
	<Alert
		severity={SEVERITY[tone]}
		icon={icon === undefined ? DEFAULT_ICON[tone] : icon}
		action={action}
		role={tone === "bad" ? "alert" : "status"}
		sx={sx}
	>
		{title && <AlertTitle>{title}</AlertTitle>}
		{children}
	</Alert>
);
