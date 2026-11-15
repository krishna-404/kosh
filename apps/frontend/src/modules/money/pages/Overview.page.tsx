import { Button } from "@connected-repo/ui-mui/form/Button";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconOverview } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { Link } from "react-router";

export default function OverviewPage() {
	return (
		<Page title={NAV.overview} subtitle="What it is all worth, how it has done, and what moved it.">
			<SectionCard>
				<EmptyState
					icon={<IconOverview />}
					title={EMPTY.overview.title}
					actions={
						<Button component={Link} to={ROUTES.accounts} variant="contained">
							{EMPTY.overview.action}
						</Button>
					}
				>
					{EMPTY.overview.body}
				</EmptyState>
			</SectionCard>
		</Page>
	);
}
