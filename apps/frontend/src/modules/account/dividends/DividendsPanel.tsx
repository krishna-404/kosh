import { Banner } from "@connected-repo/ui-mui/kosh/Banner";

export interface DividendsPanelProps {
	accountId: string;
}

/**
 * One account's dividends: what Kosh worked out was due, what has been
 * confirmed, and the answers a person can give. (Placeholder until the
 * dividends workstream lands.)
 */
export const DividendsPanel = (_props: DividendsPanelProps) => <Banner tone="info">Dividends arrive here shortly.</Banner>;
