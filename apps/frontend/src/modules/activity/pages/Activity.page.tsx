import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconActivity } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";

import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { NAV } from "@frontend/copy/nav.copy";


export default function ActivityPage() {
	return (
		<Page title={NAV.activity} subtitle="Every upload, undo, answer and access change on accounts you can see — who did it and when.">
			<SectionCard>
				<EmptyState
					icon={<IconActivity />}
					title={EMPTY.activity.title}

				>
					{EMPTY.activity.body}
				</EmptyState>
			</SectionCard>
		</Page>
	);
}
