import { Banner } from "@connected-repo/ui-mui/kosh/Banner";

export interface FeePanelProps {
	accountId: string;
}

/**
 * What a fund manager is paid for one account from outside it, what that has
 * come to, and — for an owner — setting or changing it. (Placeholder until
 * the fees workstream lands.)
 */
export const FeePanel = (_props: FeePanelProps) => <Banner tone="info">Fees arrive here shortly.</Banner>;
