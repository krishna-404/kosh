import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { radii } from "../theme/tokens";

interface KoshMarkProps {
	/** Edge length in px. */
	size?: number;
	sx?: SxProps<Theme>;
}

/** The Kosh mark: a stack of three coins, sunshine on Kosh green. */
export const KoshMark = ({ size = 38, sx }: KoshMarkProps) => (
	<Box
		aria-hidden
		sx={[
			(theme) => ({
				width: size,
				height: size,
				flex: "none",
				display: "grid",
				placeItems: "center",
				borderRadius: `${Math.round((size * radii.mark) / 42)}px`,
				bgcolor: theme.vars.palette.kosh.accent,
				color: theme.vars.palette.kosh.sun,
				...theme.applyStyles("dark", { bgcolor: theme.vars.palette.kosh.accentSoft }),
			}),
			...(Array.isArray(sx) ? sx : [sx]),
		]}
	>
		<svg
			viewBox="0 0 24 24"
			width={size * 0.58}
			height={size * 0.58}
			fill="currentColor"
			role="presentation"
		>
			<rect x="3.5" y="15" width="17" height="4.5" rx="2.25" />
			<rect x="6" y="9.25" width="12" height="4.5" rx="2.25" />
			<rect x="8.5" y="3.5" width="7" height="4.5" rx="2.25" />
		</svg>
	</Box>
);

/** Mark plus the word "Kosh". */
export const KoshWordmark = ({ size = 38 }: { size?: number }) => (
	<Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
		<KoshMark size={size} />
		<Box
			component="span"
			sx={(theme) => ({
				fontFamily: theme.typography.h1.fontFamily,
				fontWeight: 700,
				fontSize: size * 0.6,
				letterSpacing: "-0.04em",
				lineHeight: 1,
			})}
		>
			Kosh
		</Box>
	</Box>
);
