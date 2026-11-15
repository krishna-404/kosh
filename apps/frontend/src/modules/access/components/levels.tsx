import { Button } from "@connected-repo/ui-mui/form/Button";
import { IconChevronDown, IconEdit, IconOwner, IconView } from "@connected-repo/ui-mui/kosh/icons";
import { LEVEL_LABEL } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { ACCESS_LEVEL_ENUM, type AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import { LEVEL_SUMMARY } from "@frontend/copy/levels.copy";
import type { MouseEvent, ReactNode } from "react";
import type { MenuAction } from "./ActionMenu";

/** The three levels, lowest first. */
export const LEVELS: readonly AccessLevel[] = ACCESS_LEVEL_ENUM;

export const levelRank = (level: AccessLevel): number => LEVELS.indexOf(level);

export const levelIcon = (level: AccessLevel, fontSize?: "small"): ReactNode =>
	({
		view: <IconView fontSize={fontSize} />,
		edit: <IconEdit fontSize={fontSize} />,
		owner: <IconOwner fontSize={fontSize} />,
	})[level];

/**
 * The three levels as menu choices, each with its one-line summary.
 * `floor` is a level they already have from somewhere wider (the holder):
 * that level and anything below it is shown but cannot be picked here.
 */
export const levelChoices = ({
	current,
	onPick,
	floor,
	floorHint,
}: {
	current: AccessLevel;
	onPick: (level: AccessLevel) => void;
	floor?: AccessLevel;
	floorHint?: string;
}): MenuAction[] =>
	LEVELS.map((level) => {
		const blocked = floor !== undefined && levelRank(level) <= levelRank(floor);
		return {
			key: level,
			label: LEVEL_LABEL[level],
			icon: levelIcon(level),
			hint: blocked && level === floor && floorHint ? floorHint : LEVEL_SUMMARY[level],
			checked: level === current,
			disabled: blocked && level !== current,
			onSelect: () => {
				if (level !== current) onPick(level);
			},
		};
	});

interface LevelMenuButtonProps {
	level: AccessLevel;
	/** Says whose level this is and that it opens choices. */
	ariaLabel: string;
	open: boolean;
	onClick: (event: MouseEvent<HTMLElement>) => void;
}

/** A level that can be changed: the level's icon and words, and a chevron. */
export const LevelMenuButton = ({ level, ariaLabel, open, onClick }: LevelMenuButtonProps) => (
	<Button
		variant="outlined"
		aria-label={ariaLabel}
		aria-haspopup="menu"
		aria-expanded={open}
		onClick={onClick}
		startIcon={levelIcon(level)}
		endIcon={<IconChevronDown />}
		sx={{ flex: "none", px: 1.5, gap: 0.75 }}
	>
		{LEVEL_LABEL[level]}
	</Button>
);
