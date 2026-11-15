import { formatDayLabel } from "@connected-repo/ui-mui/format/date";
import type { ActivityItem } from "@connected-repo/zod-schemas/kosh/people.zod";

/**
 * The accounts and holders the person can see. An entry about one outside
 * these (access they have since lost) is still listed, but not named or linked.
 */
export interface Visible {
	accounts: ReadonlySet<string>;
	holders: ReadonlySet<string>;
}

/** The entries of one calendar day, newest first, under its heading. */
export interface DayGroup {
	/** "Today", "Yesterday", "13 Nov". */
	label: string;
	items: ActivityItem[];
}

/** Entries (already newest first) under day headings in the viewer's time zone. */
export const groupByDay = (items: readonly ActivityItem[], now: number = Date.now()): DayGroup[] => {
	const days: DayGroup[] = [];
	for (const item of items) {
		const label = formatDayLabel(item.at, now);
		const last = days[days.length - 1];
		if (last && last.label === label) last.items.push(item);
		else days.push({ label, items: [item] });
	}
	return days;
};

/** Pages can overlap when the feed is refreshed between them; an entry is shown once. */
export const uniqueById = (items: readonly ActivityItem[]): ActivityItem[] => {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
};

/** Someone who did something, as a choice in the "Anyone" picker. */
export interface ActorOption {
	key: string;
	name: string;
	isMe: boolean;
}

/** Stable per person (two people can share a name); the server supplies it. */
export const actorKey = (actor: ActivityItem["actor"]): string | null => actor?.key ?? null;

/** Everyone who did something in these entries: the viewer first, then by name. */
export const actorsIn = (items: readonly ActivityItem[]): ActorOption[] => {
	const byKey = new Map<string, ActorOption>();
	for (const { actor } of items) {
		const key = actorKey(actor);
		if (actor && key && !byKey.has(key)) byKey.set(key, { key, name: actor.name, isMe: actor.isMe });
	}
	return [...byKey.values()].sort(
		(a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name),
	);
};

/**
 * The ids of invite entries whose invite is still open — nobody has signed
 * in with it and it still works. These get the "Not signed in yet" tag. The
 * server says which; nothing is guessed from the entries loaded so far.
 */
export const waitingInvites = (items: readonly ActivityItem[]): Set<string> =>
	new Set(items.filter((item) => item.inviteOpen).map((item) => item.id));
