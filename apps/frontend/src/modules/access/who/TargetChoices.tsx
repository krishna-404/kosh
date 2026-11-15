import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { IconChevronRight, IconHolderWide } from "@connected-repo/ui-mui/kosh/icons";
import { RowItem, RowList } from "@connected-repo/ui-mui/kosh/RowItem";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { WHO } from "@frontend/copy/who.copy";
import { brokerNameOf, firstNameOf, possessive } from "@frontend/modules/access/people.utils";
import { rowLines } from "./rowLines";
import type { MatrixAccount, MatrixHolder, ShareTarget } from "./who.utils";

interface TargetChoicesProps {
	choices: { holder: MatrixHolder; wide: boolean; accounts: MatrixAccount[] }[];
	onChoose: (target: ShareTarget) => void;
}

/**
 * The things that can be shared, as a list to pick one from: everything a
 * person holds (present and future), or one account.
 */
export const TargetChoices = ({ choices, onChoose }: TargetChoicesProps) => (
	<Box
		sx={(theme) => ({
			border: `1px solid ${theme.vars.palette.kosh.line}`,
			borderRadius: 2,
			overflow: "hidden",
		})}
	>
		<RowList sx={(theme) => rowLines(theme.vars.palette.kosh.line)}>
			{choices.flatMap(({ holder, wide, accounts }) => [
				...(wide
					? [
							<RowItem
								key={`holder-${holder.id}`}
								leading={
									<Box
										aria-hidden
										sx={(theme) => ({
											width: 38,
											display: "grid",
											placeItems: "center",
											color: theme.vars.palette.kosh.ink2,
										})}
									>
										<IconHolderWide />
									</Box>
								}
								primary={WHO.allOfAccounts(possessive(firstNameOf(holder.displayName)))}
								secondary={WHO.wideChoice}
								trailing={<Chevron />}
								onClick={() => onChoose({ personId: holder.id })}
							/>,
						]
					: []),
				...accounts.map((account) => (
					<RowItem
						key={account.id}
						leading={<BrokerMark broker={brokerNameOf(account)} />}
						primary={account.label}
						secondary={`${holder.displayName} · ${WHO.onlyThisAccount.toLowerCase()}`}
						trailing={<Chevron />}
						onClick={() => onChoose({ accountId: account.id })}
					/>
				)),
			])}
		</RowList>
	</Box>
);

const Chevron = () => (
	<Box
		aria-hidden
		sx={(theme) => ({ display: "flex", color: theme.vars.palette.kosh.ink3 })}
	>
		<IconChevronRight />
	</Box>
);
