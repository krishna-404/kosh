import { Button } from "@connected-repo/ui-mui/form/Button";
import { formatDayLabel, formatTime } from "@connected-repo/ui-mui/format/date";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconClose, IconOwner } from "@connected-repo/ui-mui/kosh/icons";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import type { AccessNotices as Notices } from "@connected-repo/zod-schemas/kosh/people.zod";
import { NOTICES } from "@frontend/copy/shared.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords, firstNameOf, possessive } from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

type Lost = Notices["lost"][number];
type ToConfirm = Notices["toConfirm"][number];

/** "at 16:12", "yesterday at 21:10", "on 13 Nov at 16:05". */
const whenWords = (at: number): string => {
	const day = formatDayLabel(at);
	const time = formatTime(at);
	if (day === "Today") return NOTICES.at(time);
	if (day === "Yesterday") return NOTICES.yesterdayAt(time);
	return NOTICES.onDayAt(day, time);
};

/**
 * Things about access the signed-in person should be told once, wherever
 * they are in the app: an account that is no longer shared with them, and
 * accepted Owner invites waiting for their one-tap confirmation.
 *
 * Mounted by AppShell above every page. Renders nothing when there is
 * nothing to tell.
 */
export const AccessNotices = () => {
	const refresh = useRefreshPeople();
	// Access can change while the app sits in a background tab: look again
	// whenever the window comes back.
	const { data } = useQuery({
		...orpc.access.notices.queryOptions(),
		refetchOnWindowFocus: "always",
	});

	// Told once: a notice is hidden the moment it is dealt with, without
	// waiting for the next fetch.
	const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());
	const hide = (grantId: string) => setHandled((ids) => new Set(ids).add(grantId));
	const unhide = (grantId: string) =>
		setHandled((ids) => new Set([...ids].filter((id) => id !== grantId)));

	// When something stops being shared, what is already on screen is out of
	// date: fetch it again so nothing from that account stays visible.
	const lostKey = data?.lost.map((l) => l.grantId).join() ?? "";
	const lastLostKey = useRef("");
	useEffect(() => {
		if (lostKey && lostKey !== lastLostKey.current) void refresh();
		lastLostKey.current = lostKey;
	}, [lostKey, refresh]);

	const lost = data?.lost.filter((l) => !handled.has(l.grantId)) ?? [];
	const toConfirm = data?.toConfirm.filter((c) => !handled.has(c.grantId)) ?? [];
	if (lost.length + toConfirm.length === 0) return null;

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: { xs: 2, md: 2.5 } }}>
			{toConfirm.map((notice) => (
				<ConfirmOwnerNotice
					key={notice.grantId}
					notice={notice}
					onHandled={() => hide(notice.grantId)}
					onFailed={() => unhide(notice.grantId)}
				/>
			))}
			{lost.map((notice) => (
				<LostNotice
					key={notice.grantId}
					notice={notice}
					onHandled={() => hide(notice.grantId)}
					onFailed={() => unhide(notice.grantId)}
				/>
			))}
		</Box>
	);
};

interface NoticeProps<T> {
	notice: T;
	onHandled: () => void;
	onFailed: () => void;
}

/** "[Account] is no longer shared with you" — said once, then gone for good. */
const LostNotice = ({ notice, onHandled, onFailed }: NoticeProps<Lost>) => {
	const refresh = useRefreshPeople();
	const acknowledge = useMutation(orpc.access.acknowledge.mutationOptions());
	const when = whenWords(notice.at);

	return (
		<Banner
			tone="warn"
			title={NOTICES.lostTitle(notice.label, notice.kind)}
			action={
				<IconButton
					aria-label={NOTICES.dismiss(notice.label)}
					color="inherit"
					onClick={() => {
						onHandled();
						acknowledge.mutate(
							{ lost: [notice.grantId] },
							// If it could not be recorded it is shown again, rather than lost.
							{ onSuccess: () => void refresh(), onError: onFailed },
						);
					}}
				>
					<IconClose />
				</IconButton>
			}
		>
			{notice.byName ? NOTICES.lostBy(notice.byName, when, notice.kind) : NOTICES.lost(when, notice.kind)}
		</Banner>
	);
};

/** An accepted Owner invite: confirm it is who was meant, or remove them. */
const ConfirmOwnerNotice = ({ notice, onHandled, onFailed }: NoticeProps<ToConfirm>) => {
	const snack = useSnack();
	const refresh = useRefreshPeople();
	const confirm = useMutation(orpc.access.confirm.mutationOptions());
	const remove = useMutation(orpc.access.revoke.mutationOptions());
	const busy = confirm.isPending || remove.isPending;

	const name = notice.name?.trim() || notice.email || NOTICES.someone;
	const firstName = notice.name?.trim() ? firstNameOf(notice.name) : name;
	const who = notice.name?.trim() && notice.email ? `${notice.name} (${notice.email})` : name;
	const target =
		notice.target.kind === "holder"
			? NOTICES.allOf(possessive(firstNameOf(notice.target.label)))
			: notice.target.label;

	return (
		<Banner tone="warn" icon={<IconOwner fontSize="inherit" />}>
			{NOTICES.toConfirm(who, target)}
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.25 }}>
				<Button
					variant="contained"
					disabled={busy}
					onClick={() =>
						confirm.mutate(
							{ grantId: notice.grantId },
							{
								onSuccess: async () => {
									onHandled();
									await refresh();
									snack(NOTICES.confirmed(name, target));
								},
								onError: (error) => {
									onFailed();
									snack(errorWords(error, NOTICES.confirmFailed));
								},
							},
						)
					}
					sx={{ whiteSpace: "normal", py: 1 }}
				>
					{NOTICES.confirm(firstName)}
				</Button>
				<Button
					variant="outlined"
					disabled={busy}
					aria-label={NOTICES.removeNamed(name)}
					onClick={() =>
						remove.mutate(
							{ grantId: notice.grantId },
							{
								onSuccess: async () => {
									onHandled();
									await refresh();
									snack(NOTICES.removed(name, target));
								},
								onError: (error) => {
									onFailed();
									snack(errorWords(error, NOTICES.removeFailed));
								},
							},
						)
					}
				>
					{NOTICES.remove}
				</Button>
			</Box>
		</Banner>
	);
};
