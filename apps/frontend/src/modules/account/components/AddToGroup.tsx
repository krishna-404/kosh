import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { IconAdd, IconCheck, IconGroup } from "@connected-repo/ui-mui/kosh/icons";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Divider } from "@connected-repo/ui-mui/layout/Divider";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import type { Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { GROUP_KIND_LABEL } from "@frontend/copy/levels.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { ROUTES } from "@frontend/copy/nav.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords } from "@frontend/modules/access/people.utils";
import { useMyGroups } from "@frontend/modules/money/components/ScopePicker";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { Link } from "react-router";
import { toggleMember } from "../account.utils";

interface AddToGroupProps {
	accountId: string;
	accountLabel: string;
}

/**
 * "Add to a group": the signed-in person's own groups, with a tick on the
 * ones this account is in. Picking one puts the account in or takes it out.
 * Groups are personal — anyone who can see the account can do this, and it
 * shares nothing.
 */
export const AddToGroup = ({ accountId, accountLabel }: AddToGroupProps) => {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const menuId = useId();
	const snack = useSnack();
	const groups = useMyGroups();
	const refreshPeople = useRefreshPeople();
	const queryClient = useQueryClient();
	const update = useMutation(orpc.portfolio.updateGroup.mutationOptions());

	const save = async (group: Group, accountIds: string[], undoTo?: string[]) => {
		try {
			await update.mutateAsync({ groupId: group.id, accountIds });
			// The group's own figures are built from its accounts: mark them stale
			// so they are worked out again the next time they are looked at.
			void queryClient.invalidateQueries({ queryKey: orpc.money.key(), refetchType: "none" });
			await refreshPeople();
			const isIn = accountIds.includes(accountId);
			snack({
				message: (isIn ? ACCOUNT.addedTo : ACCOUNT.leftGroup)(accountLabel, group.name),
				...(undoTo ? { actionLabel: ACCOUNT.undo, onAction: () => void save(group, undoTo) } : {}),
			});
		} catch (error) {
			snack(errorWords(error, ACCOUNT.groupFailed));
		}
	};
	const toggle = (group: Group) =>
		void save(group, toggleMember(group.accountIds, accountId), [...group.accountIds]);

	const list = groups.data ?? [];
	return (
		<>
			<Button
				variant="outlined"
				startIcon={<IconGroup />}
				aria-haspopup="menu"
				aria-controls={anchor ? menuId : undefined}
				aria-expanded={anchor ? true : undefined}
				onClick={(event) => setAnchor(event.currentTarget)}
			>
				{ACCOUNT.addToGroup}
			</Button>
			<Menu
				id={menuId}
				anchorEl={anchor}
				open={anchor !== null}
				onClose={() => setAnchor(null)}
				anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
				transformOrigin={{ horizontal: "right", vertical: "top" }}
				slotProps={{
					paper: { sx: { width: 300, maxWidth: "calc(100vw - 32px)", maxHeight: "70vh", mt: 0.75 } },
					list: { "aria-label": ACCOUNT.groupsTitle },
				}}
			>
				<Typography
					component="li"
					role="presentation"
					variant="eyebrow"
					sx={{ display: "block", px: 2, pt: 1, pb: 0.5, color: "text.secondary" }}
				>
					{ACCOUNT.groupsTitle}
				</Typography>
				{groups.isPending && <Note>{ACCOUNT.groupsLoading}</Note>}
				{groups.isError && (
					<MenuItem onClick={() => void groups.refetch()} sx={{ whiteSpace: "normal" }}>
						<Box component="span" sx={{ flex: 1, minWidth: 0 }}>
							{errorWords(groups.error, ACCOUNT.groupsFailed)}{" "}
							<Box component="span" sx={{ fontWeight: 700 }}>
								{MONEY.retry}
							</Box>
						</Box>
					</MenuItem>
				)}
				{groups.isSuccess && list.length === 0 && <Note>{ACCOUNT.groupsNone}</Note>}
				{list.map((group) => {
					const isIn = group.accountIds.includes(accountId);
					return (
						<MenuItem
							key={group.id}
							role="menuitemcheckbox"
							aria-checked={isIn}
							selected={isIn}
							disabled={update.isPending}
							onClick={() => toggle(group)}
						>
							<Box component="span" sx={{ flex: 1, minWidth: 0 }}>
								<Box component="span" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
									{group.name}
								</Box>
								<Typography component="span" variant="caption" sx={{ display: "block", color: "text.secondary" }}>
									{[group.kind ? GROUP_KIND_LABEL[group.kind] : null, MONEY.accounts(group.accountIds.length)]
										.filter(Boolean)
										.join(" · ")}
								</Typography>
							</Box>
							{/* The tick, not only the tint, says the account is in this group. */}
							<IconCheck fontSize="small" aria-hidden sx={{ visibility: isIn ? "visible" : "hidden" }} />
						</MenuItem>
					);
				})}
				<Divider component="li" sx={{ my: 0.75 }} />
				<MenuItem component={Link} to={ROUTES.groups} onClick={() => setAnchor(null)}>
					<IconAdd fontSize="small" />
					{ACCOUNT.newGroup}
				</MenuItem>
			</Menu>
		</>
	);
};

/** A quiet line inside the menu: loading, nothing yet, or what went wrong. */
const Note = ({ children }: { children: ReactNode }) => (
	<Typography
		component="li"
		role="presentation"
		variant="body2"
		sx={{ px: 2, py: 1, whiteSpace: "normal" }}
	>
		{children}
	</Typography>
);
