import { Button } from "@connected-repo/ui-mui/form/Button";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconTrend } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Page } from "@frontend/components/layout/Page";
import { EMPTY } from "@frontend/copy/empty.copy";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { Link } from "react-router";

export default function HoldingsPage() {
	return (
		<Page title={NAV.holdings} subtitle="Every share and fund across the accounts you can see.">
			<SectionCard>
				<EmptyState
					icon={<IconTrend />}
					title={EMPTY.holdings.title}
					actions={
						<Button component={Link} to={ROUTES.accounts} variant="contained">
							{EMPTY.holdings.action}
						</Button>
					}
				>
					{EMPTY.holdings.body}
				</EmptyState>
			</SectionCard>
		</Page>
	);
}
