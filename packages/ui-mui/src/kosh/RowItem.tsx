import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { sizes } from "../theme/tokens";

interface RowItemProps {
	/** Avatar, broker mark or icon at the left. */
	leading?: ReactNode;
	primary: ReactNode;
	secondary?: ReactNode;
	/** Figures, a level badge, a menu button — at the right. */
	trailing?: ReactNode;
	/** Makes the whole row a button. */
	onClick?: () => void;
	sx?: SxProps<Theme>;
}

const rowSx = {
	display: "flex",
	alignItems: "center",
	gap: 1.5,
	width: "100%",
	minHeight: sizes.row,
	px: 2,
	py: 1.25,
	textAlign: "left",
} as const;

/** One line of a list: who or what, a quiet second line, and what is true of it. */
export const RowItem = ({ leading, primary, secondary, trailing, onClick, sx }: RowItemProps) => {
	const body = (
		<>
			{leading}
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Typography component="div" variant="subtitle2" noWrap>
					{primary}
				</Typography>
				{secondary && (
					<Typography component="div" variant="caption" noWrap>
						{secondary}
					</Typography>
				)}
			</Box>
			{trailing}
		</>
	);
	const merged = [rowSx, ...(Array.isArray(sx) ? sx : [sx])];
	return onClick ? (
		<ButtonBase
			onClick={onClick}
			sx={[
				...merged,
				(theme) => ({
					"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
					transition: theme.transitions.create("background-color", { duration: 200 }),
				}),
			]}
		>
			{body}
		</ButtonBase>
	) : (
		<Box sx={merged}>{body}</Box>
	);
};

/** Stacks rows with a hairline between them. */
export const RowList = ({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) => (
	<Box
		sx={[
			(theme) => ({
				"& > * + *": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
			}),
			...(Array.isArray(sx) ? sx : [sx]),
		]}
	>
		{children}
	</Box>
);
