import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import {
	IconAccounts,
	IconAddPerson,
	IconGrid,
	IconHolderWide,
	IconPeople,
	IconSearch,
} from "@connected-repo/ui-mui/kosh/icons";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { AccessMatrix } from "@connected-repo/zod-schemas/kosh/people.zod";
import { Page } from "@frontend/components/layout/Page";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { WHO } from "@frontend/copy/who.copy";
import { ShareDialog } from "@frontend/modules/access/components/ShareDialog";
import { useAccessNotices } from "@frontend/modules/access/people.queries";
import { errorWords } from "@frontend/modules/access/people.utils";
import { PersonSheet } from "@frontend/modules/access/who/PersonSheet";
import { TargetChoices } from "@frontend/modules/access/who/TargetChoices";
import { WhoByAccount } from "@frontend/modules/access/who/WhoByAccount";
import { WhoGrid } from "@frontend/modules/access/who/WhoGrid";
import { WhoPeopleList } from "@frontend/modules/access/who/WhoPeopleList";
import {
	canEditSomething,
	filterPeople,
	type PeopleFilter,
	type ShareTarget,
	shareChoices,
} from "@frontend/modules/access/who/who.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

type View = "person" | "account";

/** On a phone the filters only earn their place once the list is long. */
const PHONE_FILTERS_FROM = 6;

/**
 * Who can see what: everything the signed-in person owns, and everyone with
 * any access to it. A grid on desktop, a list of people on a phone; either
 * can be turned around to read account by account.
 */
export default function WhoCanSeeWhatPage() {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const compact = useMediaQuery(theme.breakpoints.down("lg"));
	const matrix = useQuery(orpc.access.matrix.queryOptions());
	const notices = useAccessNotices();

	const [params, setParams] = useSearchParams();
	const view: View = params.get("by") === "account" ? "account" : "person";
	const setView = (next: View) =>
		setParams(next === "account" ? { by: "account" } : {}, { replace: true });

	const [share, setShare] = useState<{ target: ShareTarget; email?: string } | null>(null);
	const openShare = (target: ShareTarget, email?: string) => setShare({ target, email });

	// Accepted Owner invites count as "Can view" until an owner confirms them.
	const unconfirmed = useMemo(
		() => new Set(notices.data?.toConfirm.map((c) => c.grantId)),
		[notices.data],
	);

	const switcher = (
		<Segmented<View>
			ariaLabel={WHO.viewLabel}
			value={view}
			onChange={setView}
			fullWidth={phone}
			options={[
				{ value: "person", label: WHO.byPerson, icon: <IconPeople /> },
				{ value: "account", label: WHO.byAccount, icon: <IconAccounts /> },
			]}
		/>
	);

	const data = matrix.data;
	const ownsSomething = data !== undefined && data.holders.length > 0;
	const sharedWithSomeone = data?.people.some((p) => !p.isMe) ?? false;

	return (
		<Page
			title={NAV.access}
			subtitle={
				<>
					{WHO.subtitle}
					{sharedWithSomeone && (
						<Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
							{` ${WHO.subtitleHint}`}
						</Box>
					)}
				</>
			}
			actions={!phone && sharedWithSomeone ? switcher : undefined}
		>
			{matrix.isPending ? (
				<Loading />
			) : matrix.isError || !data ? (
				<Banner
					tone="bad"
					action={
						<Button variant="outlined" onClick={() => void matrix.refetch()}>
							{WHO.tryAgain}
						</Button>
					}
				>
					{errorWords(matrix.error, WHO.loadFailed)}
				</Banner>
			) : !ownsSomething ? (
				<SectionCard>
					<EmptyState
						icon={<IconGrid />}
						title={WHO.nothingOwned.title}
						actions={
							<Button variant="contained" component={Link} to={ROUTES.accounts}>
								{WHO.nothingOwned.action}
							</Button>
						}
					>
						{WHO.nothingOwned.body}
					</EmptyState>
				</SectionCard>
			) : !sharedWithSomeone ? (
				<OnlyYou matrix={data} onShare={openShare} />
			) : (
				<>
					{phone && switcher}
					{view === "person" ? (
						<ByPerson matrix={data} unconfirmed={unconfirmed} phone={phone} onShare={openShare} />
					) : (
						<WhoByAccount
							matrix={data}
							unconfirmed={unconfirmed}
							accountId={params.get("account")}
							onPick={(accountId) =>
								setParams({ by: "account", account: accountId }, { replace: true })
							}
							onShare={openShare}
							phone={phone}
							compact={compact}
						/>
					)}
					<Banner sx={{ fontSize: "0.8125rem" }}>{WHO.onlyOwned}</Banner>
				</>
			)}

			<ShareDialog
				target={share?.target ?? null}
				initialEmail={share?.email}
				onClose={() => setShare(null)}
			/>
		</Page>
	);
}

const Loading = () => (
	<>
		<Skeleton variant="rounded" height={48} sx={{ maxWidth: 520 }} />
		<Skeleton variant="rounded" height={320} sx={{ borderRadius: 2.5 }} />
	</>
);

