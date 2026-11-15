import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconEdit, IconGroup, IconInbox, IconLeave } from "@connected-repo/ui-mui/kosh/icons";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { Page } from "@frontend/components/layout/Page";
import { GROUP_KIND_LABEL } from "@frontend/copy/levels.copy";
import { accountPath, NAV, ROUTES } from "@frontend/copy/nav.copy";
import { ARRIVAL, SHARED } from "@frontend/copy/shared.copy";
import { ShareDialog } from "@frontend/modules/access/components/ShareDialog";
import { useAccessNotices, useDirectory } from "@frontend/modules/access/people.queries";
import { errorWords } from "@frontend/modules/access/people.utils";
import { ArrivalBlock } from "@frontend/modules/access/shared/ArrivalBlock";
import { type MoneyColumns, SharedCard } from "@frontend/modules/access/shared/SharedCard";
import { StopSeeingDialog } from "@frontend/modules/access/shared/StopSeeingDialog";
import {
	byGroup,
	bySharer,
	type SharedAccount,
	sharedAccounts,
	totalValue,
} from "@frontend/modules/access/shared/shared.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

type GroupBy = "sharer" | "groups";

/**
 * Shared with me: every account someone else has shared with the signed-in
 * person — who it is from, what they can do with it, and a way to stop
 * seeing it. Something newly shared is announced at the top.
 */
export default function SharedWithMePage() {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const directory = useDirectory();
	const notices = useAccessNotices();

	const [groupBy, setGroupBy] = useState<GroupBy>("sharer");
	const groups = useQuery({
		...orpc.portfolio.listGroups.queryOptions(),
		enabled: groupBy === "groups",
	});

	const [menu, setMenu] = useState<{ row: SharedAccount; anchor: HTMLElement } | null>(null);
	const [leaving, setLeaving] = useState<SharedAccount | null>(null);
	const [share, setShare] = useState<{ accountId: string } | { personId: string } | null>(null);

	const data = directory.data;
	const shared = data ? sharedAccounts(data) : [];
	const accounts = shared.map((row) => row.account);
	const sharers = bySharer(shared);
	const arrivals = notices.data?.arrivals ?? [];
	const total = totalValue(accounts);
	const money: MoneyColumns = {
		value: total !== null,
		returns: accounts.some((a) => a.xirr !== null),
	};
	const waiting = accounts.filter((a) => a.questionsWaiting > 0);
	const questions = waiting.reduce((sum, a) => sum + a.questionsWaiting, 0);

	const switcher = (
		<Segmented<GroupBy>
			ariaLabel={SHARED.groupBy}
			value={groupBy}
			onChange={setGroupBy}
			fullWidth={phone}
			options={[
				{ value: "sharer", label: SHARED.byWhoShared },
				{ value: "groups", label: SHARED.byMyGroups },
			]}
		/>
	);

	return (
		<Page
			title={NAV.shared}
			subtitle={
				shared.length > 0 ? (
					<>
						{`${SHARED.countAccounts(shared.length)}, `}
						{total !== null && (
							<>
								<Money value={total} sx={{ fontWeight: 700, color: "text.primary" }} />
								{", "}
							</>
						)}
						{SHARED.sharedBy(sharers.length)}
					</>
				) : (
					SHARED.fallbackSubtitle
				)
			}
			actions={
				!phone && shared.length > 0 ? (
					<>
						<Typography variant="body2" component="span" aria-hidden>
							{SHARED.groupBy}
						</Typography>
						{switcher}
					</>
				) : undefined
			}
		>
			{directory.isPending ? (
				<>
					<Skeleton variant="rounded" height={132} sx={{ borderRadius: 2.5 }} />
					<Skeleton variant="rounded" height={132} sx={{ borderRadius: 2.5 }} />
				</>
			) : directory.isError || !data ? (
				<Banner
					tone="bad"
					action={
						<Button variant="outlined" onClick={() => void directory.refetch()}>
							{SHARED.tryAgain}
						</Button>
					}
				>
					{errorWords(directory.error, SHARED.loadFailed)}
				</Banner>
			) : (
				<>
					{arrivals.length > 0 && (
						<ArrivalBlock
							key={arrivals.map((a) => a.grantId).join()}
							arrivals={arrivals}
							directory={data}
						/>
					)}

					{shared.length === 0 && arrivals.length === 0 && (
						<SectionCard>
							<EmptyState icon={<IconInbox />} title={SHARED.empty.title}>
								{SHARED.empty.body(data.me.email)}
							</EmptyState>
						</SectionCard>
					)}

					{shared.length > 0 && (
						<>
							{arrivals.length > 0 && (
								<Typography variant="eyebrow" component="h2" sx={{ mt: 1 }}>
									{ARRIVAL.everything}
								</Typography>
							)}
							{phone && switcher}

							{questions > 0 && (
								<ActionBanner
									tone="warn"
									icon={<IconEdit fontSize="inherit" />}
									stacked={phone}
									action={
										waiting[0] && (
											<Button variant="outlined" component={Link} to={accountPath(waiting[0].id)}>
												{SHARED.answerThem}
											</Button>
										)
									}
								>
									<b>{SHARED.questionsWaiting(questions)}</b>
									{SHARED.questionsOn(
										waiting.map((a) => SHARED.questionsOnAccount(a.questionsWaiting, a.label)),
									)}
								</ActionBanner>
							)}

							{groupBy === "sharer" ? (
								sharers.map((section) => (
									<SharedCard
										key={section.key}
										leading={
											<HolderAvatar
												name={section.sharer?.name ?? ""}
												colorKey={section.sharer?.userId}
												size="sm"
											/>
										}
										title={SHARED.from(section.sharer?.name ?? "")}
										line={SHARED.sharerLine(section.sharer?.email ?? "", section.rows.length)}
										isNew={section.rows.some((row) => row.account.isNew)}
										rows={section.rows}
										money={money}
										onMore={(row, anchor) => setMenu({ row, anchor })}
									/>
								))
							) : groups.isPending ? (
								<Skeleton variant="rounded" height={132} sx={{ borderRadius: 2.5 }} />
							) : groups.isError ? (
								<Banner
									tone="bad"
									action={
										<Button variant="outlined" onClick={() => void groups.refetch()}>
											{SHARED.tryAgain}
										</Button>
									}
								>
									{errorWords(groups.error, SHARED.loadFailed)}
								</Banner>
							) : (
								<ByMyGroups
									shared={shared}
									groups={groups.data}
									money={money}
									phone={phone}
									onMore={(row, anchor) => setMenu({ row, anchor })}
								/>
							)}
						</>
					)}

					<Menu
						anchorEl={menu?.anchor ?? null}
						open={menu !== null}
						onClose={() => setMenu(null)}
						anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
						transformOrigin={{ horizontal: "right", vertical: "top" }}
					>
						<MenuItem
							onClick={() => {
								setLeaving(menu?.row ?? null);
								setMenu(null);
							}}
						>
							<IconLeave />
							{SHARED.stopSeeing}
						</MenuItem>
					</Menu>
					<StopSeeingDialog
						row={leaving}
						directory={data}
						onClose={() => setLeaving(null)}
						onChooseOwner={setShare}
					/>
				</>
			)}
			<ShareDialog target={share} onClose={() => setShare(null)} />
		</Page>
	);
}

