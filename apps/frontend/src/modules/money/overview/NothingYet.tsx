import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import {
	IconAdd,
	IconAddPerson,
	IconFile,
	IconGroup,
	IconInbox,
	IconPeople,
	IconUpload,
} from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { Directory, DirectoryAccount } from "@connected-repo/zod-schemas/kosh/people.zod";
import { WELCOME } from "@frontend/copy/accounts.copy";
import { accountTabPath, ROUTES } from "@frontend/copy/nav.copy";
import { OVERVIEW } from "@frontend/copy/overview.copy";
import { brokerNameOf, firstNameOf } from "@frontend/modules/access/people.utils";
import { Link } from "react-router";
import { firstToUpload } from "./overview.utils";

const fullWidthOnPhone = { flex: { xs: "1 1 100%", sm: "none" } };

/**
 * First sign-in, no accounts at all: the welcome from the States board.
 * People and accounts are added on Accounts and people, so both buttons go there.
 */
export const Welcome = ({ me }: { me: Directory["me"] }) => (
	<SectionCard>
		<EmptyState
			icon={<IconPeople />}
			title={WELCOME.title(firstNameOf(me.name))}
			actions={
				<>
					<Button
						component={Link}
						to={ROUTES.accounts}
						variant="contained"
						size="large"
						startIcon={<IconAdd />}
						sx={fullWidthOnPhone}
					>
						{WELCOME.addYourself}
					</Button>
					<Button
						component={Link}
						to={ROUTES.accounts}
						variant="outlined"
						size="large"
						startIcon={<IconAddPerson />}
						sx={fullWidthOnPhone}
					>
						{WELCOME.addSomeoneElse}
					</Button>
				</>
			}
			sx={{ pb: { xs: 2, md: 3 } }}
		>
			{WELCOME.body}
		</EmptyState>
		<Box sx={{ maxWidth: 560, mx: "auto", pb: { xs: 1, md: 3 } }}>
			<Banner icon={<IconInbox fontSize="inherit" />}>
				{WELCOME.expectingLead}
				<Box component="b" sx={{ overflowWrap: "anywhere" }}>
					{me.email}
				</Box>
				.
			</Banner>
		</Box>
	</SectionCard>
);

interface NoStatementsProps {
	/** The accounts in view; null when the directory could not say. */
	accounts: readonly DirectoryAccount[] | null;
}

/**
 * Accounts, but no statements in any of them: say what to do next and take
 * the person to the first account they may upload to. Someone who can only
 * view is told what they are waiting for instead.
 */
export const NoStatements = ({ accounts }: NoStatementsProps) => {
	const WORDS = OVERVIEW.noStatements;
	const target = firstToUpload(accounts);
	const single = accounts?.length === 1;
	// A group with nothing in it: the next step is on Groups, not on a statement.
	if (accounts?.length === 0)
		return (
			<SectionCard>
				<EmptyState
					icon={<IconGroup />}
					title={WORDS.noAccountsTitle}
					actions={
						<Button component={Link} to={ROUTES.groups} variant="outlined" size="large" sx={fullWidthOnPhone}>
							{WORDS.goToGroups}
						</Button>
					}
				>
					{WORDS.noAccounts}
				</EmptyState>
			</SectionCard>
		);
	return (
		<SectionCard>
			<EmptyState
				icon={<IconFile />}
				title={WORDS.title}
				actions={
					target ? (
						<Button
							component={Link}
							to={accountTabPath(target.id, "statements")}
							variant="contained"
							size="large"
							startIcon={<IconUpload />}
							sx={fullWidthOnPhone}
						>
							{single ? WORDS.upload : WORDS.uploadTo(target.label)}
						</Button>
					) : (
						<Button component={Link} to={ROUTES.accounts} variant="outlined" size="large" sx={fullWidthOnPhone}>
							{WORDS.goToAccounts}
						</Button>
					)
				}
			>
				{target ? (single ? WORDS.one(brokerNameOf(target)) : WORDS.many(target.label)) : WORDS.viewOnly}
			</EmptyState>
		</SectionCard>
	);
};
