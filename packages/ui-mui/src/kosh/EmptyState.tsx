import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

const SPOT = {
	sm: { box: 40, radius: 13, icon: 22 },
	md: { box: 56, radius: 18, icon: 28 },
	lg: { box: 88, radius: 28, icon: 44 },
} as const;

interface SpotIconProps {
	children: ReactNode;
	size?: keyof typeof SPOT;
	tone?: "accent" | "warn";
	sx?: SxProps<Theme>;
}

/** An icon on a soft tile — the picture for an empty state or a notice. */
export const SpotIcon = ({ children, size = "md", tone = "accent", sx }: SpotIconProps) => {
	const s = SPOT[size];
	return (
		<Box
			aria-hidden
			sx={[
				(theme) => {
					const k = theme.vars.palette.kosh;
					return {
						width: s.box,
						height: s.box,
						flex: "none",
						display: "grid",
						placeItems: "center",
						borderRadius: `${s.radius}px`,
						bgcolor: tone === "warn" ? k.sunSoft : k.accentSoft,
						color: tone === "warn" ? k.sunText : k.accentText,
						"& svg": { fontSize: s.icon },
					};
				},
				...(Array.isArray(sx) ? sx : [sx]),
			]}
		>
			{children}
		</Box>
	);
};

interface EmptyStateProps {
	icon: ReactNode;
	title: ReactNode;
	/** One or two sentences: what belongs here and how it gets here. */
	children?: ReactNode;
	/** Buttons, primary first. */
	actions?: ReactNode;
	tone?: "accent" | "warn";
	sx?: SxProps<Theme>;
}

/** What a screen shows before it has anything to show. */
export const EmptyState = ({ icon, title, children, actions, tone, sx }: EmptyStateProps) => (
	<Box
		sx={[
			{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				textAlign: "center",
				gap: 1.5,
				px: 3,
				py: { xs: 5, md: 7 },
			},
			...(Array.isArray(sx) ? sx : [sx]),
		]}
	>
		<SpotIcon size="lg" tone={tone}>
			{icon}
		</SpotIcon>
		<Typography variant="h2" sx={{ mt: 1 }}>
			{title}
		</Typography>
		{children && (
			<Typography color="text.secondary" sx={{ maxWidth: 460 }}>
				{children}
			</Typography>
		)}
		{actions && (
			<Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.25, mt: 1 }}>
				{actions}
			</Box>
		)}
	</Box>
);
