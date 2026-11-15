import { Badge } from "@connected-repo/ui-mui/data-display/Badge";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState, SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import {
	IconAccounts,
	IconActivity,
	IconEdit,
	IconFilter,
	IconOwner,
	IconPeople,
	IconSearch,
	IconUpload,
} from "@connected-repo/ui-mui/kosh/icons";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { Page } from "@frontend/components/layout/Page";
import { ACTIVITY, type ActivityFilter } from "@frontend/copy/activity.copy";
import { NAV } from "@frontend/copy/nav.copy";
import { useDirectory } from "@frontend/modules/access/people.queries";
import { errorWords } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import {
	type ActorOption,
	actorKey,
	actorsIn,
	groupByDay,
	uniqueById,
	type Visible,
	waitingInvites,
} from "../activity.utils";
import { ActivityFeed } from "../components/ActivityFeed";
import { PickerButton, PickerList, type PickerOption } from "../components/ActivityPickers";

const PAGE_SIZE = 50;

const chipIcon = { fontSize: 18 } as const;
const FILTER_ICON = {
	all: undefined,
	uploads: <IconUpload sx={chipIcon} />,
	access: <IconOwner sx={chipIcon} />,
	answers: <IconEdit sx={chipIcon} />,
} as const;
const FILTERS: readonly ActivityFilter[] = ["all", "uploads", "access", "answers"];

/**
 * Activity: every upload, undo, answer and access change on accounts the
 * person can see — who did it and when. The server decides what each person
 * may read (owners see access changes; everyone sees what happened to them),
 * so this page only filters and lays out what it is given.
 */
