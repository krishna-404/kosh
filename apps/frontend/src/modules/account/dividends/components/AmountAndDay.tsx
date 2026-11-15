import { InputAdornment } from "@connected-repo/ui-mui/form/InputAdornment";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { useEffect, useRef } from "react";
import { todayIso } from "../dividends.utils";

interface AmountAndDayProps {
	amount: string;
	onAmount: (text: string) => void;
	/** What is wrong with the amount, in words; the field is then marked. */
	amountProblem?: string;
	receivedOn: string;
	onReceivedOn: (date: string) => void;
	dateProblem?: string;
	dateHelper: string;
	/** The earliest day the calendar offers (the ex-date), when there is one. */
	earliest?: string;
	disabled: boolean;
	/** Put the cursor in the amount when the dialog opens. */
	focusAmount?: boolean;
}

/**
 * The two things a person says about a dividend: what arrived, before tax,
 * and the day it arrived. The calendar offers only days that can be right,
 * but the server has the last word — its refusal is shown under the field.
 */
export const AmountAndDay = ({
	amount,
	onAmount,
	amountProblem,
	receivedOn,
	onReceivedOn,
	dateProblem,
	dateHelper,
	earliest,
	disabled,
	focusAmount = false,
}: AmountAndDayProps) => {
	const amountInput = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		if (!focusAmount) return;
		// A dialog first takes focus for itself; once it has, hand it to the field the person came for.
		const timer = window.setTimeout(() => amountInput.current?.focus(), 0);
		return () => window.clearTimeout(timer);
	}, [focusAmount]);

	return (
		<>
			<TextField
				label={D.change.amountLabel}
				value={amount}
				onChange={(event) => onAmount(event.target.value)}
				onFocus={(event) => event.target.select()}
				error={amountProblem !== undefined}
				helperText={amountProblem ?? D.change.amountHelper}
				disabled={disabled}
				inputRef={amountInput}
				autoComplete="off"
				fullWidth
				slotProps={{
					htmlInput: { inputMode: "decimal", maxLength: 24 },
					input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
					formHelperText: { role: amountProblem ? "alert" : undefined },
				}}
			/>
			<TextField
				label={D.change.dateLabel}
				type="date"
				value={receivedOn}
				onChange={(event) => onReceivedOn(event.target.value)}
				error={dateProblem !== undefined}
				helperText={dateProblem ?? dateHelper}
				disabled={disabled}
				fullWidth
				slotProps={{
					htmlInput: { min: earliest, max: todayIso() },
					formHelperText: { role: dateProblem ? "alert" : undefined },
				}}
			/>
		</>
	);
};
