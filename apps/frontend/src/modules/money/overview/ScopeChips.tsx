import { Chip } from "@connected-repo/ui-mui/data-display/Chip";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { IconAdd } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Scope } from "@connected-repo/zod-schemas/kosh/money.zod";
import type { Group } from "@connected-repo/zod-schemas/kosh/people.zod";
import { MONEY } from "@frontend/copy/money.copy";
import { ROUTES } from "@frontend/copy/nav.copy";
import { OVERVIEW } from "@frontend/copy/overview.copy";
import { Link } from "react-router";
import { EVERYTHING, scopeFromParam, scopeToParam } from "../scope";

interface ScopeChipsProps {
	scope: Scope;
	onChange: (scope: Scope) => void;
	/** Every account the person can see. */
	accountCount: number;
	groups: readonly Group[];
}

const ALL = "everything";

/** "Parents · 3": the count is of accounts, which is said aloud though not shown. */
const ChipLabel = ({ name, count }: { name: string; count: number }) => (
	<>
		{name} · {count}
		<Box
			component="span"
			sx={{
				position: "absolute",
				width: 1,
				height: 1,
				overflow: "hidden",
				clipPath: "inset(50%)",
				whiteSpace: "nowrap",
			}}
		>
			{OVERVIEW.chipUnit(count)}
		</Box>
	</>
);

/**
 * The quick way to narrow the Overview: everything, or one of the person's
 * own groups — and a way to make a new group. A person or a single account
 * is chosen in the picker above; then no chip is lit.
 */
export const ScopeChips = ({ scope, onChange, accountCount, groups }: ScopeChipsProps) => (
	<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
		<FilterChips
			ariaLabel={MONEY.scopeLabel}
			value={scope.kind === "everything" ? ALL : scope.kind === "group" ? scopeToParam(scope) : null}
			onChange={(value) => onChange(value === ALL ? EVERYTHING : scopeFromParam(value))}
			options={[
				{ value: ALL, label: <ChipLabel name={MONEY.everythingShort} count={accountCount} /> },
				...groups.map((group) => ({
					value: scopeToParam({ kind: "group", id: group.id }) ?? ALL,
					label: <ChipLabel name={group.name} count={group.accountIds.length} />,
				})),
			]}
		/>
		<Chip
			component={Link}
			to={ROUTES.groups}
			clickable
			variant="outlined"
			icon={<IconAdd />}
			label={OVERVIEW.newGroup}
		/>
	</Box>
);
