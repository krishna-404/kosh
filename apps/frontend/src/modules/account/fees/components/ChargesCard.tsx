import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { IconClock } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { FeeArrangement, FeeOverview } from "@connected-repo/zod-schemas/kosh/income.zod";
import { FEES } from "@frontend/copy/fees.copy";
import { useState } from "react";
import { type ChargeKind, chargeKind, newestFirst } from "../fees.utils";
import { FeeRow, FeeRows } from "./FeeRows";

/** How many charges are listed before "Show all" — which is not offered for just one or two more. */
const FIRST = 8;
const SPARE = 2;

/** The quiet line under a charge's day: what it is, when that needs saying. */
const noteFor = (kind: ChargeKind): string | undefined => {
	if (kind.what === "built_up")
		return kind.since ? FEES.charges.builtUpSince(formatDate(kind.since)) : FEES.charges.builtUp;
	if (kind.what === "payment") return FEES.charges.payment;
	if (kind.what === "last_of_arrangement") return FEES.charges.lastOfArrangement;
	return undefined;
};

interface ChargesCardProps {
	charges: FeeOverview["charges"];
	payments: FeeOverview["payments"];
	/** Every arrangement on the account, running or not. */
	arrangements: readonly FeeArrangement[];
}

/**
 * Every charge Kosh counts against the return, newest first. The one that
 * has built up since the last bill is there too, and says in words that it
 * has not been billed yet.
 */
export const ChargesCard = ({ charges, payments, arrangements }: ChargesCardProps) => {
	const [all, setAll] = useState(false);
	const rows = newestFirst(charges);
	const folds = rows.length > FIRST + SPARE;
	const shown = all || !folds ? rows : rows.slice(0, FIRST);

	return (
		<SectionCard title={FEES.charges.title} subtitle={FEES.charges.lead} padding="none">
			<FeeRows label={FEES.charges.caption}>
				{shown.map((charge, index) => {
					const kind = chargeKind(charge, arrangements, payments);
					// A payment reads as it was entered, paise and all; a worked-out bill in whole rupees.
					const paise = kind.what === "payment" && !Number.isInteger(Number(charge.amount));
					return (
						<FeeRow
							// Two charges can fall on one day (a bill and a payment), so the day alone is not a key.
							key={`${charge.date}:${charge.amount}:${index}`}
							primary={formatDate(charge.date)}
							tag={
								kind.what === "built_up" ? (
									<Tag tone="pending" icon={<IconClock />}>
										{FEES.charges.notBilled}
									</Tag>
								) : undefined
							}
							secondary={noteFor(kind)}
							amount={<Money value={charge.amount} decimals={paise ? 2 : 0} />}
						/>
					);
				})}
			</FeeRows>
			{folds && (
				<Box
					sx={(theme) => ({
						px: 1.25,
						py: 1,
						borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
					})}
				>
					<Button variant="text" onClick={() => setAll((was) => !was)} aria-expanded={all}>
						{all ? FEES.charges.showFewer : FEES.charges.showAll(rows.length)}
					</Button>
				</Box>
			)}
		</SectionCard>
	);
};
