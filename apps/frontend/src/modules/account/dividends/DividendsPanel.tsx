import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState, SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconAdd, IconBank, IconCheck, IconClose, IconEdit, IconUndo } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { Dividend } from "@connected-repo/zod-schemas/kosh/income.zod";
import { DIVIDENDS as D } from "@frontend/copy/dividends.copy";
import { ActionMenu, type MenuAction } from "@frontend/modules/access/components/ActionMenu";
import { errorWords } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { ChangeDividendDialog } from "./components/ChangeDividendDialog";
import type { RowHandlers } from "./components/DividendRow";
import { DividendsSummary } from "./components/DividendsSummary";
import { DividendYears } from "./components/DividendYears";
import { RecordDividendDialog } from "./components/RecordDividendDialog";
import {
	dividendFacts,
	financialYearOf,
	groupByFinancialYear,
	rupees,
	scriptName,
	workedOutAmount,
} from "./dividends.utils";
import { useDividendActions } from "./useDividendActions";

export interface DividendsPanelProps {
	accountId: string;
}

/** What this is, before any figure: why Kosh works dividends out, from when they count, and before which tax. */
const Lead = ({ canAnswer }: { canAnswer: boolean }) => (
	<Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75, maxWidth: 820 }}>
		<SpotIcon size="sm" sx={{ display: { xs: "none", sm: "grid" } }}>
			<IconBank />
		</SpotIcon>
		<Typography color="text.secondary" sx={{ minWidth: 0 }}>
			{`${D.lead.why} ${D.lead.counted(canAnswer)} ${D.lead.tax}`}
		</Typography>
	</Box>
);

const Column = ({ children, busy }: { children: ReactNode; busy?: boolean }) => (
	<Box
		component="section"
		aria-label={D.label}
		aria-busy={busy || undefined}
		sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.25 }, minWidth: 0 }}
	>
		{children}
	</Box>
);

/**
 * One account's dividends. A dividend is paid to the holder's bank, so no
 * statement shows it: Kosh works out what was due and counts it from the
 * ex-date as its best guess. Here a person confirms that, says what really
 * arrived and when, or strikes out one that never came — and can undo any
 * of it. Someone who can only view sees everything and no buttons.
 */
export const DividendsPanel = ({ accountId }: DividendsPanelProps) => (
	// One instance per account, so an open menu or dialog never outlives the account it was about.
	<AccountDividends key={accountId} accountId={accountId} />
);

