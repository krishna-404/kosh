import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type {
	DirectoryAccount,
	DirectoryHolder,
} from "@connected-repo/zod-schemas/kosh/people.zod";
import { ACCOUNTS } from "@frontend/copy/accounts.copy";
import { brokerNameOf, firstNameOf } from "@frontend/modules/access/people.utils";
import { AccountRowShell, AccountRows, MoneyCells, phoneReturn, RowLink } from "./accountRow.parts";

interface SharedAccountsProps {
	/** Accounts the signed-in person can see but does not own. */
	accounts: readonly DirectoryAccount[];
	holders: ReadonlyMap<string, DirectoryHolder>;
	withMoney: boolean;
}

/**
 * Accounts other people shared. Each says whose it is, what you can do with
 * it and who shared it — never who else can see it: that is for owners.
 */
export const SharedAccounts = ({ accounts, holders, withMoney }: SharedAccountsProps) => (
	<SectionCard padding="none" sx={{ overflow: "hidden" }}>
		<AccountRows>
			{accounts.map((account) => {
				const holder = holders.get(account.personId);
				const sharedBy = account.sharedBy
					? ACCOUNTS.sharedBy(firstNameOf(account.sharedBy.name || account.sharedBy.email))
					: null;
				const returns = phoneReturn(account);
				const newTag = account.isNew && <Tag tone="new">{ACCOUNTS.newTag}</Tag>;
				return (
					<AccountRowShell key={account.id} withMoney={withMoney}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}>
							{holder && (
								<HolderAvatar
									name={holder.displayName}
									colorKey={holder.id}
									kind={holder.kind}
									size="sm"
								/>
							)}
							<BrokerMark
								broker={brokerNameOf(account)}
								sx={{ display: { xs: "none", sm: "grid" } }}
							/>
							<Box sx={{ minWidth: 0, flex: 1 }}>
								<Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
									<RowLink account={account} />
									<Box sx={{ display: { xs: "contents", md: "none" } }}>{newTag}</Box>
								</Box>
								<Typography
									variant="caption"
									component="div"
									sx={{
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: { xs: "normal", md: "nowrap" },
									}}
								>
									{holder?.displayName}
									<Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>
										{sharedBy && ` · ${sharedBy}`}
										{returns && " · "}
										{returns}
									</Box>
								</Typography>
							</Box>
						</Box>
						{withMoney && <MoneyCells account={account} />}
						{/* Phone: the amount sits above the level, so the name keeps its room. */}
						<Box
							sx={{
								flex: "none",
								display: "flex",
								flexDirection: "column",
								alignItems: { xs: "flex-end", md: "flex-start" },
								gap: 0.5,
							}}
						>
							{withMoney && account.value !== null && (
								<Box sx={{ display: { xs: "block", md: "none" }, fontWeight: 700 }}>
									<Money value={account.value} />
								</Box>
							)}
							<LevelBadge level={account.myLevel} />
						</Box>
						<Box
							sx={{
								display: { xs: "none", md: "flex" },
								alignItems: "center",
								gap: 1,
								minWidth: 0,
								// The caption row's last column has no cell here.
								gridColumn: "span 2",
							}}
						>
							<Typography variant="body2" component="span" noWrap>
								{sharedBy}
							</Typography>
							{newTag}
						</Box>
					</AccountRowShell>
				);
			})}
		</AccountRows>
	</SectionCard>
);