interface ByPersonProps {
	matrix: AccessMatrix;
	unconfirmed: ReadonlySet<string>;
	phone: boolean;
	onShare: (target: ShareTarget, email?: string) => void;
}

const ByPerson = ({ matrix, unconfirmed, phone, onShare }: ByPersonProps) => {
	const [filter, setFilter] = useState<PeopleFilter>("everyone");
	const [query, setQuery] = useState("");
	const [openKey, setOpenKey] = useState<string | null>(null);

	// The grid has a row for "You"; the phone list is only the others.
	const listed = phone ? matrix.people.filter((p) => !p.isMe) : matrix.people;
	const showFilters = !phone || listed.length >= PHONE_FILTERS_FROM;
	const rows = showFilters ? filterPeople(listed, filter, query, unconfirmed) : listed;
	const openPerson = matrix.people.find((p) => p.key === openKey && !p.isMe) ?? null;

	return (
		<>
			{showFilters && (
				<Box
					sx={{
						display: "flex",
						flexDirection: { xs: "column", md: "row" },
						alignItems: { md: "center" },
						gap: 1.25,
					}}
				>
					<TextField
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={WHO.search}
						type="search"
						slotProps={{
							htmlInput: { "aria-label": WHO.search },
							input: {
								startAdornment: (
									<Box
										aria-hidden
										sx={(theme) => ({
											display: "flex",
											mr: 1,
											color: theme.vars.palette.kosh.ink3,
											"& svg": { fontSize: 20 },
										})}
									>
										<IconSearch />
									</Box>
								),
							},
						}}
						sx={{ width: { xs: "100%", md: 280 }, flex: "none" }}
					/>
					<FilterChips<PeopleFilter>
						ariaLabel={WHO.filterLabel}
						value={filter}
						onChange={setFilter}
						options={[
							{ value: "everyone", label: WHO.filterEveryone(listed.length) },
							{
								value: "editors",
								label: WHO.filterEditors(
									listed.filter((p) => canEditSomething(p, unconfirmed)).length,
								),
							},
							{
								value: "invited",
								label: WHO.filterInvited(listed.filter((p) => p.pending).length),
							},
						]}
					/>
				</Box>
			)}

			{rows.length === 0 ? (
				<SectionCard>
					<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
						<Typography color="text.secondary" sx={{ flex: 1, minWidth: 180 }}>
							{WHO.noMatch}
						</Typography>
						<Button
							variant="outlined"
							onClick={() => {
								setFilter("everyone");
								setQuery("");
							}}
						>
							{WHO.clearFilters}
						</Button>
					</Box>
				</SectionCard>
			) : phone ? (
				<WhoPeopleList
					holders={matrix.holders}
					people={rows}
					unconfirmed={unconfirmed}
					onOpenPerson={(person) => setOpenKey(person.key)}
				/>
			) : (
				<>
					<WhoGrid
						holders={matrix.holders}
						people={rows}
						unconfirmed={unconfirmed}
						onShare={onShare}
						onOpenPerson={(person) => setOpenKey(person.key)}
					/>
					<Legend />
				</>
			)}

			<PersonSheet
				person={openPerson}
				holders={matrix.holders}
				unconfirmed={unconfirmed}
				onClose={() => setOpenKey(null)}
				onShare={(target, email) => {
					setOpenKey(null);
					onShare(target, email);
				}}
			/>
		</>
	);
};

/** What the dashed span and the dash mean. */
const Legend = () => (
	<Box
		sx={{
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			columnGap: 3,
			rowGap: 1,
		}}
	>
		<Typography variant="body2" component="div" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
			<Box
				component="span"
				aria-hidden
				sx={(theme) => ({
					display: "inline-flex",
					alignItems: "center",
					height: 28,
					px: 1,
					borderRadius: "12px",
					bgcolor: theme.vars.palette.kosh.surface2,
					border: `1px dashed ${theme.vars.palette.kosh.line2}`,
					"& svg": { fontSize: 18 },
				})}
			>
				<IconHolderWide />
			</Box>
			{WHO.legendWide}
		</Typography>
		<Typography variant="body2" component="div">
			{WHO.legendNone}
		</Typography>
	</Box>
);

interface OnlyYouProps {
	matrix: AccessMatrix;
	onShare: (target: ShareTarget) => void;
}

/** Nobody else is on anything: say so, and offer the first invite. */
const OnlyYou = ({ matrix, onShare }: OnlyYouProps) => {
	const [choosing, setChoosing] = useState(false);
	return (
		<SectionCard>
			<EmptyState
				icon={<IconGrid />}
				title={WHO.empty.title}
				actions={
					<Button variant="contained" startIcon={<IconAddPerson />} onClick={() => setChoosing(true)}>
						{WHO.inviteSomeone}
					</Button>
				}
			>
				{WHO.empty.body}
			</EmptyState>
			<ResponsiveDialog
				open={choosing}
				onClose={() => setChoosing(false)}
				title={WHO.chooseTitle}
				subtitle={WHO.chooseSubtitle}
			>
				<TargetChoices
					choices={shareChoices(matrix.holders)}
					onChoose={(target) => {
						setChoosing(false);
						onShare(target);
					}}
				/>
			</ResponsiveDialog>
		</SectionCard>
	);
};
