import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { IconAdd, IconDelete, IconEdit, IconGroup } from "@connected-repo/ui-mui/kosh/icons";
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
import { NAV } from "@frontend/copy/nav.copy";
import { useDirectory, useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { GroupDialog } from "../components/GroupDialog";
import { GroupItem } from "../components/GroupItem";
import { anyValue, kindCounts, membersOf, totalValue } from "../groups.utils";

type KindFilter = GroupKind | "all";

/**
 * Groups: a person's own saved sets of accounts — the family, a fund
 * manager's accounts, their own trading. Only they see them, and making one
 * shares nothing. The list is one row per group so that the comparison
 * (return, the same money in NIFTY) can be added as columns when the figures
 * exist; until then money is shown only where an account has a value.
 */
export default function GroupsPage() {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const snack = useSnack();
	const refresh = useRefreshPeople();

	const groupsQuery = useQuery(orpc.portfolio.listGroups.queryOptions());
	const directoryQuery = useDirectory();
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
	const showValues = anyValue(accounts);

	const kinds = kindCounts(groups, GROUP_KIND_ENUM);
	// A kind that no group has any more (after an edit or a delete) filters nothing.
	const kind = kinds.some((entry) => entry.kind === kindFilter) ? kindFilter : "all";
	const shown = kind === "all" ? groups : groups.filter((group) => group.kind === kind);

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

	const loading = groupsQuery.isPending || directoryQuery.isPending;
	const failed = groupsQuery.isError || directoryQuery.isError;
	const none = !loading && !failed && groups.length === 0;

	let body: ReactNode;
	if (failed)
		body = (
			<Banner
				tone="bad"
				action={
					<Button
						variant="outlined"
						onClick={() => {
							void groupsQuery.refetch();
							void directoryQuery.refetch();
						}}
					>
						{GROUPS.retry}
					</Button>
				}
			>
				{errorWords(groupsQuery.error ?? directoryQuery.error, GROUPS.loadFailed)}
			</Banner>
		);
	else if (loading)
		body = (
			<SectionCard sx={{ maxWidth: 760 }}>
				<Box aria-busy sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					{[0, 1, 2].map((row) => (
						<Box key={row} sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
							<Skeleton variant="rounded" width={40} height={40} />
							<Box sx={{ flex: 1 }}>
								<Skeleton width="32%" />
								<Skeleton width="58%" />
							</Box>
						</Box>
					))}
				</Box>
			</SectionCard>
		);
	else if (none)
		body = (
			<SectionCard>
				<EmptyState icon={<IconGroup />} title={GROUPS.empty.title} actions={newButton}>
					{GROUPS.empty.body}
				</EmptyState>
			</SectionCard>
		);
	else {
		const items = shown.map((group) => {
			const members = membersOf(group, accounts);
			return (
				<GroupItem
					key={group.id}
					card={phone}
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
				{kinds.length > 1 && (
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
				)}
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
					// Without figures the rows are short; the card widens when the
					// money and comparison columns have something to show.
					<SectionCard padding="none" sx={{ maxWidth: showValues ? undefined : 760 }}>
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
			title={NAV.groups}
			subtitle={GROUPS.subtitle}
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
