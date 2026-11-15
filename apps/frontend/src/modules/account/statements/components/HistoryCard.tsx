import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconAlert, IconCheck, IconInfo } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { HISTORY, STATEMENTS } from "@frontend/copy/statements.copy";
import { errorWords } from "@frontend/modules/access/people.utils";
import type { ReactNode } from "react";
import { useHistory } from "../statements.queries";
import { type HistoryItem, historyChecklist, historyIsEmpty } from "../statements.utils";

const STATE: Record<HistoryItem["state"], { icon: ReactNode; label: string }> = {
	ok: { icon: <IconCheck />, label: HISTORY.stateOk },
	missing: { icon: <IconAlert />, label: HISTORY.stateMissing },
	optional: { icon: <IconInfo />, label: HISTORY.stateOptional },
};

/** One line of the checklist. Its state is an icon with a name, never colour alone. */
const Item = ({ item }: { item: HistoryItem }) => (
	<Box component="li" sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
		<Box
			role="img"
			aria-label={STATE[item.state].label}
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				return {
					display: "grid",
					pt: "1px",
					color: item.state === "ok" ? k.accentText : item.state === "missing" ? k.sunText : k.ink3,
					"& svg": { fontSize: 19 },
				};
			}}
		>
			{STATE[item.state].icon}
		</Box>
		<Box sx={{ minWidth: 0 }}>
			<Typography component="div" sx={{ fontWeight: item.state === "missing" ? 700 : 500 }}>
				{item.title}
			</Typography>
			{item.detail && (
				<Typography variant="body2" component="div">
					{item.detail}
				</Typography>
			)}
		</Box>
	</Box>
);

/**
 * How complete this account's history is, as a short checklist: what is in
 * and from when to when, what is missing or unexplained, and what to upload
 * to fix it. True returns need every rupee since the account's first day.
 */
export const HistoryCard = ({ accountId }: { accountId: string }) => {
	const history = useHistory(accountId);

	if (history.isPending) return <Skeleton variant="rounded" height={190} sx={{ borderRadius: 2.5 }} />;
	if (history.isError)
		return (
			<Banner
				tone="bad"
				action={
					<Button variant="outlined" onClick={() => void history.refetch()}>
						{STATEMENTS.retry}
					</Button>
				}
			>
				{errorWords(history.error, HISTORY.loadFailed)}
			</Banner>
		);

	const empty = historyIsEmpty(history.data);
	return (
		<SectionCard
			title={HISTORY.title}
			subtitle={empty ? HISTORY.nothingYet : history.data.complete ? HISTORY.completeBody : HISTORY.incompleteBody}
			action={
				empty ? undefined : history.data.complete ? (
					<Tag tone="new" icon={<IconCheck />}>
						{HISTORY.complete}
					</Tag>
				) : (
					<Tag tone="pending" icon={<IconAlert />}>
						{HISTORY.incomplete}
					</Tag>
				)
			}
		>
			<Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 1.25 }}>
				{historyChecklist(history.data).map((item) => (
					<Item key={item.key} item={item} />
				))}
			</Box>
		</SectionCard>
	);
};
