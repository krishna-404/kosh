import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { radii, sizes } from "../theme/tokens";

export type TagTone = "neutral" | "pending" | "new" | "bad";

interface TagProps {
	tone?: TagTone;
	icon?: ReactNode;
	children: ReactNode;
	sx?: SxProps<Theme>;
}

/** A small status label: "Invited", "New", "Not signed in yet". */
export const Tag = ({ tone = "neutral", icon, children, sx }: TagProps) => (
	<Box
		component="span"
		sx={[
			(theme) => {
				const k = theme.vars.palette.kosh;
				const look = {
					neutral: { bg: k.surface2, fg: k.ink2 },
					pending: { bg: k.sunSoft, fg: k.sunText },
					new: { bg: k.accentSoft, fg: k.accentText },
					bad: { bg: k.coralSoft, fg: k.dangerText },
				}[tone];
				return {
					display: "inline-flex",
					alignItems: "center",
					gap: "5px",
					flex: "none",
					height: sizes.tag,
					padding: "0 10px",
					borderRadius: `${radii.pill}px`,
					bgcolor: look.bg,
					color: look.fg,
					fontSize: "0.75rem",
					fontWeight: 650,
					lineHeight: 1,
					whiteSpace: "nowrap",
					"& svg": { fontSize: 13 },
				};
			},
			...(Array.isArray(sx) ? sx : [sx]),
		]}
	>
		{icon}
		{children}
	</Box>
);
