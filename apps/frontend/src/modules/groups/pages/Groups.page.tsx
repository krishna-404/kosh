import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconGroup } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";

import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { NAV } from "@frontend/copy/nav.copy";


export default function GroupsPage() {
	return (
		<Page title={NAV.groups} subtitle="Sets of accounts to add up and compare — family, a fund manager, your own trading. Only you see them.">
			<SectionCard>
				<EmptyState
					icon={<IconGroup />}
					title={EMPTY.groups.title}

				>
					{EMPTY.groups.body}
				</EmptyState>
			</SectionCard>
		</Page>
	);
}
