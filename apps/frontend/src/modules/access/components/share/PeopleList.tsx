import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { IconActivity, IconHolderWide } from "@connected-repo/ui-mui/kosh/icons";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import type { AccessList } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ROUTES } from "@frontend/copy/nav.copy";
import { SHARING } from "@frontend/copy/sharing.copy";
import { possessive } from "@frontend/modules/access/people.utils";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { EntryRow, type ShareActions, type ShareContext } from "./EntryRow";

interface PeopleListProps {
	list: AccessList;
	context: ShareContext;
	actions: ShareActions;
	/** The broker's name for one of the holder's accounts, for its mark. */
	brokerOf: (accountId: string) => string;
	/** Following a link away closes the dialog. */
	onLeavePage: () => void;
}

const Group = ({
	title,
	icon,
	children,
	empty,
}: {
	title: string;
	icon?: ReactNode;
	children: ReactNode[];
	empty?: string;
}) => (
	<Box component="section">
		<Typography
			variant="eyebrow"
			component="h4"
			sx={{ display: "flex", alignItems: "center", gap: 0.75, m: 0, "& svg": { fontSize: 16 } }}
		>
			{icon}
			{title}
		</Typography>
		{children.length > 0 ? (
			<Box
				component="ul"
				sx={(theme) => ({
					listStyle: "none",
					m: 0,
					p: 0,
					"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
				})}
			>
				{children}
			</Box>
		) : (
			<Typography variant="body2" sx={{ py: 1.25 }}>
				{empty}
			</Typography>
		)}
	</Box>
);

/**
 * Everyone with access, grouped by how wide it is: all of the holder's
 * accounts, only this account, or only some of the holder's accounts.
 */
export const PeopleList = ({ list, context, actions, brokerOf, onLeavePage }: PeopleListProps) => {
	const onAccount = list.target.kind === "account";
	const holderPossessive = possessive(context.holderFirstName);

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
			<Box
				sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 }}
			>
				<Typography variant="h3">{SHARING.people}</Typography>
				<Link component={RouterLink} to={ROUTES.access} onClick={onLeavePage} variant="body2">
					{SHARING.whoCanSeeWhat}
				</Link>
			</Box>

			<Group
				title={
					onAccount
						? SHARING.groupHolder(holderPossessive)
						: SHARING.groupHolderOnHolder(holderPossessive)
				}
				icon={<IconHolderWide />}
			>
				{list.holderWide.map((entry) => (
					<EntryRow
						key={entry.grantId}
						entry={entry}
						place={onAccount ? "holder" : "own"}
						context={context}
						actions={actions}
					/>
				))}
			</Group>

			{onAccount && (
				<Group title={SHARING.groupDirect} empty={SHARING.nobodyYet}>
					{list.direct.map((entry) => (
						<EntryRow
							key={entry.grantId}
							entry={entry}
							place="own"
							context={context}
							actions={actions}
						/>
					))}
				</Group>
			)}

			{!onAccount && list.onAccounts.length > 0 && (
				<Group title={SHARING.groupSome(holderPossessive)}>
					{list.onAccounts.map((entry) => (
						<EntryRow
							key={entry.grantId}
							entry={entry}
							place="account"
							account={{
								id: entry.accountId,
								label: entry.accountLabel,
								broker: brokerOf(entry.accountId),
							}}
							context={context}
							actions={actions}
						/>
					))}
				</Group>
			)}

			<Typography
				variant="caption"
				component="p"
				sx={{ display: "flex", alignItems: "center", gap: 1, m: 0, "& svg": { fontSize: 16 } }}
			>
				<IconActivity aria-hidden />
				<span>
					{SHARING.activityNote}
					<Link component={RouterLink} to={ROUTES.activity} onClick={onLeavePage}>
						{SHARING.activityLink}
					</Link>
					{SHARING.activityNoteTail}
				</span>
			</Typography>
		</Box>
	);
};
