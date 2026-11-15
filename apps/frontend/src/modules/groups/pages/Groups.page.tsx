import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { formatDate } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import {
	IconAdd,
	IconDelete,
	IconEdit,
	IconGroup,
	IconInfo,
} from "@connected-repo/ui-mui/kosh/icons";
import { ConfirmDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { GROUP_KIND_ENUM, type GroupKind } from "@connected-repo/zod-schemas/enums.zod";
import type { Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { Page } from "@frontend/components/layout/Page";
import { GROUPS } from "@frontend/copy/groups.copy";
import { GROUP_KIND_LABEL } from "@frontend/copy/levels.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useGroupsCompared, useMarketStatus } from "@frontend/modules/money/money.queries";
import { scopeSearch } from "@frontend/modules/money/scope";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router";
import { ComparedList } from "../components/ComparedList";
import type { ComparedRow } from "../components/ComparedParts";
import { ComparedTable } from "../components/ComparedTable";
import { GroupDialog } from "../components/GroupDialog";
import { GroupItem } from "../components/GroupItem";
import { WhatIfCard } from "../components/WhatIfCard";
import { YearGridCard } from "../components/YearGridCard";
import { useRefreshGroups } from "../groups.queries";
import {
	anyValue,
	fullYears,
	kindCounts,
	membersOf,
	ofKind,
	rankGroups,
	sharedExample,
	standingOf,
	totalValue,
	widestGap,
	type YearCell,
	yearCells,
	yearGrid,
} from "../groups.utils";

type KindFilter = GroupKind | "all";

/** The narrowest window, in px, in which a group's name still fits beside its figures. */
const TABLE_FROM = 1280;

/**
 * Groups: a person's own saved sets of accounts — the family, a fund
 * manager's accounts, their own trading — compared. Each group is judged on
 * its own deposits and withdrawals against NIFTY on the same dates, since it
 * started; "What if" runs one group's money through the others; and the
 * grid shows the same comparison a calendar year at a time. Only the person
 * sees their groups, and making one shares nothing.
 *
 * Groups can share accounts, so nothing here adds two groups together.
 */
export default function GroupsPage() {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	// The table's six columns need this much window beside the sidebar; below it the same rows are a list.
	const roomForColumns = useMediaQuery(theme.breakpoints.up(TABLE_FROM));
	const snack = useSnack();
	const refresh = useRefreshGroups();

	const groupsQuery = useQuery(orpc.portfolio.listGroups.queryOptions());
	const directoryQuery = useDirectory();
	const comparedQuery = useGroupsCompared("all");
	const market = useMarketStatus();
	const remove = useMutation(orpc.portfolio.deleteGroup.mutationOptions());

	// The dialog is re-keyed on every opening so its form starts fresh; `group`
	// stays put while it closes so the title does not change on the way out.
	const [dialog, setDialog] = useState<{ id: number; open: boolean; group: Group | null }>({
		id: 0,
		open: false,
		group: null,
	});
	const [menu, setMenu] = useState<{ anchor: HTMLElement; group: Group } | null>(null);
	const [deleting, setDeleting] = useState<{ open: boolean; group: Group } | null>(null);
	const [kindFilter, setKindFilter] = useState<KindFilter>("all");

	const openDialog = (group: Group | null) =>
		setDialog((current) => ({ id: current.id + 1, open: true, group }));

	const groups = groupsQuery.data ?? [];
	const accounts = directoryQuery.data?.accounts ?? [];
	const compared = comparedQuery.data;
	const showValues = anyValue(accounts);
	const thisYear = new Date().getFullYear();

	const cells = useMemo(
		() => (compared ? yearCells(compared, thisYear) : new Map<string, YearCell[]>()),
		[compared, thisYear],
	);

	// Every group as the comparison shows it, furthest ahead of NIFTY first.
	const oldestFirst = [...groups].sort((a, b) => a.createdAt - b.createdAt);
	const rows: ComparedRow[] = rankGroups(
		groups.map((group) => {
			const members = membersOf(group, accounts);
			const figures = compared?.groups.find((row) => row.groupId === group.id);
			const standing = standingOf(figures, anyValue(members));
			const row: ComparedRow = {
				group,
				tile: oldestFirst.indexOf(group),
				kindLabel: group.kind ? GROUP_KIND_LABEL[group.kind] : null,
				memberLabels: members.map((account) => account.label),
				// A group the comparison has not heard of is on its way only while the comparison is.
				standing: standing === "pending" && !comparedQuery.isFetching ? "unranked" : standing,
				figures,
				years: fullYears(cells.get(group.id) ?? []),
				href: `${ROUTES.overview}${scopeSearch({ kind: "group", id: group.id })}`,
			};
			return { row, name: group.name, standing: row.standing, aheadPoints: figures?.aheadPoints ?? null };
		}),
	).map((ranked) => ranked.row);

	const kinds = kindCounts(groups, GROUP_KIND_ENUM);
	// A kind that no group has any more (after an edit or a delete) filters nothing.
	const kind = kinds.some((entry) => entry.kind === kindFilter) ? kindFilter : "all";
	const shown = ofKind(
		rows.map((row) => ({ row, kind: row.group.kind })),
		kind,
	).map((entry) => entry.row);
	// Chips are worth showing only when one of them would narrow the list.
	const showChips = kinds.some((entry) => entry.count < groups.length);

	const confirmDelete = async () => {
		if (!deleting) return;
		const { group } = deleting;
		try {
			await remove.mutateAsync({ groupId: group.id });
		} catch (error) {
			snack(errorWords(error, GROUPS.deleteFailed));
			return;
		}
		void refresh();
		setDeleting({ open: false, group });
		snack(GROUPS.deleted(group.name));
	};

	const newButton = (
		<Button variant="contained" startIcon={<IconAdd />} onClick={() => openDialog(null)}>
			{GROUPS.newGroup}
		</Button>
	);
	const toAccounts = (
		<Button variant="outlined" component={Link} to={ROUTES.accounts}>
			{GROUPS.noFigures.action}
		</Button>
	);
	const retry = (refetch: () => void) => (
		<Button variant="outlined" onClick={refetch}>
			{GROUPS.retry}
		</Button>
	);

	const loading = groupsQuery.isPending || directoryQuery.isPending || comparedQuery.isPending;
	const failed =
		(groupsQuery.isError && groupsQuery.data === undefined) ||
		(directoryQuery.isError && directoryQuery.data === undefined);
	const none = !loading && !failed && groups.length === 0;
	// The comparison is the page once any group has something uploaded and its figures are in.
	const somethingUploaded = rows.some((row) => row.standing !== "none");
	const comparing = compared !== undefined && somethingUploaded;

	const chips = showChips && (
		<FilterChips<KindFilter>
			ariaLabel={GROUPS.kindFilterLabel}
			value={kind}
			onChange={setKindFilter}
			// On a phone the row runs to the screen's edges and scrolls sideways.
			sx={{ mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 } }}
			options={[
				{ value: "all", label: `${GROUPS.allKinds} · ${groups.length}` },
				...kinds.map((entry) => ({
					value: entry.kind,
					label: `${GROUP_KIND_LABEL[entry.kind]} · ${entry.count}`,
				})),
			]}
		/>
	);

	let body: ReactNode;
	if (failed)
		body = (
			<Banner
				tone="bad"
				action={retry(() => {
					void groupsQuery.refetch();
					void directoryQuery.refetch();
				})}
			>
				{errorWords(groupsQuery.error ?? directoryQuery.error, GROUPS.loadFailed)}
			</Banner>
		);
	else if (loading)
		body = (
			<Box aria-busy sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.75 } }}>
				<SectionCard>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						{[0, 1, 2].map((row) => (
							<Box key={row} sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
								<Skeleton variant="rounded" width={40} height={40} />
								<Box sx={{ flex: 1 }}>
									<Skeleton width="32%" />
									<Skeleton width="58%" />
								</Box>
								<Skeleton width="18%" sx={{ display: { xs: "none", md: "block" } }} />
							</Box>
						))}
					</Box>
				</SectionCard>
				<SectionCard>
					<Skeleton width="46%" height={28} />
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1.5 }}>
						{[0, 1, 2].map((row) => (
							<Skeleton key={row} variant="rounded" height={20} />
						))}
					</Box>
				</SectionCard>
			</Box>
		);
	else if (none)
		body = (
			<SectionCard>
				<EmptyState icon={<IconGroup />} title={GROUPS.empty.title} actions={newButton}>
					{GROUPS.empty.body}
				</EmptyState>
			</SectionCard>
		);
	else if (comparing) {
		const grid = yearGrid(
			cells,
			// A group with under a year behind it has no year to show yet.
			shown.filter((row) => row.standing === "ranked" || row.standing === "unranked").map((row) => row.group.id),
		);
		const widest = widestGap(
			rows.map((row) => (row.standing === "ranked" ? (row.figures?.aheadPoints ?? null) : null)),
		);
		const onMore = (row: ComparedRow, anchor: HTMLElement) => setMenu({ anchor, group: row.group });
		const pricesAsOf = market.data?.pricesAsOf;
		const footer = (
			<Box
				sx={(t) => ({
					display: "flex",
					flexDirection: "column",
					gap: 0.75,
					px: { xs: 2, md: 2.5 },
					py: 1.5,
					borderTop: `1px solid ${t.vars.palette.kosh.line}`,
					bgcolor: t.vars.palette.kosh.surface2,
				})}
			>
				{compared.overlapping && (
					<Typography
						variant="body2"
						sx={{ display: "flex", gap: 1.25, "& svg": { fontSize: 18, flex: "none", mt: "1px" } }}
					>
						<IconInfo aria-hidden />
						<span>{GROUPS.overlapNote(sharedExample(groups, accounts))}</span>
					</Typography>
				)}
				<Typography variant="caption">
					{GROUPS.sinceStart}
					{pricesAsOf && ` ${MONEY.pricesAsOf(formatDate(pricesAsOf))}.`}
				</Typography>
			</Box>
		);
		body = (
			<>
				{market.data?.loading && <Banner>{MONEY.pricesLoading}</Banner>}
				{comparedQuery.isError && (
					<Banner tone="warn" action={retry(() => void comparedQuery.refetch())}>
						{errorWords(comparedQuery.error, GROUPS.figuresStale)}
					</Banner>
				)}
				{chips}
				<SectionCard padding="none" sx={{ overflow: "hidden" }}>
					{roomForColumns ? (
						<ComparedTable rows={shown} widest={widest} onMore={onMore} footer={footer} />
					) : (
						<>
							<ComparedList rows={shown} widest={widest} onMore={onMore} />
							{footer}
						</>
					)}
				</SectionCard>
				<WhatIfCard
					choices={rows.map((row) => ({
						id: row.group.id,
						name: row.group.name,
						hasFigures: row.standing !== "none" && row.standing !== "pending",
					}))}
					groups={groups}
					worth={new Map(compared.groups.map((row) => [row.groupId, Number(row.value)]))}
					phone={phone}
				/>
				<YearGridCard
					grid={grid}
					names={new Map(groups.map((group) => [group.id, group.name]))}
					thisYear={thisYear}
				/>
			</>
		);
	} else {
		// Nothing to compare — the comparison did not load, or nothing is uploaded
		// in any group's accounts. The groups are still listed, to manage them.
		const items = ofKind(groups, kind).map((group) => {
			const members = membersOf(group, accounts);
			return (
				<GroupItem
					key={group.id}
					card={phone}
					tile={oldestFirst.indexOf(group)}
					name={group.name}
					kindLabel={group.kind ? GROUP_KIND_LABEL[group.kind] : null}
					memberLabels={members.map((account) => account.label)}
					total={showValues ? totalValue(members) : undefined}
					onMore={(anchor) => setMenu({ anchor, group })}
				/>
			);
		});
		body = (
			<>
				{compared === undefined ? (
					<Banner tone="bad" action={retry(() => void comparedQuery.refetch())}>
						{errorWords(comparedQuery.error, GROUPS.figuresFailed)}
					</Banner>
				) : (
					// On a phone the button goes under the sentence: beside it, it squeezes the words into a sliver.
					<Banner title={GROUPS.noFigures.title} action={phone ? undefined : toAccounts}>
						{GROUPS.noFigures.body}
						{phone && <Box sx={{ mt: 1.25 }}>{toAccounts}</Box>}
					</Banner>
				)}
				{chips}
				{phone ? (
					<>
						<Box
							component="ul"
							aria-label={NAV.groups}
							sx={{ m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
						>
							{items}
						</Box>
						<Button
							variant="outlined"
							size="large"
							fullWidth
							startIcon={<IconAdd />}
							onClick={() => openDialog(null)}
						>
							{GROUPS.newGroup}
						</Button>
					</>
				) : (
					// Without figures the rows are short; no need for the full width.
					<SectionCard padding="none" sx={{ maxWidth: 760 }}>
						<Box
							component="ul"
							aria-label={NAV.groups}
							sx={(t) => ({
								m: 0,
								p: 0,
								listStyle: "none",
								"& > li + li": { borderTop: `1px solid ${t.vars.palette.kosh.line}` },
							})}
						>
							{items}
						</Box>
					</SectionCard>
				)}
			</>
		);
	}

	return (
		<Page
			// The tab, the navigation and the phone's app bar keep the one word.
			title={NAV.groups}
			heading={GROUPS.title}
			subtitle={phone ? GROUPS.introShort : GROUPS.intro}
			// The empty state carries its own "New group"; the header's would be a second one.
			actions={phone || none ? undefined : newButton}
			barAction={
				<IconButton aria-label={GROUPS.newGroup} onClick={() => openDialog(null)}>
					<IconAdd />
				</IconButton>
			}
		>
			{body}

			<Menu
				anchorEl={menu?.anchor}
				open={menu !== null}
				onClose={() => setMenu(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				transformOrigin={{ vertical: "top", horizontal: "right" }}
				slotProps={{ paper: { sx: { minWidth: 180, "& svg": { fontSize: 20 } } } }}
			>
				<MenuItem
					onClick={() => {
						if (menu) openDialog(menu.group);
						setMenu(null);
					}}
				>
					<IconEdit aria-hidden />
					{GROUPS.edit}
				</MenuItem>
				<MenuItem
					onClick={() => {
						if (menu) setDeleting({ open: true, group: menu.group });
						setMenu(null);
					}}
					sx={(t) => ({ color: t.vars.palette.kosh.dangerText })}
				>
					<IconDelete aria-hidden />
					{GROUPS.delete}
				</MenuItem>
			</Menu>

			<GroupDialog
				key={dialog.id}
				open={dialog.open}
				group={dialog.group}
				groups={groups}
				directory={directoryQuery.data}
				onClose={() => setDialog((current) => ({ ...current, open: false }))}
			/>

			<ConfirmDialog
				open={deleting?.open ?? false}
				tone="danger"
				icon={<IconDelete />}
				title={GROUPS.deleteTitle(deleting?.group.name ?? "")}
				confirmLabel={GROUPS.deleteConfirm}
				cancelLabel={GROUPS.deleteKeep}
				busy={remove.isPending}
				onConfirm={confirmDelete}
				onCancel={() => setDeleting((current) => current && { ...current, open: false })}
			>
				{GROUPS.deleteBody}
			</ConfirmDialog>
		</Page>
	);
}
