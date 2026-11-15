import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { initialsOf, stableIndex } from "../format/person";
import { avatarColors, radii } from "../theme/tokens";

/**
 * Who an avatar stands for decides its shape:
 * a circle is a person who signs in, a dashed circle a person with no login
 * (a child, a parent you manage), a rounded square an HUF.
 */
export type HolderKind = "login" | "no_login" | "huf";

const SIZE = {
	xs: { box: 26, font: "0.65625rem" },
	sm: { box: 34, font: "0.78125rem" },
	md: { box: 40, font: "0.90625rem" },
	lg: { box: 52, font: "1.1875rem" },
} as const;

interface HolderAvatarProps {
	name: string;
	/** Stable id used to pick the colour; falls back to the name. */
	colorKey?: string;
	kind?: HolderKind;
	size?: keyof typeof SIZE;
	/** Shown instead of initials (e.g. a mail icon for an invite). */
	children?: ReactNode;
	sx?: SxProps<Theme>;
}

export const HolderAvatar = ({
	name,
	colorKey,
	kind = "login",
	size = "md",
	children,
	sx,
}: HolderAvatarProps) => {
	const { box, font } = SIZE[size];
	const pastel = avatarColors[stableIndex(colorKey ?? name, avatarColors.length)];
	return (
		<Box
			aria-hidden
			sx={[
				(theme) => {
					const k = theme.vars.palette.kosh;
					const plain = children !== undefined;
					return {
						width: box,
						height: box,
						flex: "none",
						display: "grid",
						placeItems: "center",
						borderRadius: kind === "huf" ? `${radii.mark}px` : "50%",
						fontSize: font,
						fontWeight: 700,
						lineHeight: 1,
						...(kind === "no_login"
							? { border: `2px dashed ${k.ink3}`, color: k.ink }
							: plain
								? { bgcolor: k.surface2, color: k.ink2 }
								: { bgcolor: pastel, color: k.avatarInk }),
						"& svg": { fontSize: box * 0.5 },
					};
				},
				...(Array.isArray(sx) ? sx : [sx]),
			]}
		>
			{children ?? initialsOf(name)}
		</Box>
	);
};

interface AvatarStackProps {
	people: { id: string; name: string; kind?: HolderKind }[];
	/** How many faces to show before "+N". */
	max?: number;
}

/** Overlapping faces for "who has access", with a +N when there are more. */
export const AvatarStack = ({ people, max = 4 }: AvatarStackProps) => {
	const shown = people.slice(0, max);
	const extra = people.length - shown.length;
	return (
		<Box
			role="img"
			aria-label={people.map((p) => p.name).join(", ")}
			sx={(theme) => ({
				display: "flex",
				alignItems: "center",
				"& > *": {
					marginLeft: "-8px",
					boxShadow: `0 0 0 2px ${theme.vars.palette.kosh.surface}`,
				},
				"& > *:first-of-type": { marginLeft: 0 },
			})}
		>
			{shown.map((p) => (
				<HolderAvatar key={p.id} name={p.name} colorKey={p.id} kind={p.kind} size="xs" />
			))}
			{extra > 0 && (
				<HolderAvatar name={`+${extra}`} size="xs">
					{`+${extra}`}
				</HolderAvatar>
			)}
		</Box>
	);
};
