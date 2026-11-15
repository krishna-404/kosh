import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconAccounts } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";

import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { NAV } from "@frontend/copy/nav.copy";


export default function AccountsAndPeoplePage() {
	return (
		<Page title={NAV.accounts} subtitle="The people whose investments are here, their broker accounts, and who can see each one.">
			<SectionCard>
				<EmptyState
					icon={<IconAccounts />}
					title={EMPTY.accounts.title}

				>
					{EMPTY.accounts.body}
				</EmptyState>
			</SectionCard>
		</Page>
	);
}