const AccountDividends = ({ accountId }: DividendsPanelProps) => {
	const list = useQuery(orpc.dividends.list.queryOptions({ input: { accountId } }));
	const actions = useDividendActions(accountId);
	const theme = useTheme();
	const compact = useMediaQuery(theme.breakpoints.down("md"));

	const years = useMemo(() => groupByFinancialYear(list.data?.dividends ?? []), [list.data]);
	// Years opened or closed by hand; until then only the latest is open.
	const [toggled, setToggled] = useState<Record<number, boolean>>({});
	const isOpen = (startYear: number): boolean => toggled[startYear] ?? startYear === years[0]?.startYear;
	const showYearOf = (date: string) => setToggled((was) => ({ ...was, [financialYearOf(date)]: true }));

	// What each overlay is about stays while it closes; `turn` gives a reopened dialog a clean form.
	const [menu, setMenu] = useState<{ anchor: HTMLElement; dividend: Dividend } | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [changing, setChanging] = useState<{ dividend: Dividend; turn: number } | null>(null);
	const [changeOpen, setChangeOpen] = useState(false);
	const [addTurn, setAddTurn] = useState(0);
	const [addOpen, setAddOpen] = useState(false);

	if (list.data === undefined) {
		if (list.isError)
			return (
				<Banner
					tone="bad"
					action={
						<Button variant="outlined" onClick={() => void list.refetch()}>
							{D.retry}
						</Button>
					}
				>
					{errorWords(list.error, D.loadFailed)}
				</Banner>
			);
		return (
			<Column busy>
				<Box sx={{ maxWidth: 820 }}>
					<Skeleton variant="text" />
					<Skeleton variant="text" />
					<Skeleton variant="text" width="60%" />
				</Box>
				<Skeleton variant="rounded" height={132} sx={{ borderRadius: 2.5 }} />
				<Skeleton variant="rounded" height={420} sx={{ borderRadius: 2.5 }} />
			</Column>
		);
	}

	const { canAnswer, dividends } = list.data;
	const openAdd = () => {
		setAddTurn((turn) => turn + 1);
		setAddOpen(true);
	};
	const openChange = (dividend: Dividend) => {
		setChanging((was) => ({ dividend, turn: (was?.turn ?? 0) + 1 }));
		setChangeOpen(true);
	};

	const handlers: RowHandlers | undefined = canAnswer
		? {
				onConfirm: (dividend) => void actions.confirm(dividend),
				onUndo: (dividend) => void actions.undo(dividend),
				onMenu: (anchor, dividend) => {
					setMenu({ anchor, dividend });
					setMenuOpen(true);
				},
			}
		: undefined;

	/** Everything a row's menu offers; on desktop the one plain answer is a button in the row instead. */
	const menuActions = (dividend: Dividend): MenuAction[] => {
		const worked = workedOutAmount(dividend);
		const confirm: MenuAction = {
			key: "confirm",
			label: D.act.confirmAmount(rupees(dividend.amount)),
			hint: D.act.confirmHint,
			icon: <IconCheck />,
			onSelect: () => void actions.confirm(dividend),
		};
		const undo: MenuAction = {
			key: "undo",
			label: D.act.undo,
			hint:
				dividend.source === "person"
					? D.act.undoAdded
					: worked
						? D.act.undoHint(rupees(worked), formatDate(dividend.exDate))
						: undefined,
			icon: <IconUndo />,
			onSelect: () => void actions.undo(dividend),
		};
		const different: MenuAction = {
			key: "different",
			label: dividend.state === "expected" ? D.act.different : D.act.changeAgain,
			hint: D.act.differentHint,
			icon: <IconEdit />,
			onSelect: () => openChange(dividend),
		};
		const never: MenuAction = {
			key: "never",
			label: D.act.never,
			hint: D.act.neverHint,
			icon: <IconClose />,
			onSelect: () => void actions.notReceived(dividend),
		};
		const more =
			dividend.state === "not_received" ? [] : dividend.source === "person" ? [different] : [different, never];
		if (!compact) return more;
		// The plain answer first, as the button in a desktop row is.
		return [dividend.state === "expected" ? confirm : undo, ...more];
	};

	return (
		<Column>
			<Lead canAnswer={canAnswer} />

			{dividends.length === 0 ? (
				<SectionCard>
					<EmptyState
						icon={<IconBank />}
						title={D.none.title}
						actions={
							canAnswer ? (
								<Button variant="outlined" startIcon={<IconAdd />} onClick={openAdd}>
									{D.add.open}
								</Button>
							) : undefined
						}
					>
						{canAnswer ? D.none.body : `${D.none.body} ${D.whoCanAnswer}`}
					</EmptyState>
				</SectionCard>
			) : (
				<>
					<DividendsSummary
						data={list.data}
						busy={actions.busy}
						onConfirmAll={
							canAnswer ? () => void actions.confirmAll(dividends.filter((d) => d.state === "expected")) : undefined
						}
					/>
					<DividendYears
						years={years}
						isOpen={isOpen}
						onToggle={(startYear) => setToggled((was) => ({ ...was, [startYear]: !isOpen(startYear) }))}
						handlers={handlers}
						onAdd={canAnswer ? openAdd : undefined}
						compact={compact}
						busy={actions.busy}
					/>
				</>
			)}

			{canAnswer && menu && (
				<ActionMenu
					anchorEl={menuOpen ? menu.anchor : null}
					onClose={() => setMenuOpen(false)}
					title={D.act.menu(scriptName(menu.dividend), formatDate(menu.dividend.exDate))}
					sheetTitle={`${scriptName(menu.dividend)} · ${rupees(menu.dividend.amount)}`}
					sheetSubtitle={dividendFacts(menu.dividend).join(" · ")}
					doneLabel={D.act.done}
					actions={menuActions(menu.dividend)}
				/>
			)}
			{canAnswer && changing && (
				<ChangeDividendDialog
					key={`${changing.dividend.id}:${changing.turn}`}
					open={changeOpen}
					dividend={changing.dividend}
					onClose={() => setChangeOpen(false)}
					onSave={async (dividend, answer) => {
						const outcome = await actions.change(dividend, answer);
						// It may now be counted in another year: make sure it is in view.
						if (outcome.ok) showYearOf(answer.receivedOn);
						return outcome;
					}}
				/>
			)}
			{canAnswer && addTurn > 0 && (
				<RecordDividendDialog
					key={addTurn}
					open={addOpen}
					accountId={accountId}
					onClose={() => setAddOpen(false)}
					onSave={async (script, answer) => {
						const outcome = await actions.record(script, answer);
						if (outcome.ok) showYearOf(answer.receivedOn);
						return outcome;
					}}
				/>
			)}
		</Column>
	);
};
