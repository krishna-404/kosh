import { SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconGroup } from "@connected-repo/ui-mui/kosh/icons";

/** The pastels a group's tile is drawn in, in the order groups were made. */
const TILES = ["sun", "mint", "sky", "lilac", "coral"] as const;

interface GroupTileProps {
	/** The group's place among the person's groups, oldest first: it keeps its colour when the order on screen changes. */
	index: number;
}

/** A group's folder on its own pastel tile — the same in both colour schemes, like a person's avatar. */
export const GroupTile = ({ index }: GroupTileProps) => {
	const tile = TILES[((index % TILES.length) + TILES.length) % TILES.length] ?? "sun";
	return (
		<SpotIcon
			size="sm"
			sx={(theme) => ({
				bgcolor: theme.vars.palette.kosh[tile],
				color: theme.vars.palette.kosh.avatarInk,
			})}
		>
			<IconGroup />
		</SpotIcon>
	);
};
