import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { InputAdornment } from "@connected-repo/ui-mui/form/InputAdornment";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconCalc } from "@connected-repo/ui-mui/kosh/icons";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { FEE_KINDS, type FeeKind, type FeeOverview } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { ChoiceRows } from "@frontend/modules/access/components/ChoiceRows";
import { useRefreshMoney } from "@frontend/modules/money/money.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";
import {
	type FeeForm,
	type FeeFormField,
	type FeeFormProblems,
	feeFormFrom,
	feeSetInput,
	howWorkedOut,
	isDay,
	percentToFraction,
	refusalWords,
	whatChangesWords,
} from "../fees.utils";

interface SetFeeDialogProps {
	open: boolean;
	onClose: () => void;
	overview: FeeOverview;
	today: string;
}

const KIND_OPTIONS = FEE_KINDS.map((kind) => ({
	value: kind,
	title: FEES.form.kinds[kind].title,
	hint: FEES.form.kinds[kind].hint,
}));

/** Every arrangement on the account: the one running (or coming) and the others. */
const arrangementsOf = (overview: FeeOverview) => [
	...(overview.arrangement ? [overview.arrangement] : []),
	...overview.earlier,
];

const percentSign = { input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } };
const decimalKeys = { inputMode: "decimal" } as const;

/**
 * Set what the manager is paid, or change it from a day: the kind, then only
 * the fields that kind needs, who is paid, and the day it starts. A rate is
 * typed as a percentage ("1.5") and sent as the fraction the API takes.
 * Before saving it says what happens to the arrangement already there, and
 * if the server refuses, its own words are shown.
 */
