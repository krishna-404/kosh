import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { radii, sizes } from "../theme/tokens";
import { IconEdit, IconOwner, IconView } from "./icons";

/** What someone may do with an account, lowest to highest. */
export type AccessLevelName = "view" | "edit" | "owner";

/** The only words Kosh uses for the three levels. */
export const LEVEL_LABEL: Record<AccessLevelName, string> = {
	view: "Can view",
	edit: "Can edit",
	owner: "Owner",
};

const LEVEL_ICON = { view: IconView, edit: IconEdit, owner: IconOwner } as const;

interface LevelBadgeProps {
	level: AccessLevelName;
	size?: "md" | "lg";
	/** Replaces the level's words — e.g. a count ("3") in a compact summary. */
	label?: ReactNode;
	sx?: SxProps<Theme>;
}

/**
 * The level sticker: outline for view, sunshine for edit, solid ink for
 * owner. The same three looks everywhere a level appears, so a level is
 * recognised by shape and colour before it is read.
 */
export const LevelBadge = ({ level, size = "md", label, sx }: LevelBadgeProps) => {
	const Icon = LEVEL_ICON[level];
	const large = size === "lg";
	return (
		<Box
			component="span"
			data-level={level}
			aria-label={label === undefined ? undefined : `${LEVEL_LABEL[level]}: ${label}`}
			sx={[
				(theme) => {
					const k = theme.vars.palette.kosh;
					const look = {
						view: { bg: k.surface, fg: k.ink, edge: k.ink3 },
						edit: { bg: k.sunSoft, fg: k.sunText, edge: k.sunEdge },
						owner: { bg: k.ink, fg: k.surface, edge: k.ink },
					}[level];
					return {
						display: "inline-flex",
						alignItems: "center",
						gap: "6px",
						flex: "none",
						height: large ? sizes.badgeLarge : sizes.badge,
						padding: large ? "0 15px 0 12px" : "0 12px 0 9px",
						borderRadius: `${radii.pill}px`,
						border: `1.5px solid ${look.edge}`,
						bgcolor: look.bg,
						color: look.fg,
						fontSize: large ? "0.875rem" : "0.78125rem",
						fontWeight: 700,
						lineHeight: 1,
						whiteSpace: "nowrap",
						"& svg": { fontSize: large ? 17 : 15 },
					};
				},
				...(Array.isArray(sx) ? sx : [sx]),
			]}
		>
			<Icon aria-hidden />
			{label ?? LEVEL_LABEL[level]}
		</Box>
	);
};
