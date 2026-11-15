import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { IconCheck, IconClock } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { DividendList } from "@connected-repo/zod-schemas/kosh/income.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { paiseShown, rupees } from "../dividends.utils";

interface DividendsSummaryProps {
	data: DividendList;
	busy: boolean;
	/** "Confirm all as expected" — absent for someone who cannot answer. */
	onConfirmAll?: () => void;
}

/** "Nothing waiting — every dividend on this account has an answer." */
const NothingWaiting = () => (
	<Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
		<Box aria-hidden sx={(theme) => ({ display: "grid", color: theme.vars.palette.kosh.accentText, "& svg": { fontSize: 20 } })}>
			<IconCheck />
		</Box>
		<Typography variant="body2">
			<Typography component="b" variant="subtitle2" sx={{ color: "text.primary" }}>
				{D.nothingWaiting.title}
			</Typography>
			{` — ${D.nothingWaiting.body}`}
		</Typography>
	</Box>
);

/**
 * What the dividends come to in the return, and what is still only Kosh's
 * working. Someone who can answer gets the one primary action here —
 * confirm them all; someone who cannot is told who can.
 */
export const DividendsSummary = ({ data, busy, onConfirmAll }: DividendsSummaryProps) => {
	const waiting = data.toConfirm.count;
	const total = rupees(data.toConfirm.total);
	const leftOut = data.dividends.length - data.counted.count;
	const hint =
		data.counted.count === 0 ? (
			D.nothingCounted
		) : (
			<>
				{D.countedFrom(data.counted.count)}
				{leftOut > 0 && <Box component="span" sx={{ display: "block" }}>{D.leftOut(leftOut)}</Box>}
			</>
		);

	return (
		<SectionCard>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(240px, 0.75fr) minmax(0, 2fr)" },
					alignItems: "center",
					gap: { xs: 2, md: 3 },
				}}
			>
				<Stat
					size="lg"
					label={D.countedLabel}
					value={<Money value={data.counted.total} decimals={paiseShown(data.counted.total)} figure />}
					hint={hint}
				/>
				<Box
					sx={(theme) => ({
						minWidth: 0,
						display: "flex",
						flexDirection: "column",
						gap: 1.5,
						borderTop: { xs: `1px solid ${theme.vars.palette.kosh.line}`, md: "none" },
						borderLeft: { xs: "none", md: `1px solid ${theme.vars.palette.kosh.line}` },
						pt: { xs: 2, md: 0 },
						pl: { xs: 0, md: 3 },
					})}
				>
					{waiting === 0 ? (
						<NothingWaiting />
					) : onConfirmAll ? (
						<>
							<Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
								<BrokerMark broker="₹" size={36} />
								<Box sx={{ minWidth: 0 }}>
									<Typography variant="subtitle2" component="h2">
										{D.waiting.title(waiting)}
									</Typography>
									<Typography variant="body2">{D.waiting.body(waiting, total)}</Typography>
								</Box>
							</Box>
							<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
								<Button
									variant="contained"
									startIcon={<IconCheck />}
									disabled={busy}
									onClick={onConfirmAll}
									sx={{
										width: { xs: "100%", sm: "auto" },
										// The label is long: on a phone it gets the whole width, and a second
										// line on a narrow one rather than running off the card.
										whiteSpace: { xs: "normal", sm: "nowrap" },
										px: { xs: 1.5, sm: 2.5 },
										py: { xs: 1.25, sm: 0 },
										lineHeight: 1.25,
										"& .MuiButton-startIcon": { display: { xs: "none", sm: "inherit" } },
									}}
								>
									{D.waiting.confirmAll(waiting, total)}
								</Button>
							</Box>
						</>
					) : (
						<Banner tone="warn" icon={<IconClock fontSize="inherit" />} title={D.waiting.title(waiting)}>
							{`${D.whoCanAnswer} ${D.waiting.viewerBody}`}
						</Banner>
					)}
					{/* Told once: in the banner when something waits, as a quiet line when nothing does. */}
					{!onConfirmAll && waiting === 0 && <Typography variant="body2">{D.whoCanAnswer}</Typography>}
				</Box>
			</Box>
		</SectionCard>
	);
};