export const SetFeeDialog = ({ open, onClose, overview, today }: SetFeeDialogProps) => {
	const formId = useId();
	const snack = useSnack();
	const refresh = useRefreshMoney();
	const set = useMutation(orpc.fees.set.mutationOptions());

	// What was there when the dialog opened. It is held still while the dialog
	// is up — and while it closes after saving, when the overview has already
	// moved on — so the title and the note do not change under the reader.
	const [existing, setExisting] = useState(() => arrangementsOf(overview));
	const [current, setCurrent] = useState(overview.arrangement);
	const [form, setForm] = useState<FeeForm>(() => feeFormFrom(overview.arrangement, today));
	const [problems, setProblems] = useState<FeeFormProblems>({});
	const [failure, setFailure] = useState<string | null>(null);

	// Start from what is there each time it opens. (Only on opening: a refetch
	// while it is open must not wipe what has been typed.)
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on opening only
	useEffect(() => {
		if (!open) return;
		setExisting(arrangementsOf(overview));
		setCurrent(overview.arrangement);
		setForm(feeFormFrom(overview.arrangement, today));
		setProblems({});
		setFailure(null);
	}, [open]);

	const change = <Field extends keyof FeeForm>(field: Field, value: FeeForm[Field]) => {
		setForm((was) => ({ ...was, [field]: value }));
		setProblems((was) => ({ ...was, [field]: undefined }));
	};
	const fieldId = (field: FeeFormField) => `${formId}-${field}`;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const built = feeSetInput(overview.account.id, form);
		if (!built.ok) {
			setProblems(built.problems);
			const first = (["rate", "amount", "share", "hurdle", "startsOn"] as const).find((f) => built.problems[f]);
			if (first) document.getElementById(fieldId(first))?.focus();
			return;
		}
		setFailure(null);
		try {
			await set.mutateAsync(built.input);
			await refresh();
			snack(
				current
					? FEES.form.doneChange(overview.account.label, formatDate(built.input.startsOn))
					: FEES.form.doneSet(overview.account.label),
			);
			onClose();
		} catch (error) {
			setFailure(refusalWords(error, FEES.form.failed));
		}
	};

	const note = whatChangesWords(existing, form.startsOn);
	const busy = set.isPending;
	// The hurdle's own sentence appears once a hurdle has been typed.
	const typedHurdle = percentToFraction(form.hurdle, { allowZero: true });

	return (
		<ResponsiveDialog
			open={open}
			onClose={onClose}
			title={current ? FEES.form.titleChange : FEES.form.titleSet}
			subtitle={FEES.form.subtitle(overview.account.label)}
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={busy}>
						{FEES.cancel}
					</Button>
					<Button type="submit" form={formId} variant="contained" size="large" disabled={busy}>
						{busy ? FEES.form.saving : current ? FEES.form.submitChange : FEES.form.submitSet}
					</Button>
				</>
			}
		>
			<Box
				component="form"
				id={formId}
				noValidate
				onSubmit={submit}
				sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}
			>
				<ChoiceRows<FeeKind>
					label={FEES.form.kindLabel}
					name={`${formId}-kind`}
					value={form.kind}
					onChange={(kind) => change("kind", kind)}
					options={KIND_OPTIONS}
				/>

				{form.kind === "percent_of_assets" && (
					<TextField
						id={fieldId("rate")}
						label={FEES.form.rate}
						value={form.rate}
						onChange={(event) => change("rate", event.target.value)}
						error={Boolean(problems.rate)}
						helperText={problems.rate ?? FEES.form.rateHelper}
						autoComplete="off"
						slotProps={{ ...percentSign, htmlInput: decimalKeys }}
						sx={{ maxWidth: 240 }}
					/>
				)}
				{form.kind === "fixed" && (
					<TextField
						id={fieldId("amount")}
						label={FEES.form.amount}
						value={form.amount}
						onChange={(event) => change("amount", event.target.value)}
						error={Boolean(problems.amount)}
						helperText={problems.amount ?? FEES.form.amountHelper}
						autoComplete="off"
						slotProps={{
							input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
							htmlInput: decimalKeys,
						}}
						sx={{ maxWidth: 240 }}
					/>
				)}
				{form.kind === "profit_share" && (
					<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 2 }}>
						<TextField
							id={fieldId("share")}
							label={FEES.form.share}
							value={form.share}
							onChange={(event) => change("share", event.target.value)}
							error={Boolean(problems.share)}
							helperText={problems.share ?? FEES.form.shareHelper}
							autoComplete="off"
							slotProps={{ ...percentSign, htmlInput: decimalKeys }}
							sx={{ flex: "1 1 200px" }}
						/>
						<TextField
							id={fieldId("hurdle")}
							label={FEES.form.hurdle}
							value={form.hurdle}
							onChange={(event) => change("hurdle", event.target.value)}
							error={Boolean(problems.hurdle)}
							helperText={problems.hurdle ?? FEES.form.hurdleHelper}
							autoComplete="off"
							slotProps={{ ...percentSign, htmlInput: decimalKeys }}
							sx={{ flex: "1 1 200px" }}
						/>
					</Box>
				)}

				<Typography variant="body2" sx={{ display: "flex", gap: 1 }}>
					<IconCalc aria-hidden sx={{ fontSize: 18, flex: "none", mt: "1px" }} />
					<span>
						{howWorkedOut({ kind: form.kind, hurdleRate: typedHurdle.ok ? typedHurdle.value : null }).join(" ")}
					</span>
				</Typography>

				<TextField
					label={FEES.form.payee}
					value={form.payee}
					onChange={(event) => change("payee", event.target.value)}
					helperText={FEES.form.payeeHelper}
					autoComplete="off"
					fullWidth
					slotProps={{ htmlInput: { maxLength: 120 } }}
				/>

				<Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5 }}>
					<TextField
						id={fieldId("startsOn")}
						label={FEES.form.startsOn}
						type="date"
						value={form.startsOn}
						onChange={(event) => change("startsOn", event.target.value)}
						error={Boolean(problems.startsOn)}
						helperText={problems.startsOn ?? FEES.form.startsOnHelper}
						fullWidth
					/>
					{current && current.startsOn !== form.startsOn && (
						<Button variant="text" onClick={() => change("startsOn", current.startsOn)} sx={{ ml: -2.5 }}>
							{FEES.form.fromStart(formatDate(current.startsOn))}
						</Button>
					)}
				</Box>

				{note && isDay(form.startsOn) && <Banner tone="info">{note}</Banner>}
				{failure && <Banner tone="bad">{failure}</Banner>}
			</Box>
		</ResponsiveDialog>
	);
};
