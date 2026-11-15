import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconAddPerson, IconFile } from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Page } from "@frontend/components/layout/Page";
import { ROUTES } from "@frontend/copy/nav.copy";
import { ShareDialog } from "@frontend/modules/access/components/ShareDialog";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { brokerNameOf } from "@frontend/modules/access/people.utils";
import { useState } from "react";
import { useParams } from "react-router";

/**
 * One account. For now: what it is, your level on it, and sharing. Its
 * statements, cash flows, holdings and returns arrive with the phases that
 * bring them in.
 */
export default function AccountPage() {
	const { accountId } = useParams();
	const { data, isPending } = useDirectory();
	const [sharing, setSharing] = useState(false);

	const account = data?.accounts.find((a) => a.id === accountId);
	const holder = data?.holders.find((h) => h.id === account?.personId);

	if (isPending) return <Page title="Account" back={ROUTES.accounts} />;

	// Not found and not shared look the same on purpose: an account you
	// cannot see does not exist as far as you can tell.
	if (!account || !holder)
		return (
			<Page title="Account" back={ROUTES.accounts}>
				<Banner tone="warn">
					This account isn’t here. It may have been removed, or it is no longer shared with you.
				</Banner>
			</Page>
		);

	const broker = brokerNameOf(account);
	return (
		<Page
			title={account.label}
			subtitle={`${broker} · held by ${holder.displayName}`}
			back={ROUTES.accounts}
			actions={
				<>
					<LevelBadge level={account.myLevel} size="lg" />
					{account.myLevel === "owner" && (
						<Button variant="outlined" startIcon={<IconAddPerson />} onClick={() => setSharing(true)}>
							Share
						</Button>
					)}
				</>
			}
		>
			<SectionCard>
				<EmptyState icon={<IconFile />} title="No statements yet">
					{`Upload a ${broker} statement to see holdings and returns. Tradebook, ledger or holdings work.`}
				</EmptyState>
			</SectionCard>
			<ShareDialog target={sharing ? { accountId: account.id } : null} onClose={() => setSharing(false)} />
		</Page>
	);
}
