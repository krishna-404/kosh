import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconInbox } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";

import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { NAV } from "@frontend/copy/nav.copy";


export default function SharedWithMePage() {
	return (
		<Page title={NAV.shared} subtitle="Accounts other people have shared with you, and what you can do with each.">
			<SectionCard>
				<EmptyState
					icon={<IconInbox />}
					title={EMPTY.shared.title}

				>
					{EMPTY.shared.body}
				</EmptyState>
			</SectionCard>
		</Page>
	);
}
