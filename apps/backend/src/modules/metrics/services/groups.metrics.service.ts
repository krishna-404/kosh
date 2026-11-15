import { db } from "@backend/db/db";
import type { CloseSeries } from "@backend/modules/market-data/services/prices.market.service";
import type { GroupsCompared, Period, WhatIf } from "@connected-repo/zod-schemas/kosh/money.zod";
import { ORPCError } from "@orpc/server";
import { money } from "./dates.metrics";
import {
	coreReturns,
	loadBenchmarks,
	loadSelection,
	type Selection,
	shadowOf,
	windowFor,
} from "./returns.metrics.service";

// Groups side by side — each measured against NIFTY on its own deposits and
// withdrawals, so a group that was simply handed more money does not look
// better for it. Groups are the caller's own, and may share accounts: their
// values are never added together.

interface GroupData {
	id: string;
	name: string;
	kind: GroupsCompared["groups"][number]["kind"];
	accountIds: string[];
	selection: Selection;
}

async function loadGroups(): Promise<GroupData[]> {
	const groups = await db.accountGroups.order({ name: "ASC" }).select("id", "name", "kind");
	if (groups.length === 0) return [];
	const members = await db.accountGroupMembers
		.where({ groupId: { in: groups.map((g) => g.id) } })
		.select("groupId", "accountId");
	const out: GroupData[] = [];
	for (const g of groups) {
		const accountIds = members.filter((m) => m.groupId === g.id).map((m) => m.accountId);
		out.push({ ...g, accountIds, selection: await loadSelection(accountIds) });
	}
	return out;
}

export async function getGroupsCompared(period: Period): Promise<GroupsCompared> {
	const groups = await loadGroups();
	const { list, closes } = await loadBenchmarks();
	const nifty = closes.get(list.find((b) => b.slug === "nifty50")?.instrumentId ?? "");
	const thisYear = Number((groups[0]?.selection.today ?? new Date().toISOString()).slice(0, 4));

	const firstYear = Math.min(
		thisYear,
		...groups.map((g) => Number((g.selection.start ?? `${thisYear}`).slice(0, 4))),
	);
	const years: GroupsCompared["years"] = [];
	const tally = new Map<string, { ahead: number; counted: number }>();
	for (let year = thisYear; year >= firstYear; year--) {
		const cells = groups.map((g) => {
			const s = g.selection;
			// Only a year the group existed for, start to finish, is a fair year.
			if (s.start === null || s.start > `${year}-12-31`) return { groupId: g.id, points: null };
			const w = { from: `${year - 1}-12-31`, to: year === thisYear ? s.today : `${year}-12-31` };
			const core = coreReturns(s, w);
			const shadow = shadowOf(core, w, nifty);
			const points = core.xirr !== null && shadow.xirr !== null ? core.xirr - shadow.xirr : null;
			const full = year < thisYear && s.start <= `${year}-01-01`;
			if (full && points !== null) {
				const t = tally.get(g.id) ?? { ahead: 0, counted: 0 };
				t.counted++;
				if (points > 0) t.ahead++;
				tally.set(g.id, t);
			}
			return { groupId: g.id, points };
		});
		years.push({ year, cells });
	}

	const seen = new Set<string>();
	let overlapping = false;
	for (const g of groups)
		for (const id of g.accountIds) {
			if (seen.has(id)) overlapping = true;
			seen.add(id);
		}

	return {
		period,
		groups: groups.map((g) => {
			const w = windowFor(g.selection, period);
			const core = coreReturns(g.selection, w);
			const shadow = shadowOf(core, w, nifty);
			const days = g.selection.start === null ? 0 : Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000);
			return {
				groupId: g.id,
				name: g.name,
				kind: g.kind,
				accounts: g.accountIds.length,
				value: money(core.closing),
				xirr: core.xirr,
				benchmarkXirr: shadow.xirr,
				aheadPoints: core.xirr !== null && shadow.xirr !== null ? core.xirr - shadow.xirr : null,
				aheadAmount: shadow.value === null ? null : money(core.closing - shadow.value),
				shortHistory: days < 365,
				yearsAhead: tally.get(g.id)?.ahead ?? 0,
				yearsCounted: tally.get(g.id)?.counted ?? 0,
			};
		}),
		years,
		overlapping,
	};
}

/** A group's own performance as a price series: ₹1 at its start, grown by its daily returns. */
function indexOf(selection: Selection): CloseSeries | undefined {
	const twr = coreReturns(selection, windowFor(selection, "all")).twr;
	if (!twr || twr.dailyReturns.length === 0) return undefined;
	const dates: string[] = [];
	const closes: number[] = [];
	let level = 1;
	for (const r of twr.dailyReturns) {
		level *= 1 + r.value;
		dates.push(r.date);
		closes.push(level);
	}
	return { dates, closes };
}

/**
 * "What if this group's money had followed another group?" — the group's
 * own deposits and withdrawals, earning what each other group earned.
 */
export async function getWhatIf(groupId: string, period: Period): Promise<WhatIf> {
	const groups = await loadGroups();
	const mine = groups.find((g) => g.id === groupId);
	if (!mine) throw new ORPCError("NOT_FOUND", { status: 404, message: "Group not found" });
	const w = windowFor(mine.selection, period);
	const core = coreReturns(mine.selection, w);
	const { list, closes } = await loadBenchmarks();

	const rows: WhatIf["rows"] = [
		{ id: mine.id, name: mine.name, kind: "self", value: money(core.closing) },
		...groups
			.filter((g) => g.id !== mine.id)
			.map((g) => {
				const shadow = shadowOf(core, w, indexOf(g.selection));
				// Only fair if the other group was already running when this money first arrived.
				const value = shadow.value !== null && shadow.availableFrom === null ? money(shadow.value) : null;
				return { id: g.id, name: g.name, kind: "group" as const, value };
			}),
		...list.map((b) => {
			const shadow = shadowOf(core, w, closes.get(b.instrumentId));
			return { id: b.slug, name: b.name, kind: "benchmark" as const, value: shadow.value === null ? null : money(shadow.value) };
		}),
	];
	return {
		groupId: mine.id,
		name: mine.name,
		value: money(core.closing),
		rows: rows.sort((a, b) => Number(b.value ?? -Infinity) - Number(a.value ?? -Infinity)),
	};
}
