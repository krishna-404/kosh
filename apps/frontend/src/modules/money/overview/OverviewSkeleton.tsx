import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Box } from "@connected-repo/ui-mui/layout/Box";

const card = { borderRadius: 2.5 };

interface OverviewSkeletonProps {
	phone: boolean;
	wide: boolean;
}

/** The page's shape while the figures load: the hero, how the money moved, the two lists, the groups. */
export const OverviewSkeleton = ({ phone, wide }: OverviewSkeletonProps) =>
	phone ? (
		<>
			<Skeleton variant="rounded" height={124} sx={card} />
			<Skeleton variant="rounded" height={52} sx={card} />
			<Skeleton variant="rounded" height={216} sx={card} />
			<Skeleton variant="rounded" height={232} sx={card} />
		</>
	) : (
		<>
			<Skeleton variant="rounded" height={wide ? 152 : 204} sx={card} />
			<Skeleton variant="rounded" height={wide ? 372 : 236} sx={card} />
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: wide ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
					gap: 2.25,
				}}
			>
				<Skeleton variant="rounded" height={214} sx={card} />
				<Skeleton variant="rounded" height={214} sx={card} />
			</Box>
			<Skeleton variant="rounded" height={232} sx={card} />
		</>
	);
