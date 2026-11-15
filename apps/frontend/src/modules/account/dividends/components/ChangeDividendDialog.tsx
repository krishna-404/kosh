import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { type FormEvent, useId, useState } from "react";
import {
	amountRefusal,
	isDay,
	isRefusal,
	parseAmount,
	rupees,
	scriptName,
	sharesTimesPrice,
	todayIso,
	typedAmount,
	workedOutAmount,
} from "../dividends.utils";
import type { DividendAnswer, Outcome } from "../useDividendActions";
import { AmountAndDay } from "./AmountAndDay";

interface ChangeDividendDialogProps {
	open: boolean;
	/** The dividend being answered. The dialog starts from what is counted for it now. */
	dividend: Dividend;
	onClose: () => void;
	onSave: (dividend: Dividend, answer: DividendAnswer) => Promise<Outcome>;
}

/** What Kosh worked out, for reference beside what the person types. */
const Working = ({ dividend }: { dividend: Dividend }) => {
	const sentence = sharesTimesPrice(dividend);
	const worked = workedOutAmount(dividend);
	return (
		<Box
			sx={(theme) => ({
				display: "flex",
				flexDirection: "column",
				gap: 0.25,
				p: 1.75,
				borderRadius: "12px",
				bgcolor: theme.vars.palette.kosh.surface2,
			})}
		>
			<Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
				{D.change.workingTitle}
			</Typography>
			{sentence && worked && (
				<Typography variant="subtitle2" component="div" sx={{ fontVariantNumeric: "tabular-nums" }}>
					{D.change.working(sentence, rupees(worked))}
				</Typography>
			)}
			<Typography variant="body2" component="div">
				{D.exDate(formatDate(dividend.exDate))}
			</Typography>
			{dividend.announcement && (
				<Typography variant="body2" component="div" sx={{ overflowWrap: "anywhere" }}>
					{D.announcement(dividend.announcement)}
				</Typography>
			)}
		</Box>
	);
};

/**
 * "The amount is different": what really arrived, and the day it did, with
 * Kosh's working alongside. The server decides whether the day can be right
 * (not before the ex-date, not in the future) and its words are shown as is.
 */
export const ChangeDividendDialog = ({ open, dividend, onClose, onSave }: ChangeDividendDialogProps) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("sm"));
	const formId = useId();
	const added = dividend.source === "person";
	const [amount, setAmount] = useState(() => typedAmount(dividend.amount));
	const [receivedOn, setReceivedOn] = useState(dividend.receivedOn);
	const [problem, setProblem] = useState<{ amount?: string; date?: string; other?: string }>({});
	const [saving, setSaving] = useState(false);

	const parsed = parseAmount(amount);
	const usable = parsed !== null && Number(parsed) > 0 ? parsed : null;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (saving) return;
		const amountProblem =
			parsed === null
				? D.change.amountInvalid
				: usable === null
					? added
						? D.change.amountZeroAdded
						: D.change.amountZero
					: undefined;
		const dateProblem = isDay(receivedOn) ? undefined : D.change.dateMissing;
		if (usable === null || amountProblem || dateProblem) return setProblem({ amount: amountProblem, date: dateProblem });

		setSaving(true);
		const outcome = await onSave(dividend, { amount: usable, receivedOn });
		setSaving(false);
		if (outcome.ok) return onClose();

		// The server's own words, beside the field they are about when that is plain.
		const words = errorWords(outcome.error, D.change.failed);
		const aboutAmount = amountRefusal(outcome.error);
		const dayIsOff = receivedOn > todayIso() || (!added && receivedOn < dividend.exDate);
		if (aboutAmount) setProblem({ amount: aboutAmount });
		else if (isRefusal(outcome.error) && dayIsOff) setProblem({ date: words });
		else setProblem({ other: words });
	};

	return (
		<ResponsiveDialog
			open={open}
			onClose={saving ? () => undefined : onClose}
			maxWidth="xs"
			title={added ? D.change.titleAdded : D.change.title}
			subtitle={
				added
					? D.change.subtitleAdded(scriptName(dividend))
					: D.change.subtitle(scriptName(dividend), formatDate(dividend.exDate))
			}
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={saving}>
						{D.change.cancel}
					</Button>
					<Button type="submit" form={formId} variant="contained" disabled={saving}>
						{usable === null
							? added
								? D.change.saveAdded
								: D.change.save
							: added
								? D.change.saveAddedAmount(rupees(usable))
								: D.change.saveAmount(rupees(usable))}
					</Button>
				</>
			}
		>
			<Box
				component="form"
				id={formId}
				noValidate
				onSubmit={(event) => void submit(event)}
				sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}
			>
				{!added && <Working dividend={dividend} />}
				<AmountAndDay
					amount={amount}
					onAmount={(text) => {
						setAmount(text);
						setProblem((was) => ({ ...was, amount: undefined, other: undefined }));
					}}
					amountProblem={problem.amount}
					receivedOn={receivedOn}
					onReceivedOn={(date) => {
						setReceivedOn(date);
						setProblem((was) => ({ ...was, date: undefined, other: undefined }));
					}}
					dateProblem={problem.date}
					dateHelper={added ? D.change.dateHelperAdded : D.change.dateHelper(formatDate(dividend.exDate))}
					earliest={added ? undefined : dividend.exDate}
					disabled={saving}
					focusAmount={!phone}
				/>
				{problem.other && <Banner tone="bad">{problem.other}</Banner>}
			</Box>
		</ResponsiveDialog>
	);
};
