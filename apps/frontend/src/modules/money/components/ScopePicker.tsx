import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { IconCheck, IconChevronDown, IconGroup } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import type { Scope } from "@connected-repo/zod-schemas/kosh/money.zod";
import { MONEY } from "@frontend/copy/money.copy";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { possessive } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { EVERYTHING, sameScope } from "../scope";

/** The caller's own groups — the scope picker's first section, and the Overview's chips. */
export const useMyGroups = () => useQuery(orpc.portfolio.listGroups.queryOptions());

interface ScopeChoice {
	scope: Scope;
	label: string;
	hint?: string;
}

/** Everything a money page can be narrowed to, in the order the picker lists it. */
export const useScopeChoices = () => {
	const directory = useDirectory();
	const groups = useMyGroups();
	const holders = directory.data?.holders ?? [];
	const accounts = directory.data?.accounts ?? [];
	const holderChoice = (h: (typeof holders)[number]): ScopeChoice => ({
		scope: { kind: "holder", id: h.id },
		label: MONEY.allOf(possessive(h.displayName)),
		hint: MONEY.accounts(accounts.filter((a) => a.personId === h.id).length),
	});
	return {
		isPending: directory.isPending || groups.isPending,
		/** Every person is a real selection, whether or not the picker offers them. */
		everyHolder: holders.map(holderChoice),
		groups: (groups.data ?? []).map<ScopeChoice>((g) => ({
			scope: { kind: "group", id: g.id },
			label: g.name,
			hint: MONEY.accounts(g.accountIds.length),
		})),
		// A person is worth offering only when they hold more than one account here
		// (with one, choosing the account says the same thing).
		holders: holders.filter((h) => accounts.filter((a) => a.personId === h.id).length > 1).map(holderChoice),
		accounts: accounts.map<ScopeChoice>((a) => ({ scope: { kind: "account", id: a.id }, label: a.label })),
	};
};

/** What a scope is called on screen; null when it names something that is not there (any more). */
export const useScopeLabel = (scope: Scope): { label: string | null; isPending: boolean } => {
	const choices = useScopeChoices();
	if (scope.kind === "everything") return { label: MONEY.everything, isPending: false };
	const found = [...choices.groups, ...choices.everyHolder, ...choices.accounts].find((c) => sameScope(c.scope, scope));
	return { label: found?.label ?? null, isPending: choices.isPending };
};

interface ScopePickerProps {
	value: Scope;
	onChange: (scope: Scope) => void;
}

/**
 * "Everything you can see ▾" — narrows a money page to one of the caller's
 * groups, all of one person's accounts, or a single account.
 */
export const ScopePicker = ({ value, onChange }: ScopePickerProps) => {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const menuId = useId();
	const choices = useScopeChoices();
	const { label } = useScopeLabel(value);

	const pick = (scope: Scope) => {
		setAnchor(null);
		onChange(scope);
	};
	const item = (choice: ScopeChoice) => {
		const on = sameScope(choice.scope, value);
		return (
			<MenuItem
				key={`${choice.scope.kind}:${"id" in choice.scope ? choice.scope.id : ""}`}
				role="menuitemradio"
				aria-checked={on}
				selected={on}
				onClick={() => pick(choice.scope)}
			>
				<Box component="span" sx={{ flex: 1, minWidth: 0 }}>
					<Box component="span" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
						{choice.label}
					</Box>
					{choice.hint && (
						<Typography component="span" variant="caption" sx={{ display: "block", color: "text.secondary" }}>
							{choice.hint}
						</Typography>
					)}
				</Box>
				{/* The tick, not only the tint, says which one is chosen. */}
				<IconCheck fontSize="small" aria-hidden sx={{ visibility: on ? "visible" : "hidden" }} />
			</MenuItem>
		);
	};
	const section = (title: string, list: ScopeChoice[]) =>
		list.length === 0
			? []
			: [
					<Typography
						key={`${title}-title`}
						component="li"
						role="presentation"
						variant="eyebrow"
						sx={{ display: "block", px: 2, pt: 1.5, pb: 0.5, color: "text.secondary" }}
					>
						{title}
					</Typography>,
					...list.map(item),
				];

	return (
		<>
			<Button
				variant="outlined"
				startIcon={<IconGroup />}
				endIcon={<IconChevronDown />}
				aria-haspopup="menu"
				aria-controls={anchor ? menuId : undefined}
				aria-expanded={anchor ? true : undefined}
				aria-label={`${MONEY.scopeLabel}: ${label ?? MONEY.everything}`}
				onClick={(event) => setAnchor(event.currentTarget)}
				sx={{ maxWidth: "100%" }}
			>
				<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					{label ?? MONEY.everything}
				</Box>
			</Button>
			<Menu
				id={menuId}
				anchorEl={anchor}
				open={anchor !== null}
				onClose={() => setAnchor(null)}
				slotProps={{ paper: { sx: { minWidth: 260, maxWidth: 360, maxHeight: "70vh" } } }}
			>
				{item({ scope: EVERYTHING, label: MONEY.everything })}
				{section(MONEY.scopeGroups, choices.groups)}
				{section(MONEY.scopePeople, choices.holders)}
				{section(MONEY.scopeAccounts, choices.accounts)}
			</Menu>
		</>
	);
};
