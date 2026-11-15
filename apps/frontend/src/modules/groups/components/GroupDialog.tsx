import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { IconLock, IconTrend, IconView } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Divider } from "@connected-repo/ui-mui/layout/Divider";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { GROUP_KIND_ENUM, type GroupKind } from "@connected-repo/zod-schemas/enums.zod";
import type { Directory, Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { GROUPS } from "@frontend/copy/groups.copy";
import { GROUP_KIND_LABEL } from "@frontend/copy/levels.copy";
import { ROUTES } from "@frontend/copy/nav.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords, firstNameOf } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useCallback, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
	accountsByHolder,
	anyValue,
	groupNamed,
	sameAccounts,
	totalValue,
} from "../groups.utils";
import { AccountChecklist } from "./AccountChecklist";

const KIND_OPTIONS = GROUP_KIND_ENUM.map((value) => ({ value, label: GROUP_KIND_LABEL[value] }));

interface GroupDialogProps {
	open: boolean;
	/** The group being edited; null for a new one. */
	group: Group | null;
	/** The person's groups, to notice a name used twice. */
	groups: readonly Group[];
	/** Everything they can see; undefined while it loads. */
	directory: Directory | undefined;
	onClose: () => void;
}

/** One of the three notes under the summary: an icon and a sentence. */
const Note = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
	<Box
		component="li"
		sx={(theme) => ({
			display: "flex",
			gap: 1.25,
			color: theme.vars.palette.kosh.ink2,
			"& svg": { fontSize: 16, flex: "none", mt: "2px" },
		})}
	>
		{icon}
		<Typography variant="body2" component="span">
			{children}
		</Typography>
	</Box>
);

/**
 * New group / Edit group: a name, an optional kind, and the accounts to put
 * together. Two columns on desktop — the choices, and what they add up to —
 * and one column in a sheet on a phone.
 *
 * Mount it with a fresh `key` each time it opens: the form starts from
 * `group` and is not reset afterwards.
 */
