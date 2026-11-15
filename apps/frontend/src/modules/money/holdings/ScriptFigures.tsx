import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Holding } from "@connected-repo/zod-schemas/kosh/money.zod";
import { SCRIPT } from "@frontend/copy/holdings.copy";
import { priceWords, quantityWords, standingOf } from "./holdings.utils";

interface ScriptFiguresProps {
	holding: Holding;
	buys: number;
	sells: number;
}

/**
 * One script's own figures: what it is worth (how many, at what price, as of
 * which day), what was paid for it, what it has gained, and its return a year.
 */
export const ScriptFigures = ({ holding, buys, sells }: ScriptFiguresProps) => {
	const quantity = quantityWords(holding.quantity);
	return (
		<SectionCard>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "1.5fr repeat(3, minmax(0, 1fr))" },
					columnGap: 2,
					rowGap: 2.5,
					alignItems: "start",
				}}
			>
				<Stat
					size="lg"
					label={SCRIPT.valueToday}
					value={<Money value={holding.value} figure />}
					hint={
						holding.sold ? (
							SCRIPT.soldOut
						) : holding.price === null ? (
							<>
								{SCRIPT.heldQuantity(quantity)}
								<Box component="span" sx={{ display: "block" }}>
									{SCRIPT.lastPaid}
								</Box>
							</>
						) : (
							<>
								{SCRIPT.quantityAt(quantity, priceWords(holding.price))}
								{holding.priceDate && (
									<Box component="span" sx={{ display: "block" }}>
										{SCRIPT.priceOf(formatDate(holding.priceDate))}
									</Box>
								)}
							</>
						)
					}
					sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}
				/>
				<Stat
					label={SCRIPT.invested}
					value={<Money value={holding.invested} />}
					hint={buys + sells > 0 ? SCRIPT.trades(buys, sells) : undefined}
				/>
				<Stat
					label={SCRIPT.gain}
					value={<Money value={holding.gain} sign="always" tone="auto" />}
					hint={SCRIPT.gainHint}
				/>
				<Stat
					label={SCRIPT.returns}
					value={
						<Percent
							value={holding.xirr}
							tone={holding.xirr !== null && holding.xirr < 0 ? "neg" : standingOf(holding) === "ahead" ? "pos" : "plain"}
						/>
					}
					hint={holding.xirr === null ? SCRIPT.noReturn : SCRIPT.aYear}
				/>
			</Box>
		</SectionCard>
	);
};
