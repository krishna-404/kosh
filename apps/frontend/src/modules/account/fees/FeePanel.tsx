import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { FeeArrangement } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useReturns } from "@frontend/modules/money/money.queries";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AddPaymentDialog } from "./components/AddPaymentDialog";
import { ArrangementCard } from "./components/ArrangementCard";
import { ChargesCard } from "./components/ChargesCard";
import { EarlierCard } from "./components/EarlierCard";
import { EffectCard } from "./components/EffectCard";
import { NothingSetCard } from "./components/NothingSetCard";
import { PaymentsCard } from "./components/PaymentsCard";
import { SetFeeDialog } from "./components/SetFeeDialog";
import { StopFeeDialog } from "./components/StopFeeDialog";
import { splitEarlier, todayInIndia } from "./fees.utils";

export interface FeePanelProps {
	accountId: string;
}

const card = { borderRadius: 2.5 } as const;

/** Where the cards go once the panel is wide enough for two columns. */
const WIDE = "@container (min-width: 900px)";

/**
 * What a fund manager is paid for one account from outside it — by bank
 * transfer, so no statement shows it — what that has come to, and the return
 * before and after it. Anyone who can see the account sees this, because it
 * changes what the return means; only an owner can set, change or stop it,
 * and for everyone else those actions are not there at all.
 *
 * The panel lays itself out by its own width, not the window's, so it reads
 * the same in a full page, a tab or a narrow column.
 */
export const FeePanel = ({ accountId }: FeePanelProps) => {
	const overview = useQuery(orpc.fees.overview.queryOptions({ input: { accountId } }));
	const scope = useMemo(() => ({ kind: "account" as const, id: accountId }), [accountId]);
	const returns = useReturns(scope);
	const [dialog, setDialog] = useState<"set" | "stop" | "pay" | null>(null);
	// The arrangement being stopped, kept while its dialog closes — by then it may no longer be the running one.
	const [stopping, setStopping] = useState<FeeArrangement | null>(null);

	const data = overview.data;
	if (overview.isPending)
		return (
			<Box role="status" aria-busy aria-label={FEES.loading} sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
				<Skeleton variant="rounded" height={212} sx={card} />
				<Skeleton variant="rounded" height={168} sx={card} />
			</Box>
		);
	if (!data)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void overview.refetch()}>
						{FEES.retry}
					</Button>
				}
			>
				{errorWords(overview.error, FEES.loadFailed)}
			</Banner>
		);

	const today = todayInIndia();
	const { arrangement, canChange } = data;
	const { upcoming, past } = splitEarlier(data.earlier, today);
	const arrangements = [...(arrangement ? [arrangement] : []), ...data.earlier];
	const invoicedNow = arrangement?.kind === "invoiced";
	// When every arrangement is billed by invoice, the payments are the charges: one list, not two.
	const allInvoiced = arrangements.length > 0 && arrangements.every((a) => a.kind === "invoiced");
	const showCharges = data.charges.length > 0 && !allInvoiced;
	const showPayments = invoicedNow || data.payments.length > 0;
	const showEffect = arrangement !== null || data.charges.length > 0;
	const lastStopped = arrangement ? null : (past.map((a) => a.endsOn).find((day) => day !== null) ?? null);
	// The returns hook keeps the last account's figures on screen while a new one loads.
	const returnsLoading = returns.isPending || returns.isPlaceholderData;

	return (
		<Box sx={{ containerType: "inline-size", minWidth: 0 }}>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr)",
					alignItems: "start",
					gap: 2.25,
					[WIDE]: showCharges ? { gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 380px)", gap: 2.5 } : {},
				}}
			>
				{overview.isError && (
					<Banner
						tone="bad"
						sx={{ order: 0, gridColumn: "1 / -1" }}
						action={
							<Button variant="outlined" onClick={() => void overview.refetch()}>
								{FEES.retry}
							</Button>
						}
					>
						{errorWords(overview.error, FEES.loadFailed)}
					</Banner>
				)}

				{/* One column when narrow (the cards take their `order`); the main column when wide. */}
				<Box
					sx={{
						display: "contents",
						[WIDE]: { display: "flex", flexDirection: "column", gap: 2.25, minWidth: 0, order: 1 },
					}}
				>
					<Box sx={{ order: 1, minWidth: 0 }}>
						{arrangement ? (
							<ArrangementCard
								arrangement={arrangement}
								upcoming={upcoming}
								today={today}
								canChange={canChange}
								onChange={() => setDialog("set")}
								onStop={() => {
									setStopping(arrangement);
									setDialog("stop");
								}}
							/>
						) : (
							<NothingSetCard
								canChange={canChange}
								lastStopped={lastStopped}
								charged={data.charges.length > 0}
								onSet={() => setDialog("set")}
							/>
						)}
					</Box>
					{showEffect && (
						<Box sx={{ order: 2, minWidth: 0 }}>
							<EffectCard
								overview={data}
								running={arrangement !== null && arrangement.startsOn <= today}
								allInvoiced={allInvoiced}
								returns={returnsLoading ? undefined : returns.data}
								returnsLoading={returnsLoading}
								onRetryReturns={() => void returns.refetch()}
							/>
						</Box>
					)}
					{showPayments && (
						<Box sx={{ order: 3, minWidth: 0 }}>
							<PaymentsCard
								accountId={accountId}
								payments={data.payments}
								arrangements={arrangements}
								invoicedNow={invoicedNow}
								canChange={canChange}
								onAdd={() => setDialog("pay")}
							/>
						</Box>
					)}
					{past.length > 0 && (
						<Box sx={{ order: 5, minWidth: 0 }}>
							<EarlierCard earlier={past} today={today} />
						</Box>
					)}
				</Box>

				{showCharges && (
					<Box sx={{ order: 4, minWidth: 0, [WIDE]: { order: 2 } }}>
						<ChargesCard charges={data.charges} payments={data.payments} arrangements={arrangements} />
					</Box>
				)}
			</Box>

			{canChange && (
				<>
					<SetFeeDialog open={dialog === "set"} onClose={() => setDialog(null)} overview={data} today={today} />
					{stopping && (
						<StopFeeDialog
							open={dialog === "stop"}
							onClose={() => setDialog(null)}
							account={data.account}
							arrangement={stopping}
							today={today}
						/>
					)}
					<AddPaymentDialog
						open={dialog === "pay"}
						onClose={() => setDialog(null)}
						account={data.account}
						payee={arrangement?.payee ?? null}
						arrangements={arrangements}
						today={today}
					/>
				</>
			)}
		</Box>
	);
};
