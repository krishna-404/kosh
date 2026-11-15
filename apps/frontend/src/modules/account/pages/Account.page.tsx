import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { IconAddPerson, IconUpload } from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link as TextLink } from "@connected-repo/ui-mui/navigation/Link";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { DirectoryAccount, DirectoryHolder } from "@connected-repo/zod-schemas/kosh/people.zod";
import { Page } from "@frontend/components/layout/Page";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { ROUTES } from "@frontend/copy/nav.copy";
import { ShareDialog } from "@frontend/modules/access/components/ShareDialog";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { brokerNameOf } from "@frontend/modules/access/people.utils";
import { StatementsTab } from "@frontend/modules/account/statements/StatementsTab";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import type { AccountInfo } from "../account.types";
import {
	type AccountTab,
	askName,
	cameFrom,
	canEditAccount,
	levelSentence,
	tabFromParam,
	tabsFor,
} from "../account.utils";
import { AddToGroup } from "../components/AddToGroup";
import { LoadFailed } from "../components/TabStates";
import { TabPanel, TabStrip } from "../components/TabStrip";
import { useTabLink } from "../components/useTabLink";
import { CashFlowsTab } from "../tabs/CashFlowsTab";
import { HoldingsTab } from "../tabs/HoldingsTab";
import { ReturnsTab } from "../tabs/ReturnsTab";
import { WorkedOutTab } from "../tabs/WorkedOutTab";

/**
 * One account: what it is and what the reader may do with it, then its
 * returns, holdings, cash flows, statements and the working behind the
 * figures — a tab each, kept in the address (`?tab=holdings`).
 */
export default function AccountPage() {
	const { accountId } = useParams();
	const directory = useDirectory();

	const account = directory.data?.accounts.find((a) => a.id === accountId);
	const holder = directory.data?.holders.find((h) => h.id === account?.personId);

	if (directory.isPending)
		return (
			<Page title={ACCOUNT.pageTitle} back={ROUTES.accounts}>
				<Skeleton variant="rounded" height={48} />
				<Skeleton variant="rounded" height={104} sx={{ borderRadius: 2.5 }} />
				<Skeleton variant="rounded" height={360} sx={{ borderRadius: 2.5 }} />
			</Page>
		);

	if (!directory.data)
		return (
			<Page title={ACCOUNT.pageTitle} back={ROUTES.accounts}>
				<LoadFailed
					error={directory.error}
					fallback={ACCOUNT.loadFailed}
					onRetry={() => void directory.refetch()}
				/>
			</Page>
		);

	// Not found and not shared look the same on purpose: an account you
	// cannot see does not exist as far as you can tell.
	if (!account || !holder)
		return (
			<Page title={ACCOUNT.pageTitle} back={ROUTES.accounts}>
				<Banner tone="warn">{ACCOUNT.notHere}</Banner>
			</Page>
		);

	// Keyed by account, so nothing of one account lingers on screen while another loads.
	return <AccountView key={account.id} account={account} holder={holder} />;
}

const AccountView = ({ account, holder }: { account: DirectoryAccount; holder: DirectoryHolder }) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const idBase = useId();
	const [sharing, setSharing] = useState(false);
	const { raw, linkTo, goTo } = useTabLink();

	const level = account.myLevel;
	const info = useMemo<AccountInfo>(
		() => ({
			account,
			holder,
			canEdit: canEditAccount(level),
			broker: brokerNameOf(account),
			ask: askName(account),
		}),
		[account, holder, level],
	);
	const from = cameFrom(account, holder);
	const tab = tabFromParam(raw, level);
	const waiting = account.questionsWaiting;

	const tabs = tabsFor(level).map((value) => ({
		value,
		label: ACCOUNT.tabs[value],
		...(value === "statements" && waiting > 0
			? {
					badge: <Tag tone="pending">{waiting}</Tag>,
					ariaLabel: `${ACCOUNT.tabs.statements}, ${ACCOUNT.questionsTag(waiting)}`,
				}
			: {}),
	}));

	const panel: Record<AccountTab, () => ReactNode> = {
		returns: () => <ReturnsTab info={info} />,
		holdings: () => <HoldingsTab info={info} />,
		cash: () => <CashFlowsTab info={info} />,
		statements: () => <StatementsTab accountId={account.id} canEdit={info.canEdit} />,
		"worked-out": () => <WorkedOutTab info={info} phone={phone} />,
	};

	return (
		<Page
			title={account.label}
			back={from.to}
			eyebrow={
				// On a phone the app bar's back arrow does this job.
				<Box
					component="nav"
					aria-label={ACCOUNT.breadcrumb}
					sx={(t) => ({
						...t.typography.body2,
						display: { xs: "none", md: "flex" },
						alignItems: "center",
						flexWrap: "wrap",
						gap: 1,
						textTransform: "none",
						letterSpacing: 0,
						color: t.vars.palette.kosh.ink2,
					})}
				>
					<TextLink component={Link} to={from.to} sx={{ color: "inherit", fontWeight: "inherit" }}>
						{from.parent}
					</TextLink>
					<span aria-hidden>/</span>
					<span>{from.here}</span>
				</Box>
			}
			leading={<BrokerMark broker={info.broker} size={48} />}
			titleEnd={<LevelBadge level={level} size="lg" />}
			subtitle={
				phone ? (
					// On a phone the app bar has the name; the level leads the sentence.
					<Box component="span" sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.25 }}>
						<LevelBadge level={level} size="md" />
						<Box component="span" sx={{ flex: "1 1 200px", minWidth: 0 }}>
							{levelSentence(level, info.ask, phone)}
						</Box>
					</Box>
				) : (
					levelSentence(level, info.ask, phone)
				)
			}
			actions={
				<>
					{/* Everyone may group what they can see; uploading and sharing are hidden below their level. */}
					<AddToGroup accountId={account.id} accountLabel={account.label} />
					{level === "owner" && (
						<Button variant="outlined" startIcon={<IconAddPerson />} onClick={() => setSharing(true)}>
							{ACCOUNT.share}
						</Button>
					)}
					{info.canEdit && (
						<Button
							variant="contained"
							startIcon={<IconUpload />}
							component={Link}
							to={linkTo("statements", { upload: "1" })}
						>
							{ACCOUNT.uploadStatement}
						</Button>
					)}
				</>
			}
		>
			<TabStrip<AccountTab>
				ariaLabel={ACCOUNT.tabsLabel}
				idBase={idBase}
				tabs={tabs}
				value={tab}
				onChange={goTo}
			/>
			<TabPanel idBase={idBase} value={tab}>
				{panel[tab]()}
			</TabPanel>
			{level === "owner" && (
				<ShareDialog target={sharing ? { accountId: account.id } : null} onClose={() => setSharing(false)} />
			)}
		</Page>
	);
};
