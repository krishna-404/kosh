import { Button } from "@connected-repo/ui-mui/form/Button";
import { InputAdornment } from "@connected-repo/ui-mui/form/InputAdornment";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { FeeArrangement } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { useRefreshMoney } from "@frontend/modules/money/money.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";
import { amountProblemWords, amountWords, isDay, parseAmount, paymentCounted, refusalWords } from "../fees.utils";

interface AddPaymentDialogProps {
	open: boolean;
	onClose: () => void;
	account: { id: string; label: string };
	/** Who the invoice arrangement pays, when a name was given. */
	payee: string | null;
	/** Every arrangement on the account — to say when a payment would not be counted. */
	arrangements: readonly FeeArrangement[];
	today: string;
}

/** A fee actually paid, for an arrangement billed by invoice: the day, the amount, and a note. */
export const AddPaymentDialog = ({ open, onClose, account, payee, arrangements, today }: AddPaymentDialogProps) => {
	const formId = useId();
	const snack = useSnack();
	const refresh = useRefreshMoney();
	const add = useMutation(orpc.fees.addPayment.mutationOptions());

	const [paidOn, setPaidOn] = useState(today);
	const [amount, setAmount] = useState("");
	const [note, setNote] = useState("");
	const [problems, setProblems] = useState<{ paidOn?: string; amount?: string }>({});
	const [failure, setFailure] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on opening only
	useEffect(() => {
		if (!open) return;
		setPaidOn(today);
		setAmount("");
		setNote("");
		setProblems({});
		setFailure(null);
	}, [open]);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const parsed = parseAmount(amount);
		const wrong = {
			paidOn: !isDay(paidOn) ? FEES.payForm.dayMissing : paidOn > today ? FEES.payForm.dayAhead : undefined,
			amount: parsed.ok
				? undefined
				: parsed.problem === "empty"
					? FEES.payForm.amountMissing
					: amountProblemWords(parsed.problem),
		};
		if (!parsed.ok || wrong.paidOn) {
			setProblems(wrong);
			document.getElementById(`${formId}-${wrong.paidOn ? "paidOn" : "amount"}`)?.focus();
			return;
		}
		setFailure(null);
		try {
			const trimmed = note.trim();
			await add.mutateAsync({
				accountId: account.id,
				paidOn,
				amount: parsed.value,
				...(trimmed ? { note: trimmed } : {}),
			});
			await refresh();
			snack(FEES.payForm.done(amountWords(parsed.value)));
			onClose();
		} catch (error) {
			setFailure(refusalWords(error, FEES.payForm.failed));
		}
	};

	const busy = add.isPending;
	const outside = isDay(paidOn) && paidOn <= today && !paymentCounted({ paidOn }, arrangements);

	return (
		<ResponsiveDialog
			open={open}
			onClose={onClose}
			maxWidth="xs"
			title={payee ? FEES.payForm.titleTo(payee) : FEES.payForm.title}
			subtitle={FEES.payForm.subtitle(account.label)}
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={busy}>
						{FEES.cancel}
					</Button>
					<Button type="submit" form={formId} variant="contained" size="large" disabled={busy}>
						{FEES.payForm.submit}
					</Button>
				</>
			}
		>
			<Box
				component="form"
				id={formId}
				noValidate
				onSubmit={submit}
				sx={{ display: "flex", flexDirection: "column", gap: 2 }}
			>
				<TextField
					id={`${formId}-paidOn`}
					label={FEES.payForm.paidOn}
					type="date"
					value={paidOn}
					onChange={(event) => {
						setPaidOn(event.target.value);
						setProblems((was) => ({ ...was, paidOn: undefined }));
					}}
					error={Boolean(problems.paidOn)}
					helperText={problems.paidOn}
					fullWidth
					slotProps={{ htmlInput: { max: today } }}
				/>
				<TextField
					id={`${formId}-amount`}
					label={FEES.payForm.amount}
					value={amount}
					onChange={(event) => {
						setAmount(event.target.value);
						setProblems((was) => ({ ...was, amount: undefined }));
					}}
					error={Boolean(problems.amount)}
					helperText={problems.amount ?? FEES.payForm.amountHelper}
					autoComplete="off"
					autoFocus
					fullWidth
					slotProps={{
						input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
						htmlInput: { inputMode: "decimal" },
					}}
				/>
				<TextField
					label={FEES.payForm.note}
					value={note}
					onChange={(event) => setNote(event.target.value)}
					helperText={FEES.payForm.noteHelper}
					autoComplete="off"
					fullWidth
					slotProps={{ htmlInput: { maxLength: 200 } }}
				/>
				{outside && <Banner tone="warn">{FEES.payForm.dayOutside}</Banner>}
				{failure && <Banner tone="bad">{failure}</Banner>}
			</Box>
		</ResponsiveDialog>
	);
};
