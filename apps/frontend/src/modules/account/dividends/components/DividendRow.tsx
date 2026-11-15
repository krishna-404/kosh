import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { IconCheck, IconClock, IconClose, IconEdit, IconMore, IconUndo } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { dividendFacts, paiseShown, rupees, scriptName, stateWords } from "../dividends.utils";
import { Facts } from "./Facts";
import { rowAreas, rowGrid } from "./rowGrid";

const STATE_TAG = {
	expected: { tone: "pending", icon: <IconClock /> },
	confirmed: { tone: "new", icon: <IconCheck /> },
	not_received: { tone: "neutral", icon: <IconClose /> },
} as const;

/** What a row offers someone who can answer. */
export interface RowHandlers {
	onConfirm: (dividend: Dividend) => void;
	onUndo: (dividend: Dividend) => void;
	/** Open the row's menu beside the button pressed. */
	onMenu: (anchor: HTMLElement, dividend: Dividend) => void;
}

interface DividendRowProps {
	dividend: Dividend;
	/** Absent for someone who cannot answer: the row is then words and figures only. */
	handlers?: RowHandlers;
	/** Below desktop width everything a row offers is in its menu. */
	compact: boolean;
	busy: boolean;
}

/** Whether a row has more to offer than its one plain answer (Confirm, or Undo). */
const hasMore = (dividend: Dividend): boolean => dividend.state !== "not_received";

/**
 * One dividend: the script, the ex-date and the working, its state in a tag
 * and in words, and the amount — struck through when it never arrived, so
 * it is still listed but plainly not counted.
 */
export const DividendRow = ({ dividend, handlers, compact, busy }: DividendRowProps) => {
	const name = scriptName(dividend);
	const state = stateWords(dividend);
	const tag = STATE_TAG[dividend.state];
	const facts = dividendFacts(dividend);
	const date = formatDate(dividend.exDate);
	const struck = dividend.state === "not_received";
	const withActions = handlers !== undefined;

	return (
		<Box component="li" sx={[rowGrid(withActions), rowAreas(withActions), { minHeight: 60, py: { xs: 1.25, md: 1 } }]}>
			<Typography
				variant="subtitle2"
				component="div"
				sx={{
					gridArea: "name",
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					columnGap: 1,
					rowGap: 0.5,
					minWidth: 0,
				}}
			>
				<Box component="span" sx={{ overflowWrap: "anywhere" }}>
					{name}
				</Box>
				{dividend.symbol !== "" && dividend.symbol !== name && (
					<Typography variant="caption" component="span">
						{dividend.symbol}
					</Typography>
				)}
				{dividend.source === "person" && <Tag icon={<IconEdit />}>{D.byHand}</Tag>}
			</Typography>

			<Facts parts={facts} gridArea="facts" />

			<Box sx={{ gridArea: "state", display: "flex", alignItems: "center", gap: 1, mt: { xs: 0.75, md: 0 } }}>
				<Tag tone={tag.tone} icon={tag.icon}>
					{state.tag}
				</Tag>
				{/* On a phone the words go beside the tag; on desktop, under the amount they are about. */}
				{struck && state.note && (
					<Typography variant="caption" component="span" sx={{ display: { md: "none" } }}>
						{state.note}
					</Typography>
				)}
			</Box>

			<Box sx={{ gridArea: "amount", textAlign: "right", alignSelf: { xs: "start", md: "center" }, pt: { xs: "1px", md: 0 } }}>
				<Money
					value={dividend.amount}
					decimals={paiseShown(dividend.amount)}
					sx={(theme) => ({
						fontWeight: 600,
						...(struck && { color: theme.vars.palette.kosh.ink3, textDecoration: "line-through" }),
					})}
				/>
				{struck && state.note && (
					<Typography variant="caption" component="div" sx={{ display: { xs: "none", md: "block" } }}>
						{state.note}
					</Typography>
				)}
			</Box>

			{handlers && (
				<Box
					sx={{
						gridArea: "actions",
						display: "flex",
						justifyContent: "flex-end",
						alignItems: "center",
						gap: 0.25,
						alignSelf: { xs: "start", md: "center" },
						// The buttons are taller than the text beside them; keep the row's rhythm.
						my: { xs: -1.25, md: -0.5 },
						mr: { xs: -1, md: -1 },
					}}
				>
					{!compact &&
						(dividend.state === "expected" ? (
							<Button
								variant="text"
								aria-label={D.act.confirmLabel(name, rupees(dividend.amount), date)}
								disabled={busy}
								onClick={() => handlers.onConfirm(dividend)}
							>
								{D.act.confirm}
							</Button>
						) : (
							<Button
								variant="text"
								startIcon={<IconUndo />}
								aria-label={D.act.undoLabel(name, date)}
								disabled={busy}
								onClick={() => handlers.onUndo(dividend)}
							>
								{D.act.undo}
							</Button>
						))}
					{compact || hasMore(dividend) ? (
						<IconButton
							aria-label={D.act.menu(name, date)}
							aria-haspopup="menu"
							disabled={busy}
							onClick={(event) => handlers.onMenu(event.currentTarget, dividend)}
						>
							<IconMore />
						</IconButton>
					) : (
						// Keeps "Undo" in line with the rows above and below it.
						<Box aria-hidden sx={{ width: 44, flex: "none" }} />
					)}
				</Box>
			)}
		</Box>
	);
};
