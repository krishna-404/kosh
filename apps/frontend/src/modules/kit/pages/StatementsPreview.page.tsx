import { Page } from "@frontend/components/layout/Page";
import { ROUTES } from "@frontend/copy/nav.copy";
import { StatementsTab } from "@frontend/modules/account/statements/StatementsTab";
import { useParams, useSearchParams } from "react-router";

/**
 * A development aid, like the component gallery: the "Statements and
 * questions" tab on its own, for any account id. `?readonly=1` shows it as
 * someone who cannot edit. Not part of the product, not in production builds.
 */
export default function StatementsPreviewPage() {
	const { accountId = "" } = useParams();
	const [params] = useSearchParams();
	return (
		<Page title="Statements and questions" back={ROUTES.accounts}>
			<StatementsTab accountId={accountId} canEdit={params.get("readonly") === null} />
		</Page>
	);
}
