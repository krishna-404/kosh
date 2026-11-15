import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconGrid } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";

import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { NAV } from "@frontend/copy/nav.copy";


export default function WhoCanSeeWhatPage() {
	return (
		<Page title={NAV.access} subtitle="Every person who can see your accounts, and exactly what they can see.">
			<SectionCard>
				<EmptyState
					icon={<IconGrid />}
					title={EMPTY.access.title}

				>
					{EMPTY.access.body}
				</EmptyState>
			</SectionCard>
		</Page>
	);
}
