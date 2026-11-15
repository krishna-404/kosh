import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useHoldings } from "@frontend/modules/money/money.queries";
import { type FormEvent, useId, useMemo, useState } from "react";
import { amountRefusal, isDay, isRefusal, parseAmount, payingScripts, rupees, scriptName, todayIso } from "../dividends.utils";
import type { DividendAnswer, Outcome } from "../useDividendActions";
import { AmountAndDay } from "./AmountAndDay";

interface RecordDividendDialogProps {
	open: boolean;
	accountId: string;
	onClose: () => void;
	onSave: (script: { instrumentId: string; name: string }, answer: DividendAnswer) => Promise<Outcome>;
}

/**
 * "Add a dividend Kosh missed": one the exchange's announcements did not
 * carry. The script is chosen from what this account holds or has held —
 * the only scripts a dividend here could have come from.
 */
export const RecordDividendDialog = ({ open, accountId, onClose, onSave }: RecordDividendDialogProps) => {
	const formId = useId();
	const holdings = useHoldings({ kind: "account", id: accountId }, true);
	const scripts = useMemo(() => payingScripts(holdings.data?.holdings ?? []), [holdings.data]);
	const [instrumentId, setInstrumentId] = useState("");
	const [amount, setAmount] = useState("");
	const [receivedOn, setReceivedOn] = useState("");
	const [problem, setProblem] = useState<{ script?: string; amount?: string; date?: string; other?: string }>({});
	const [saving, setSaving] = useState(false);

	const script = scripts.find((s) => s.instrumentId === instrumentId);
	const parsed = parseAmount(amount);
	const usable = parsed !== null && Number(parsed) > 0 ? parsed : null;
	const ready = holdings.data !== undefined && scripts.length > 0;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (saving) return;
		const scriptProblem = script ? undefined : D.add.scriptMissing;
		const amountProblem = parsed === null ? D.change.amountInvalid : usable === null ? D.add.amountZero : undefined;
		const dateProblem = isDay(receivedOn) ? undefined : D.change.dateMissing;
		if (!script || usable === null || dateProblem)
			return setProblem({ script: scriptProblem, amount: amountProblem, date: dateProblem });

		setSaving(true);
		const outcome = await onSave(
			{ instrumentId: script.instrumentId, name: scriptName(script) },
			{ amount: usable, receivedOn },
		);
		setSaving(false);
		if (outcome.ok) return onClose();

		// The server's own words, beside the field they are about when that is plain.
		const words = errorWords(outcome.error, D.add.failed);
		const aboutAmount = amountRefusal(outcome.error);
		if (aboutAmount) setProblem({ amount: aboutAmount });
		else if (isRefusal(outcome.error) && receivedOn > todayIso()) setProblem({ date: words });
		else setProblem({ other: words });
	};

	return (
		<ResponsiveDialog
			open={open}
			onClose={saving ? () => undefined : onClose}
			maxWidth="xs"
			title={D.add.title}
			subtitle={D.add.subtitle}
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={saving}>
						{D.change.cancel}
					</Button>
					{ready && (
						<Button type="submit" form={formId} variant="contained" disabled={saving}>
							{usable === null ? D.add.save : D.add.saveAmount(rupees(usable))}
						</Button>
					)}
				</>
			}
		>
			{holdings.data === undefined ? (
				holdings.isError ? (
					<Banner
						tone="bad"
						action={
							<Button variant="outlined" onClick={() => void holdings.refetch()}>
								{D.retry}
							</Button>
						}
					>
						{errorWords(holdings.error, D.add.scriptsFailed)}
					</Banner>
				) : (
					<Box aria-busy sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
						<Skeleton variant="rounded" height={72} />
						<Skeleton variant="rounded" height={72} />
						<Skeleton variant="rounded" height={72} />
					</Box>
				)
			) : scripts.length === 0 ? (
				// Allowed, but nothing to add it to: say why rather than show an empty list.
				<Banner tone="info">{D.add.noScripts}</Banner>
			) : (
				<Box
					component="form"
					id={formId}
					noValidate
					onSubmit={(event) => void submit(event)}
					sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}
				>
					<TextField
						select
						label={D.add.scriptLabel}
						value={instrumentId}
						onChange={(event) => {
							setInstrumentId(event.target.value);
							setProblem((was) => ({ ...was, script: undefined, other: undefined }));
						}}
						error={problem.script !== undefined}
						helperText={problem.script ?? D.add.scriptHelper}
						disabled={saving}
						fullWidth
						slotProps={{
							select: {
								displayEmpty: true,
								renderValue: () =>
									script ? (
										scriptName(script)
									) : (
										<Box component="span" sx={(theme) => ({ color: theme.vars.palette.kosh.ink3 })}>
											{D.add.scriptPlaceholder}
										</Box>
									),
								MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } },
							},
							formHelperText: { role: problem.script ? "alert" : undefined },
						}}
					>
						{scripts.map((s) => (
							<MenuItem key={s.instrumentId} value={s.instrumentId}>
								<Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
									{scriptName(s)}
								</Box>
								{s.sold && (
									<Typography variant="caption" component="span">
										{D.add.sold}
									</Typography>
								)}
							</MenuItem>
						))}
					</TextField>
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
						dateHelper={D.change.dateHelperAdded}
						disabled={saving}
					/>
					{problem.other && <Banner tone="bad">{problem.other}</Banner>}
				</Box>
			)}
		</ResponsiveDialog>
	);
};
