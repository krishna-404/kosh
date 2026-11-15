import { Page } from "@frontend/components/layout/Page";
import { ROUTES } from "@frontend/copy/nav.copy";

/** One script across the accounts that hold it. (Placeholder until the holdings workstream lands.) */
export default function ScriptPage() {
	return <Page title="Holding" back={ROUTES.holdings} />;
}
