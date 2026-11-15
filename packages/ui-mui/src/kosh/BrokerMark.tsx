import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { radii } from "../theme/tokens";

interface BrokerMarkProps {
	/** The broker's name; its first letter is shown. */
	broker: string;
	size?: number;
	sx?: SxProps<Theme>;
}

/** The square tile that stands for a broker account. */
export const BrokerMark = ({ broker, size = 38, sx }: BrokerMarkProps) => (
	<Box
		aria-hidden
		sx={[
			(theme) => ({
				width: size,
				height: size,
				flex: "none",
				display: "grid",
				placeItems: "center",
				borderRadius: `${radii.mark}px`,
				border: `1px solid ${theme.vars.palette.kosh.line}`,
				bgcolor: theme.vars.palette.kosh.surface2,
				color: theme.vars.palette.kosh.ink2,
				fontFamily: theme.typography.h1.fontFamily,
				fontSize: size * 0.37,
				fontWeight: 800,
				lineHeight: 1,
			}),
			...(Array.isArray(sx) ? sx : [sx]),
		]}
	>
		{broker.trim().charAt(0).toUpperCase() || "?"}
	</Box>
);
