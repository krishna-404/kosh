import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { IconAdd, IconDelete } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { ConfirmDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import type { FeeArrangement, FeeOverview } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { useRefreshMoney } from "@frontend/modules/money/money.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { amountWords, paymentCounted, refusalWords } from "../fees.utils";
import { FeeRow, FeeRows } from "./FeeRows";

type Payment = FeeOverview["payments"][number];

interface PaymentsCardProps {
	accountId: string;
	payments: readonly Payment[];
	/** Every arrangement on the account, running or not. */
	arrangements: readonly FeeArrangement[];
	/** The arrangement running now is billed by invoice, so payments can be added. */
	invoicedNow: boolean;
	/** The caller is an owner of the account. */
	canChange: boolean;
	onAdd: () => void;
}

/**
 * The payments entered for an arrangement billed by invoice, newest first.
 * An owner adds one as it is paid and can remove one entered by mistake. A
 * payment dated outside any invoice arrangement is kept but not counted —
 * and says so.
 */
export const PaymentsCard = ({
	accountId,
	payments,
	arrangements,
	invoicedNow,
	canChange,
	onAdd,
}: PaymentsCardProps) => {
	const snack = useSnack();
	const refresh = useRefreshMoney();
	const remove = useMutation(orpc.fees.removePayment.mutationOptions());
	const add = useMutation(orpc.fees.addPayment.mutationOptions());

	const [removing, setRemoving] = useState<Payment | null>(null);
	// The last payment asked about stays in the confirm while it closes.
	const [asked, setAsked] = useState<Payment | null>(null);

	const putBack = async (payment: Payment) => {
		const amount = amountWords(payment.amount);
		try {
			await add.mutateAsync({
				accountId,
				paidOn: payment.paidOn,
				amount: payment.amount,
				...(payment.note ? { note: payment.note } : {}),
			});
			await refresh();
			snack(FEES.payments.putBack(amount));
		} catch (error) {
			snack(refusalWords(error, FEES.payments.putBackFailed));
		}
	};

	const confirmRemove = async () => {
		if (!removing) return;
		const payment = removing;
		try {
			await remove.mutateAsync({ paymentId: payment.id });
			await refresh();
			setRemoving(null);
			snack({
				message: FEES.payments.removed(amountWords(payment.amount)),
				actionLabel: FEES.payments.undo,
				onAction: () => void putBack(payment),
			});
		} catch (error) {
			setRemoving(null);
			snack(refusalWords(error, FEES.payments.removeFailed));
		}
	};

	return (
		<SectionCard padding="none">
			{/* The card's own heading, so the button can drop under the words when the card is narrow. */}
			<Box
				sx={{
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					columnGap: 1.5,
					rowGap: 1.25,
					px: 2.5,
					pt: 2.5,
					pb: payments.length > 0 ? 1 : 1.5,
				}}
			>
				<Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
					<Typography variant="h3" component="h2">
						{FEES.payments.title}
					</Typography>
					<Typography variant="body2">{invoicedNow ? FEES.payments.lead : FEES.payments.leadEarlier}</Typography>
				</Box>
				{invoicedNow && canChange && (
					<Button variant="outlined" startIcon={<IconAdd />} onClick={onAdd} sx={{ flex: "none" }}>
						{FEES.payments.add}
					</Button>
				)}
			</Box>
			{payments.length === 0 ? (
				<Typography variant="body2" sx={{ px: 2.5, pb: 2.5 }}>
					{canChange && invoicedNow ? FEES.payments.emptyOwner : FEES.payments.empty}
				</Typography>
			) : (
				<FeeRows label={FEES.payments.title}>
					{payments.map((payment) => {
						const counted = paymentCounted(payment, arrangements);
						const amount = amountWords(payment.amount);
						return (
							<FeeRow
								key={payment.id}
								primary={formatDate(payment.paidOn)}
								tag={counted ? undefined : <Tag tone="pending">{FEES.payments.notCounted}</Tag>}
								secondary={
									counted
										? (payment.note ?? undefined)
										: payment.note
											? `${FEES.payments.notCountedWhy} · ${payment.note}`
											: FEES.payments.notCountedWhy
								}
								amount={<Money value={payment.amount} decimals={Number.isInteger(Number(payment.amount)) ? 0 : 2} />}
								action={
									canChange ? (
										<IconButton
											aria-label={FEES.payments.remove(amount, formatDate(payment.paidOn))}
											onClick={() => {
												setAsked(payment);
												setRemoving(payment);
											}}
										>
											<IconDelete />
										</IconButton>
									) : undefined
								}
							/>
						);
					})}
				</FeeRows>
			)}

			<ConfirmDialog
				open={removing !== null}
				tone="danger"
				icon={<IconDelete />}
				title={FEES.payments.confirmTitle}
				confirmLabel={FEES.payments.confirm}
				cancelLabel={FEES.payments.keep}
				busy={remove.isPending}
				onConfirm={() => void confirmRemove()}
				onCancel={() => setRemoving(null)}
			>
				{asked && FEES.payments.confirmBody(amountWords(asked.amount), formatDate(asked.paidOn))}
			</ConfirmDialog>
		</SectionCard>
	);
};
