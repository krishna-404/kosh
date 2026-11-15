import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Checkbox } from "@connected-repo/ui-mui/form/Checkbox";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { DirectoryAccount } from "@connected-repo/zod-schemas/kosh/people.zod";
import { GROUPS } from "@frontend/copy/groups.copy";
import { brokerNameOf, firstNameOf } from "@frontend/modules/access/people.utils";
import type { HolderSection } from "../groups.utils";

interface AccountChecklistProps {
	sections: readonly HolderSection[];
	chosen: ReadonlySet<string>;
	onToggle: (accountId: string) => void;
	/** Tick (or untick) several at once — "Select all of Anil’s". */
	onSetMany: (accountIds: readonly string[], on: boolean) => void;
	/** Show each account's value; false until values exist. */
	showValues: boolean;
	disabled?: boolean;
}

interface AccountRowProps {
	account: DirectoryAccount;
	on: boolean;
	onToggle: () => void;
	showValues: boolean;
	disabled: boolean;
}

/** One account to tick. The whole row is the checkbox's label. */
const AccountRow = ({ account, on, onToggle, showValues, disabled }: AccountRowProps) => {
	const broker = brokerNameOf(account);
	// Most accounts are named after their broker ("Anil · Zerodha"); say it again only when not.
	const brokerUnsaid = !account.label.toLowerCase().includes(broker.toLowerCase());
	const hasValue = showValues && account.value !== null;
	return (
		<Box
			component="label"
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				return {
					display: "flex",
					alignItems: "center",
					gap: 1.5,
					minHeight: { xs: 60, sm: 56 },
					pl: 0.5,
					pr: 1.5,
					py: 0.75,
					borderRadius: { xs: 0, sm: "12px" },
					cursor: disabled ? "default" : "pointer",
					bgcolor: on ? k.accentSoft : "transparent",
					transition: theme.transitions.create("background-color", { duration: 200 }),
					"&:hover": disabled || on ? undefined : { bgcolor: k.surface2 },
					// On a phone the rows sit in one bordered list, a hairline between them.
					"& + &": { borderTop: { xs: `1px solid ${k.line}`, sm: 0 } },
				};
			}}
		>
			<Checkbox checked={on} onChange={onToggle} disabled={disabled} />
			<BrokerMark broker={broker} sx={{ display: { xs: "none", sm: "grid" } }} />
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Typography component="div" variant="subtitle2" noWrap>
					{account.label}
				</Typography>
				{/* A phone has no room for the mark or a value column: what they say goes on a second line. */}
				{(brokerUnsaid || hasValue) && (
					<Typography component="div" variant="caption" noWrap sx={{ display: { sm: "none" } }}>
						{brokerUnsaid && broker}
						{brokerUnsaid && hasValue && " · "}
						{hasValue && <Money value={account.value} />}
					</Typography>
				)}
			</Box>
			{showValues && (
				<Money value={account.value} sx={{ display: { xs: "none", sm: "inline" } }} />
			)}
			<LevelBadge level={account.myLevel} />
		</Box>
	);
};

/**
 * The accounts someone can put in a group: every account they can see, under
 * the holder it belongs to, each with their own level on it.
 */
export const AccountChecklist = ({
	sections,
	chosen,
	onToggle,
	onSetMany,
	showValues,
	disabled = false,
}: AccountChecklistProps) => (
	<Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 1.5, sm: 0.5 } }}>
		{sections.map((section) => {
			const name = section.holder?.displayName ?? GROUPS.others;
			const ids = section.accounts.map((account) => account.id);
			const allOn = ids.every((id) => chosen.has(id));
			const headingId = `group-holder-${section.key}`;
			return (
				<Box key={section.key} role="group" aria-labelledby={headingId}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1,
							minHeight: { xs: 44, sm: 36 },
							px: { xs: 0.5, sm: 1.5 },
						}}
					>
						<Typography id={headingId} variant="eyebrow" component="div" noWrap sx={{ flex: 1 }}>
							{name}
						</Typography>
						{section.holder && ids.length > 1 && (
							<Button
								variant="text"
								size="small"
								disabled={disabled}
								onClick={() => onSetMany(ids, !allOn)}
								sx={{ minHeight: { xs: 44, sm: 36 }, mr: { xs: -1, sm: -1.5 } }}
							>
								{allOn
									? GROUPS.clearAll(firstNameOf(name))
									: GROUPS.selectAll(firstNameOf(name))}
							</Button>
						)}
					</Box>
					<Box
						sx={(theme) => ({
							display: "flex",
							flexDirection: "column",
							gap: { xs: 0, sm: "2px" },
							border: { xs: `1px solid ${theme.vars.palette.kosh.line}`, sm: 0 },
							borderRadius: { xs: "16px", sm: 0 },
							overflow: { xs: "hidden", sm: "visible" },
						})}
					>
						{section.accounts.map((account) => (
							<AccountRow
								key={account.id}
								account={account}
								on={chosen.has(account.id)}
								onToggle={() => onToggle(account.id)}
								showValues={showValues}
								disabled={disabled}
							/>
						))}
					</Box>
				</Box>
			);
		})}
	</Box>
);