export default function ActivityPage() {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));

	const [filter, setFilter] = useState<ActivityFilter>("all");
	const [pickedAccount, setPickedAccount] = useState<string | null>(null);
	// Kept whole, so the choice still has a name when a new page of results lacks that person.
	const [person, setPerson] = useState<ActorOption | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	const directory = useDirectory();
	const accounts = directory.data?.accounts ?? [];
	// An account the person can no longer see stops being a filter.
	const accountId = accounts.some((account) => account.id === pickedAccount) ? pickedAccount : null;

	const feed = useInfiniteQuery(
		orpc.activity.list.infiniteOptions({
			input: (before: string | undefined) => ({
				filter,
				limit: PAGE_SIZE,
				...(accountId ? { accountId } : {}),
				...(before === undefined ? {} : { before }),
			}),
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (last) => last.nextBefore ?? undefined,
		}),
	);

	const items = useMemo(
		() => uniqueById(feed.data?.pages.flatMap((page) => page.items) ?? []),
		[feed.data],
	);
	const waiting = useMemo(() => waitingInvites(items), [items]);
	const shown = person ? items.filter((item) => actorKey(item.actor) === person.key) : items;
	const days = groupByDay(shown);

	// Links and names follow what the directory says can be seen; if it could
	// not be loaded, entries are shown as sent, without links.
	const visible = useMemo<Visible | null>(
		() =>
			directory.data
				? {
						accounts: new Set(directory.data.accounts.map((account) => account.id)),
						holders: new Set(directory.data.holders.map((holder) => holder.id)),
					}
				: null,
		[directory.data],
	);

	const accountOptions: PickerOption[] = [
		{ value: null, label: ACTIVITY.allAccounts },
		...accounts.map((account) => ({ value: account.id, label: account.label })),
	];
	const actors = actorsIn(items);
	const people = person && !actors.some((actor) => actor.key === person.key) ? [...actors, person] : actors;
	const personOptions: PickerOption[] = [
		{ value: null, label: ACTIVITY.anyone },
		...people.map((actor) => ({ value: actor.key, label: actor.isMe ? ACTIVITY.you : actor.name })),
	];
	const pickPerson = (key: string | null) =>
		setPerson(people.find((actor) => actor.key === key) ?? null);

	const narrowed = accountId !== null || person !== null;
	const filtered = narrowed || filter !== "all";
	const clearFilters = () => {
		setFilter("all");
		setPickedAccount(null);
		setPerson(null);
	};
	const narrowedTo = [
		accounts.find((account) => account.id === accountId)?.label,
		person ? (person.isMe ? ACTIVITY.you : person.name) : undefined,
	].filter((name): name is string => name !== undefined);

	const chips = (
		<FilterChips<ActivityFilter>
			ariaLabel={ACTIVITY.filterLabel}
			value={filter}
			onChange={setFilter}
			options={FILTERS.map((value) => ({
				value,
				label: phone ? ACTIVITY.filters[value].short : ACTIVITY.filters[value].label,
				icon: phone ? undefined : FILTER_ICON[value],
			}))}
			// On a phone the row runs to the screen's edges and scrolls sideways. On
			// desktop it keeps to one line; the pickers drop below it when space runs out.
			sx={{ flex: { md: "1 0 auto" }, mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 } }}
		/>
	);

	const showMore = feed.hasNextPage && (
		<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
			{feed.isFetchNextPageError && (
				<Banner tone="bad" sx={{ alignSelf: "stretch" }}>
					{errorWords(feed.error, ACTIVITY.moreFailed)}
				</Banner>
			)}
			<Button
				variant="outlined"
				disabled={feed.isFetchingNextPage}
				onClick={() => void feed.fetchNextPage()}
				sx={{ minWidth: { xs: "100%", md: 160 } }}
			>
				{feed.isFetchingNextPage ? ACTIVITY.loadingMore : ACTIVITY.showMore}
			</Button>
		</Box>
	);

	let body: ReactNode;
	// The directory is awaited too, so names and links do not change under the reader.
	if (feed.isPending || directory.isPending)
		body = (
			<SectionCard>
				<Box aria-busy sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
					{[0, 1, 2, 3].map((row) => (
						<Box key={row} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
							<Skeleton variant="rounded" width={36} height={36} />
							<Box sx={{ flex: 1 }}>
								<Skeleton width={row % 2 ? "46%" : "62%"} />
								<Skeleton width="24%" />
							</Box>
						</Box>
					))}
				</Box>
			</SectionCard>
		);
	else if (feed.isError && items.length === 0)
		body = (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void feed.refetch()}>
						{ACTIVITY.retry}
					</Button>
				}
			>
				{errorWords(feed.error, ACTIVITY.loadFailed)}
			</Banner>
		);
	else if (shown.length === 0 && !filtered)
		body = (
			<SectionCard>
				<EmptyState icon={<IconActivity />} title={ACTIVITY.empty.title}>
					{ACTIVITY.empty.body}
				</EmptyState>
			</SectionCard>
		);
	else if (shown.length === 0)
		body = (
			<>
				<SectionCard>
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							textAlign: "center",
							gap: 1.25,
							py: 2,
						}}
					>
						<SpotIcon>
							<IconSearch />
						</SpotIcon>
						<Typography variant="h3" component="h2">
							{ACTIVITY.noMatch.title}
						</Typography>
						{feed.hasNextPage && (
							<Typography variant="body2" sx={{ maxWidth: 380 }}>
								{ACTIVITY.noMatch.bodyMore}
							</Typography>
						)}
						<Button variant="outlined" onClick={clearFilters}>
							{ACTIVITY.clearFilters}
						</Button>
					</Box>
				</SectionCard>
				{showMore}
			</>
		);
	else
		body = (
			<>
				<ActivityFeed days={days} waiting={waiting} visible={visible} cards={phone} />
				{showMore}
			</>
		);

	return (
		<Page
			title={NAV.activity}
			subtitle={ACTIVITY.subtitle}
			barAction={
				<IconButton
					aria-label={narrowed ? ACTIVITY.filterSheetOn : ACTIVITY.filterSheet}
					aria-haspopup="dialog"
					onClick={() => setSheetOpen(true)}
				>
					<Badge variant="dot" color="primary" invisible={!narrowed}>
						<IconFilter />
					</Badge>
				</IconButton>
			}
		>
			{phone ? (
				<>
					{chips}
					{narrowed && (
						<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: -1 }}>
							<Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
								{ACTIVITY.showing(narrowedTo)}
							</Typography>
							<Button variant="text" onClick={clearFilters} sx={{ mr: -1.5 }}>
								{ACTIVITY.clearFilters}
							</Button>
						</Box>
					)}
				</>
			) : (
				<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
					{chips}
					<PickerButton
						label={ACTIVITY.accountPicker}
						icon={<IconAccounts />}
						options={accountOptions}
						value={accountId}
						onPick={setPickedAccount}
					/>
					<PickerButton
						label={ACTIVITY.personPicker}
						icon={<IconPeople />}
						options={personOptions}
						value={person?.key ?? null}
						onPick={pickPerson}
					/>
				</Box>
			)}

			{directory.isError && (
				<Banner
					tone="bad"
					action={
						<Button variant="outlined" onClick={() => void directory.refetch()}>
							{ACTIVITY.retry}
						</Button>
					}
				>
					{errorWords(directory.error, ACTIVITY.accountsFailed)}
				</Banner>
			)}

			{body}

			<ResponsiveDialog
				open={sheetOpen && phone}
				onClose={() => setSheetOpen(false)}
				title={ACTIVITY.filterSheet}
				actions={
					<>
						{narrowed && (
							<Button
								variant="text"
								onClick={() => {
									setPickedAccount(null);
									setPerson(null);
								}}
							>
								{ACTIVITY.clearFilters}
							</Button>
						)}
						<Button variant="contained" size="large" onClick={() => setSheetOpen(false)}>
							{ACTIVITY.done}
						</Button>
					</>
				}
			>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mx: -1.5 }}>
					<PickerList
						label={ACTIVITY.accountPicker}
						options={accountOptions}
						value={accountId}
						onPick={setPickedAccount}
					/>
					<PickerList
						label={ACTIVITY.personPicker}
						options={personOptions}
						value={person?.key ?? null}
						onPick={pickPerson}
					/>
				</Box>
			</ResponsiveDialog>
		</Page>
	);
}
