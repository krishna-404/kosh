import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { formatDate } from "@connected-repo/ui-mui/format/date";
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
import { isDay, refusalWords, stopDays, stopProblem, termsWords } from "../fees.utils";

interface StopFeeDialogProps {
	open: boolean;
	onClose: () => void;
	account: { id: string; label: string };
	/** The arrangement being stopped. */
	arrangement: FeeArrangement;
	today: string;
}

/**
 * Stop the fee from a date: the last day it is charged, and — before
 * anything happens — the plain statement that nothing is charged after it.
 * The button names the day.
 */
export const StopFeeDialog = ({ open, onClose, account, arrangement, today }: StopFeeDialogProps) => {
	const formId = useId();
	const snack = useSnack();
	const refresh = useRefreshMoney();
	const end = useMutation(orpc.fees.end.mutationOptions());

	const days = stopDays(arrangement, today);
	const [day, setDay] = useState(days.offered);
	const [problem, setProblem] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on opening only
	useEffect(() => {
		if (!open) return;
		setDay(days.offered);
		setProblem(null);
		setFailure(null);
	}, [open]);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const wrong = stopProblem(day, arrangement);
		if (wrong) return setProblem(wrong);
		setFailure(null);
		try {
			await end.mutateAsync({ accountId: account.id, endsOn: day });
			await refresh();
			snack(FEES.stopForm.done(account.label, formatDate(day)));
			onClose();
		} catch (error) {
			setFailure(refusalWords(error, FEES.stopForm.failed));
		}
	};

	const busy = end.isPending;
	return (
		<ResponsiveDialog
			open={open}
			onClose={onClose}
			maxWidth="xs"
			title={FEES.stopForm.title(account.label)}
			subtitle={termsWords(arrangement)}
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={busy}>
						{FEES.stopForm.keep}
					</Button>
					<Button type="submit" form={formId} variant="contained" size="large" disabled={busy}>
						{isDay(day) ? FEES.stopForm.submit(formatDate(day)) : FEES.stopForm.submitBare}
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
					label={FEES.stopForm.lastDay}
					type="date"
					value={day}
					onChange={(event) => {
						setDay(event.target.value);
						setProblem(null);
					}}
					error={Boolean(problem)}
					helperText={problem ?? undefined}
					fullWidth
					slotProps={{ htmlInput: { min: days.earliest, ...(days.latest ? { max: days.latest } : {}) } }}
				/>
				<Typography color="text.secondary">{FEES.stopForm.body}</Typography>
				{failure && <Banner tone="bad">{failure}</Banner>}
			</Box>
		</ResponsiveDialog>
	);
};
