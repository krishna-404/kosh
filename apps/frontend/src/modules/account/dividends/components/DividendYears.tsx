import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Collapse } from "@connected-repo/ui-mui/feedback/Collapse";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { ButtonBase } from "@connected-repo/ui-mui/form/ButtonBase";
import { IconAdd, IconChevronDown, IconClock } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { useId } from "react";
import { type DividendYear, paiseShown } from "../dividends.utils";
import { DividendRow, type RowHandlers } from "./DividendRow";
import { headingAreas, rowGrid } from "./rowGrid";

interface YearSectionProps {
	year: DividendYear<Dividend>;
	open: boolean;
	onToggle: () => void;
	handlers?: RowHandlers;
	compact: boolean;
	busy: boolean;
}

/** One financial year: a heading that opens and closes it, with its total, then its dividends. */
const YearSection = ({ year, open, onToggle, handlers, compact, busy }: YearSectionProps) => {
	const headingId = useId();
	const listId = useId();
	const withActions = handlers !== undefined;
	const counts = [
		D.list.count(year.dividends.length),
		// On a phone the tag's words join this line instead of taking a line of their own.
		...(compact && year.toConfirm > 0 ? [D.list.toConfirm(year.toConfirm)] : []),
		...(year.notReceived > 0 ? [D.list.notReceived(year.notReceived)] : []),
	];

	return (
		<Box component="section" aria-labelledby={headingId} sx={(theme) => ({ borderTop: `1px solid ${theme.vars.palette.kosh.line}` })}>
			<Typography variant="subtitle2" component="h3" sx={{ m: 0 }}>
				<ButtonBase
					id={headingId}
					aria-expanded={open}
					aria-controls={open ? listId : undefined}
					onClick={onToggle}
					sx={[
						rowGrid(withActions),
						headingAreas(withActions),
						(theme) => ({
							width: "100%",
							minHeight: 56,
							py: 1,
							textAlign: "left",
							font: "inherit",
							bgcolor: theme.vars.palette.kosh.surface2,
							transition: theme.transitions.create("background-color", { duration: 200 }),
							"&:hover": { bgcolor: theme.vars.palette.kosh.accentSoft },
							"&.Mui-focusVisible": { outline: `2px solid ${theme.vars.palette.kosh.accent}`, outlineOffset: -2 },
						}),
					]}
				>
					<Box sx={{ gridArea: "name", display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
						<Box
							aria-hidden
							sx={(theme) => ({
								display: "grid",
								flex: "none",
								width: 22,
								ml: -0.5,
								color: theme.vars.palette.kosh.ink2,
								transform: open ? "none" : "rotate(-90deg)",
								transition: theme.transitions.create("transform", { duration: 200 }),
								"& svg": { fontSize: 22 },
							})}
						>
							<IconChevronDown />
						</Box>
						{D.list.year(year.label)}
					</Box>
					{/* Under the label, clear of the arrow. */}
					<Typography variant="caption" component="span" sx={{ gridArea: "facts", pl: "26px", minWidth: 0 }}>
						{counts.join(" · ")}
					</Typography>
					{!compact && (
						<Box sx={{ gridArea: "state", display: "flex" }}>
							{year.toConfirm > 0 && (
								<Tag tone="pending" icon={<IconClock />}>
									{D.list.toConfirm(year.toConfirm)}
								</Tag>
							)}
						</Box>
					)}
					<Box sx={{ gridArea: "amount", textAlign: "right" }}>
						<Box component="span" sx={visuallyHidden}>{`${D.list.yearTotal} `}</Box>
						<Money value={year.total} decimals={paiseShown(year.total)} sx={{ fontWeight: 700 }} />
					</Box>
				</ButtonBase>
			</Typography>
			<Collapse in={open} unmountOnExit>
				<Box
					component="ul"
					id={listId}
					sx={(theme) => ({
						m: 0,
						p: 0,
						listStyle: "none",
						"& > li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
					})}
				>
					{year.dividends.map((dividend) => (
						<DividendRow key={dividend.id} dividend={dividend} handlers={handlers} compact={compact} busy={busy} />
					))}
				</Box>
			</Collapse>
		</Box>
	);
};

const visuallyHidden = {
	position: "absolute",
	width: "1px",
	height: "1px",
	overflow: "hidden",
	clip: "rect(0 0 0 0)",
	whiteSpace: "nowrap",
} as const;

interface DividendYearsProps {
	years: readonly DividendYear<Dividend>[];
	/** Which years are open, by the year they start in. */
	isOpen: (startYear: number) => boolean;
	onToggle: (startYear: number) => void;
	/** Absent for someone who cannot answer. */
	handlers?: RowHandlers;
	onAdd?: () => void;
	compact: boolean;
	busy: boolean;
}

/**
 * Every dividend, newest first, a financial year at a time. The latest year
 * starts open and the earlier ones closed, each showing its total and how
 * many still wait — so forty rows read as four lines until one is opened.
 */
export const DividendYears = ({ years, isOpen, onToggle, handlers, onAdd, compact, busy }: DividendYearsProps) => (
	<SectionCard title={D.list.title} subtitle={D.list.subtitle} padding="none" sx={{ overflow: "hidden" }}>
		<Box sx={{ mt: 0.75 }}>
			{years.map((year) => (
				<YearSection
					key={year.startYear}
					year={year}
					open={isOpen(year.startYear)}
					onToggle={() => onToggle(year.startYear)}
					handlers={handlers}
					compact={compact}
					busy={busy}
				/>
			))}
		</Box>
		{onAdd && (
			<Box
				sx={(theme) => ({
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					justifyContent: "space-between",
					columnGap: 2,
					rowGap: 1,
					px: { xs: 2, md: 2.5 },
					py: 1.5,
					borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
				})}
			>
				<Typography variant="body2">{D.add.prompt}</Typography>
				<Button
					variant="outlined"
					startIcon={<IconAdd />}
					onClick={onAdd}
					disabled={busy}
					sx={{ width: { xs: "100%", sm: "auto" } }}
				>
					{D.add.open}
				</Button>
			</Box>
		)}
	</SectionCard>
);