interface ByMyGroupsProps {
	shared: SharedAccount[];
	groups: Parameters<typeof byGroup>[1];
	money: MoneyColumns;
	phone: boolean;
	onMore: (row: SharedAccount, anchor: HTMLElement) => void;
}

/** The same accounts, under the signed-in person's own groups. */
const ByMyGroups = ({ shared, groups, money, phone, onMore }: ByMyGroupsProps) => {
	const { sections, ungrouped } = byGroup(shared, groups);
	return (
		<>
			{groups.length === 0 && (
				<ActionBanner
					icon={<IconGroup fontSize="inherit" />}
					stacked={phone}
					action={
						<Button variant="outlined" component={Link} to={ROUTES.groups}>
							{SHARED.goToGroups}
						</Button>
					}
				>
					{SHARED.noGroups}
				</ActionBanner>
			)}
			{sections.map((section) => (
				<SharedCard
					key={section.key}
					leading={<GroupMark />}
					title={section.group?.name ?? ""}
					line={[
						section.group?.kind ? GROUP_KIND_LABEL[section.group.kind] : null,
						SHARED.groupLine(section.rows.length, section.group?.accountIds.length ?? 0),
					]
						.filter(Boolean)
						.join(" · ")}
					rows={section.rows}
					showSharer
					money={money}
					onMore={onMore}
				/>
			))}
			{ungrouped.length > 0 && (
				<SharedCard
					leading={<GroupMark none />}
					title={SHARED.notInAGroup}
					line={SHARED.notInAGroupLine(ungrouped.length)}
					rows={ungrouped}
					showSharer
					money={money}
					onMore={onMore}
				/>
			)}
		</>
	);
};

const GroupMark = ({ none = false }: { none?: boolean }) => (
	<Box
		aria-hidden
		sx={(theme) => ({
			width: 34,
			height: 34,
			flex: "none",
			display: "grid",
			placeItems: "center",
			color: none ? theme.vars.palette.kosh.ink3 : theme.vars.palette.kosh.accentText,
		})}
	>
		{none ? <IconInbox /> : <IconGroup />}
	</Box>
);

interface ActionBannerProps {
	tone?: "info" | "warn";
	icon: ReactNode;
	action: ReactNode;
	/** Put the button under the words instead of beside them (a phone has no room beside). */
	stacked: boolean;
	children: ReactNode;
}

/** A banner with one button: beside the words on desktop, under them on a phone. */
const ActionBanner = ({ tone, icon, action, stacked, children }: ActionBannerProps) => (
	<Banner tone={tone} icon={icon} action={stacked ? undefined : action}>
		{children}
		{stacked && action && <Box sx={{ mt: 1.25 }}>{action}</Box>}
	</Banner>
);
