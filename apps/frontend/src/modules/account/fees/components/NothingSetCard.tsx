import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconBank, IconLock } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { FEES } from "@frontend/copy/fees.copy";

interface NothingSetCardProps {
	/** The caller is an owner of the account. */
	canChange: boolean;
	/** The last day an earlier arrangement was charged, when one has stopped. */
	lastStopped: string | null;
	onSet: () => void;
}

/**
 * No fee is set: a quiet card that says so, says the one thing people get
 * wrong — a fee the broker takes inside the account is already counted —
 * and gives an owner the way to set one. Anyone else is told who can.
 */
export const NothingSetCard = ({ canChange, lastStopped, onSet }: NothingSetCardProps) => (
	<SectionCard>
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-start",
				gap: 2,
				"@container (min-width: 560px)": { flexDirection: "row" },
			}}
		>
			<SpotIcon>
				<IconBank />
			</SpotIcon>
			<Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
				<Typography variant="h3" component="h2">
					{lastStopped ? FEES.none.titleNow : FEES.none.title}
				</Typography>
				{lastStopped && <Typography variant="body2">{FEES.none.stopped(formatDate(lastStopped))}</Typography>}
				<Typography variant="body2" sx={{ maxWidth: 620 }}>
					{FEES.none.body}
				</Typography>
				{canChange ? (
					<Button
						variant="contained"
						onClick={onSet}
						sx={{ mt: 0.75, width: "100%", "@container (min-width: 480px)": { width: "auto" } }}
					>
						{FEES.none.set}
					</Button>
				) : (
					<Typography
						variant="body2"
						sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25, fontWeight: 600 }}
					>
						<IconLock aria-hidden sx={{ fontSize: 16, flex: "none" }} />
						{FEES.none.ownerOnly}
					</Typography>
				)}
			</Box>
		</Box>
	</SectionCard>
);
