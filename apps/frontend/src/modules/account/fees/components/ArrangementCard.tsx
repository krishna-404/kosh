import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { IconCalc, IconClock, IconEdit, IconLock } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { FeeArrangement } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { arrangementSentence, howWorkedOut } from "../fees.utils";

interface ArrangementCardProps {
	arrangement: FeeArrangement;
	/** Changes already entered for a later day, soonest first. */
	upcoming: readonly FeeArrangement[];
	today: string;
	/** The caller is an owner of the account. */
	canChange: boolean;
	onChange: () => void;
	onStop: () => void;
}

/**
 * What the manager is paid, as a sentence a person would say, and how Kosh
 * works it out. An owner can change it or stop it; for everyone else those
 * are not there at all — only a line saying whose decision it is.
 */
export const ArrangementCard = ({
	arrangement,
	upcoming,
	today,
	canChange,
	onChange,
	onStop,
}: ArrangementCardProps) => {
	const notStarted = arrangement.startsOn > today;
	return (
		<SectionCard>
			<Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1.5 }}>
				<Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.75 }}>
					<Typography variant="eyebrow" component="h2">
						{FEES.title}
					</Typography>
					<Typography variant="h2" component="p" sx={{ textWrap: "balance" }}>
						{arrangementSentence(arrangement, today)}
					</Typography>
					{notStarted && (
						<Tag tone="pending" icon={<IconClock />}>
							{FEES.notStarted}
						</Tag>
					)}
					{upcoming.map((next) => (
						<Typography key={next.id} variant="body2" sx={{ display: "flex", gap: 0.75 }}>
							<IconClock aria-hidden sx={{ fontSize: 16, flex: "none", mt: "1px" }} />
							{FEES.next(arrangementSentence(next, today))}
						</Typography>
					))}
				</Box>

				<Typography variant="body2" sx={{ maxWidth: 680 }}>
					{FEES.outside}
				</Typography>

				<Box
					sx={(theme) => ({
						display: "flex",
						gap: 1.25,
						width: "100%",
						p: 1.75,
						borderRadius: "14px",
						bgcolor: theme.vars.palette.kosh.surface2,
					})}
				>
					<IconCalc
						aria-hidden
						sx={(theme) => ({ fontSize: 20, flex: "none", color: theme.vars.palette.kosh.ink2 })}
					/>
					<Box sx={{ minWidth: 0 }}>
						<Typography variant="subtitle2" component="h3">
							{FEES.howTitle}
						</Typography>
						<Typography variant="body2" sx={{ mt: 0.25, maxWidth: 680 }}>
							{howWorkedOut(arrangement).join(" ")}
						</Typography>
					</Box>
				</Box>

				{canChange ? (
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							alignItems: "stretch",
							gap: 1,
							width: "100%",
							"@container (min-width: 480px)": { flexDirection: "row", alignItems: "center", width: "auto" },
						}}
					>
						<Button variant="outlined" startIcon={<IconEdit />} onClick={onChange}>
							{FEES.change}
						</Button>
						<Button variant="text" onClick={onStop}>
							{FEES.stop}
						</Button>
					</Box>
				) : (
					<Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.75, fontWeight: 600 }}>
						<IconLock aria-hidden sx={{ fontSize: 16, flex: "none" }} />
						{FEES.ownerOnlyChange}
					</Typography>
				)}
			</Box>
		</SectionCard>
	);
};
