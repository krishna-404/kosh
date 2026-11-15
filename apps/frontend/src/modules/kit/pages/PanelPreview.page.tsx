import { Page } from "@frontend/components/layout/Page";
import { ROUTES } from "@frontend/copy/nav.copy";
import { DividendsPanel } from "@frontend/modules/account/dividends/DividendsPanel";
import { FeePanel } from "@frontend/modules/account/fees/FeePanel";
import { useParams } from "react-router";

/**
 * A development aid, like the component gallery: one of the account page's
 * panels on its own, for any account id — `/kit/panel/dividends/<id>` or
 * `/kit/panel/fees/<id>`. Not part of the product, not in production builds.
 */
export default function PanelPreviewPage() {
	const { panel, accountId = "" } = useParams();
	return (
		<Page title={panel === "fees" ? "Fund manager’s fee" : "Dividends"} back={ROUTES.accounts}>
			{panel === "fees" ? <FeePanel accountId={accountId} /> : <DividendsPanel accountId={accountId} />}
		</Page>
	);
}
