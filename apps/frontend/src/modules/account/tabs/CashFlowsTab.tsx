import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { useSearchParams } from "react-router";
import type { AccountInfo } from "../account.types";
import { LedgerView } from "./cash/LedgerView";
import { TradesView } from "./cash/TradesView";

type View = "money" | "trades";
const VIEW_PARAM = "view";

/**
 * Cash flows: the ledger as Kosh understood it — every line with what it
 * said and what Kosh took it to be — and, as a second view, the trades.
 * Which view is open lives in the address (`?tab=cash&view=trades`).
 */
export const CashFlowsTab = ({ info }: { info: AccountInfo }) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const [params, setParams] = useSearchParams();
	const view: View = params.get(VIEW_PARAM) === "trades" ? "trades" : "money";
	const setView = (next: View) =>
		setParams(
			(current) => {
				const updated = new URLSearchParams(current);
				if (next === "money") updated.delete(VIEW_PARAM);
				else updated.set(VIEW_PARAM, next);
				return updated;
			},
			{ replace: true },
		);

	return (
		<>
			<Box sx={{ display: "flex" }}>
				<Segmented<View>
					ariaLabel={ACCOUNT.cash.viewLabel}
					value={view}
					onChange={setView}
					fullWidth={phone}
					options={[
						{ value: "money", label: ACCOUNT.cash.viewMoney },
						{ value: "trades", label: ACCOUNT.cash.viewTrades },
					]}
				/>
			</Box>
			{view === "money" ? <LedgerView info={info} phone={phone} /> : <TradesView info={info} phone={phone} />}
		</>
	);
};