export const GroupDialog = ({ open, group, groups, directory, onClose }: GroupDialogProps) => {
	const theme = useTheme();
	const twoColumns = useMediaQuery(theme.breakpoints.up("md"));
	const sheet = useMediaQuery(theme.breakpoints.down("sm"));
	const snack = useSnack();
	const refresh = useRefreshPeople();
	const kindLabelId = useId();
	const accountsLabelId = useId();
	const nameInput = useRef<HTMLInputElement | null>(null);
	// A new group starts in its name — but not in a sheet, where that would
	// raise the keyboard over the accounts. Done from the ref, so it also
	// holds when React mounts effects twice in development.
	const startInName = group === null && !sheet;
	const bindNameInput = useCallback(
		(element: HTMLInputElement | null) => {
			nameInput.current = element;
			if (startInName) element?.focus();
		},
		[startInName],
	);

	const [name, setName] = useState(group?.name ?? "");
	const [kind, setKind] = useState<GroupKind | null>(group?.kind ?? null);
	const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(group?.accountIds ?? []));
	const [nameMissing, setNameMissing] = useState(false);
	// Saving with nothing ticked is allowed, but only on the second press —
	// the first shows a note, in case it was an oversight.
	const [emptyNoted, setEmptyNoted] = useState(false);

	const create = useMutation(orpc.portfolio.createGroup.mutationOptions());
	const update = useMutation(orpc.portfolio.updateGroup.mutationOptions());
	const busy = create.isPending || update.isPending;
	const failure = create.error ?? update.error;

	const accounts = directory?.accounts ?? [];
	const sections = useMemo(
		() => accountsByHolder(directory?.holders ?? [], directory?.accounts ?? []),
		[directory],
	);
	const showValues = anyValue(accounts);
	const picked = accounts.filter((account) => chosen.has(account.id));
	const total = totalValue(picked);

	const trimmed = name.trim();
	const sameName = groupNamed(trimmed, groups, group?.id);
	const confirmingEmpty = emptyNoted && chosen.size === 0;

	// Accounts in the selection that someone else shared: they can leave the group.
	const shared = picked.filter((account) => account.sharedBy !== null);
	const sharers = [...new Set(shared.map((account) => firstNameOf(account.sharedBy?.name ?? "")))];

	const toggle = (accountId: string) => {
		setEmptyNoted(false);
		setChosen((current) => {
			const next = new Set(current);
			if (!next.delete(accountId)) next.add(accountId);
			return next;
		});
	};
	const setMany = (accountIds: readonly string[], on: boolean) => {
		setEmptyNoted(false);
		setChosen((current) => {
			const next = new Set(current);
			for (const id of accountIds) {
				if (on) next.add(id);
				else next.delete(id);
			}
			return next;
		});
	};

	const save = async () => {
		if (!trimmed) {
			setNameMissing(true);
			nameInput.current?.focus();
			return;
		}
		if (chosen.size === 0 && !emptyNoted) {
			setEmptyNoted(true);
			return;
		}
		const accountIds = [...chosen];
		try {
			if (group === null) {
				await create.mutateAsync({ name: trimmed, kind, accountIds });
			} else {
				// Only what changed: untouched members are left exactly as they are.
				await update.mutateAsync({
					groupId: group.id,
					...(trimmed !== group.name ? { name: trimmed } : {}),
					...(kind !== group.kind ? { kind } : {}),
					...(sameAccounts(accountIds, group.accountIds) ? {} : { accountIds }),
				});
			}
		} catch {
			return; // shown from the mutation's error, above the form
		}
		void refresh();
		snack(GROUPS.saved(trimmed));
		onClose();
	};

	const saveButton = (
		<Button
			variant="contained"
			size={sheet ? "large" : "medium"}
			disabled={busy || directory === undefined}
			onClick={save}
			sx={twoColumns ? { flex: 1, px: 1.5 } : { flex: "none" }}
		>
			{busy ? GROUPS.saving : confirmingEmpty ? GROUPS.saveEmpty : GROUPS.saveGroup}
		</Button>
	);
	const cancelButton = (
		<Button variant="text" disabled={busy} onClick={onClose}>
			{GROUPS.cancel}
		</Button>
	);

	const notes = (
		<Box
			component="ul"
			sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 1.5 }}
		>
			<Note icon={<IconLock />}>{GROUPS.noteOnlyYou}</Note>
			<Note icon={<IconTrend />}>{GROUPS.noteCompared(trimmed)}</Note>
			{shared.length > 0 && (
				<Note icon={<IconView />}>
					{GROUPS.noteShared(
						sharers,
						shared.length === 1 ? (shared[0]?.label ?? null) : null,
						showValues,
					)}
				</Note>
			)}
		</Box>
	);

	// The note may appear below the fold of a long checklist: bring it into view.
	const revealNote = useCallback((element: HTMLDivElement | null) => {
		element?.scrollIntoView({ block: "nearest" });
	}, []);
	const emptyNote = confirmingEmpty && (
		<Box ref={revealNote}>
			<Banner tone="warn">{GROUPS.savingEmpty(trimmed)}</Banner>
		</Box>
	);

	const count = chosen.size === 0 ? GROUPS.noneChosen : GROUPS.accountsCount(chosen.size);
	const summary = (
		<Box
			component="aside"
			aria-label={GROUPS.together(trimmed)}
			sx={(t) => ({
				display: "flex",
				flexDirection: "column",
				gap: 1.75,
				p: 2.5,
				borderRadius: "18px",
				bgcolor: t.vars.palette.kosh.surface2,
				// Stays in view while a long list of accounts scrolls beside it.
				position: twoColumns ? "sticky" : "static",
				top: 0,
			})}
		>
			{/* In the sheet the count sits beside the Save button instead. */}
			{!sheet && (
				<>
					<Typography variant="eyebrow" component="div" sx={{ overflowWrap: "anywhere" }}>
						{GROUPS.together(trimmed)}
					</Typography>
					<Box aria-live="polite">
						{total !== null ? (
							<>
								<Money value={total} figure sx={{ fontSize: "1.875rem" }} />
								<Typography variant="body2">{count}</Typography>
							</>
						) : (
							<Typography variant="h2" component="div">
								{count}
							</Typography>
						)}
					</Box>
					<Divider />
				</>
			)}
			{notes}
			{twoColumns && (
				<>
					{emptyNote}
					<Box sx={{ display: "flex", gap: 1.25, mt: 1 }}>
						{cancelButton}
						{saveButton}
					</Box>
				</>
			)}
		</Box>
	);

	// Sheet: what is chosen, beside the one button. Narrow dialog: the usual pair.
	// Two columns: the buttons close the summary, as on the design.
	const actions = twoColumns ? undefined : sheet ? (
		<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
			<Box sx={{ flex: 1, minWidth: 0 }} aria-live="polite">
				<Typography variant="caption" component="div">
					{GROUPS.selected(chosen.size)}
				</Typography>
				{total !== null && <Money value={total} sx={{ fontWeight: 700 }} />}
			</Box>
			{saveButton}
		</Box>
	) : (
		<>
			{cancelButton}
			{saveButton}
		</>
	);

	return (
		<ResponsiveDialog
			open={open}
			onClose={busy ? () => undefined : onClose}
			title={group === null ? GROUPS.dialogNew : GROUPS.dialogEdit}
			maxWidth="md"
			actions={actions}
		>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: twoColumns ? "minmax(0, 1fr) 300px" : "minmax(0, 1fr)",
					gap: twoColumns ? 3 : 2,
					alignItems: "start",
				}}
			>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
					{failure && <Banner tone="bad">{errorWords(failure, GROUPS.saveFailed)}</Banner>}

					<TextField
						label={GROUPS.nameLabel}
						placeholder={GROUPS.namePlaceholder}
						value={name}
						onChange={(event) => {
							setName(event.target.value);
							setNameMissing(false);
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") void save();
						}}
						error={nameMissing}
						helperText={
							nameMissing
								? GROUPS.nameRequired
								: sameName
									? GROUPS.nameTaken(sameName.name)
									: undefined
						}
						disabled={busy}
						fullWidth
						inputRef={bindNameInput}
						slotProps={{ htmlInput: { maxLength: 120 } }}
					/>

					<Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
						<Typography id={kindLabelId} variant="body2" component="div">
							<Box
								component="span"
								sx={(t) => ({ fontWeight: 700, color: t.vars.palette.kosh.ink })}
							>
								{GROUPS.kindLabel}
							</Box>{" "}
							<Typography variant="caption" component="span">
								{GROUPS.kindNote}
							</Typography>
						</Typography>
						<FilterChips<GroupKind>
							ariaLabel={GROUPS.kindLabel}
							showCheck
							options={KIND_OPTIONS}
							value={kind}
							// Tapping the chosen kind again takes it off: a kind is optional.
							onChange={(value) => setKind((current) => (current === value ? null : value))}
						/>
					</Box>

					<Box>
						<Box
							sx={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "baseline",
								gap: 1.5,
								mb: 0.5,
							}}
						>
							<Typography
								id={accountsLabelId}
								variant="body2"
								component="div"
								sx={(t) => ({ fontWeight: 700, color: t.vars.palette.kosh.ink })}
							>
								{GROUPS.accountsLabel}
							</Typography>
							<Typography variant="caption" sx={{ textAlign: "right" }}>
								{GROUPS.accountsNote}
							</Typography>
						</Box>

						{directory === undefined ? (
							<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
								<Skeleton variant="rounded" height={52} />
								<Skeleton variant="rounded" height={52} />
								<Skeleton variant="rounded" height={52} />
							</Box>
						) : accounts.length === 0 ? (
							<Banner
								tone="info"
								title={GROUPS.noAccounts.title}
								action={
									<Button variant="outlined" component={Link} to={ROUTES.accounts} onClick={onClose}>
										{GROUPS.noAccounts.action}
									</Button>
								}
								sx={{ flexWrap: "wrap" }}
							>
								{GROUPS.noAccounts.body}
							</Banner>
						) : (
							<Box role="group" aria-labelledby={accountsLabelId}>
								<AccountChecklist
									sections={sections}
									chosen={chosen}
									onToggle={toggle}
									onSetMany={setMany}
									showValues={showValues}
									disabled={busy}
								/>
								{accounts.length === 1 && (
									<Box sx={{ px: { xs: 0.5, sm: 1.5 }, pt: 1.5 }}>
										<Typography variant="subtitle2" component="div">
											{GROUPS.everyAccount.title}
										</Typography>
										<Typography variant="body2">{GROUPS.everyAccount.body}</Typography>
									</Box>
								)}
							</Box>
						)}
					</Box>

					{!twoColumns && emptyNote}
				</Box>

				{summary}
			</Box>
		</ResponsiveDialog>
	);
};
