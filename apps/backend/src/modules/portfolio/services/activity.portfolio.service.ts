import { db } from "@backend/db/db";
import {
	inList,
	requireAccess,
	requireAccountLevel,
	usersById,
} from "@backend/modules/portfolio/services/access.portfolio.service";
import type {
	ActivityItem,
	ActivityList,
} from "@connected-repo/zod-schemas/kosh/people.zod";

// The activity record: who did what, when. Nothing here can be edited —
// every entry is read off rows that are themselves never changed.
//
// Who may read what (design rule 4):
//   - adding an account, uploads, undos and answers: anyone who can see the account;
//   - access changes: owners of the target only — plus changes to the
//     caller's own access, so nobody is surprised by what happened to them.

interface ListInput {
	accountId?: string;
	filter: "all" | "uploads" | "access" | "answers";
	before?: number;
	limit: number;
}

const GRANT_COLUMNS = [
	"id",
	"personId",
	"accountId",
	"userId",
	"invitedEmail",
	"level",
	"grantedByUserId",
	"revokedAt",
	"revokedByUserId",
	"endReason",
	"supersedesGrantId",
	"confirmedAt",
	"createdAt",
] as const;

export async function listActivity(
	meId: string,
	input: ListInput,
): Promise<ActivityList> {
	const ctx = requireAccess();
	if (input.accountId) requireAccountLevel(input.accountId, "view");

	const wantsAccess = input.filter === "all" || input.filter === "access";
	const items: ActivityItem[] = [];

	// Accounts in view for this request.
	const accounts = await db.brokerAccounts
		.where(input.accountId ? { id: input.accountId } : {})
		.select("id", "label", "personId", "createdByUserId", "createdAt");
	const accountById = new Map(accounts.map((a) => [a.id, a]));
	const holders = await db.persons.select("id", "displayName");
	const holderById = new Map(holders.map((h) => [h.id, h]));

	const ownedAccounts = accounts
		.filter((a) => ctx.accountLevels.get(a.id) === "owner")
		.map((a) => a.id);
	const ownedHolders = input.accountId
		? accounts
				.filter((a) => ctx.personLevels.get(a.personId) === "owner")
				.map((a) => a.personId)
		: [...ctx.personLevels].filter(([, l]) => l === "owner").map(([id]) => id);

	const grants = wantsAccess
		? await db.accessGrants
				.where({
					OR: [
						{ accountId: { in: inList(ownedAccounts) } },
						{ personId: { in: inList(ownedHolders) } },
						{
							userId: meId,
							...(input.accountId ? { accountId: input.accountId } : {}),
						},
					],
				})
				.select(...GRANT_COLUMNS)
		: [];
	// A new row that replaced another needs the old row to say what changed.
	const byId = new Map(grants.map((g) => [g.id, g]));
	const missing = grants
		.map((g) => g.supersedesGrantId)
		.filter((id): id is string => !!id && !byId.has(id));
	if (missing.length > 0) {
		const previous = await db.accessGrants
			.where({ id: { in: missing } })
			.select(...GRANT_COLUMNS);
		for (const p of previous) byId.set(p.id, p);
	}

	const users = await usersById([
		...grants.flatMap((g) => [g.userId, g.grantedByUserId, g.revokedByUserId]),
		...accounts.map((a) => a.createdByUserId),
	]);
	const person = (userId: string | null) => {
		if (!userId) return null;
		const u = users.get(userId);
		return { name: u?.name ?? u?.email ?? "Someone", isMe: userId === meId };
	};
	const subjectOf = (g: { userId: string | null; invitedEmail: string | null }) =>
		g.userId
			? { ...(person(g.userId) ?? { name: "Someone", isMe: false }), pending: false }
			: { name: g.invitedEmail ?? "", isMe: false, pending: true };
	const targetOf = (g: { accountId: string | null; personId: string | null }) =>
		g.accountId
			? {
					kind: "account" as const,
					id: g.accountId,
					label: accountById.get(g.accountId)?.label ?? "An account",
				}
			: {
					kind: "holder" as const,
					id: g.personId as string,
					label: holderById.get(g.personId as string)?.displayName ?? "Someone",
				};

	for (const g of grants) {
		const base = {
			subject: subjectOf(g),
			level: g.level,
			fromLevel: null,
			target: targetOf(g),
			detail: null,
		};
		const previous = g.supersedesGrantId ? byId.get(g.supersedesGrantId) : undefined;

		// How the row began.
		if (previous?.endReason === "claimed") {
			items.push({
				...base,
				id: `${g.id}:accepted`,
				at: g.createdAt,
				kind: "invite_accepted",
				actor: person(g.userId),
			});
		} else if (previous?.endReason === "level_changed") {
			items.push({
				...base,
				id: `${g.id}:level`,
				at: g.createdAt,
				kind: "level_changed",
				actor: person(g.grantedByUserId),
				fromLevel: previous.level,
			});
		} else if (previous?.endReason === "renewed") {
			items.push({
				...base,
				id: `${g.id}:resent`,
				at: g.createdAt,
				kind: "invite_resent",
				actor: person(g.grantedByUserId),
			});
		} else if (g.personId && g.userId && g.userId === g.grantedByUserId) {
			items.push({
				...base,
				id: `${g.id}:holder`,
				at: g.createdAt,
				kind: "holder_added",
				actor: person(g.userId),
				subject: null,
			});
		} else {
			items.push({
				...base,
				id: `${g.id}:start`,
				at: g.createdAt,
				kind: g.userId ? "access_given" : "invited",
				actor: person(g.grantedByUserId),
			});
		}

		if (g.confirmedAt !== null)
			items.push({
				...base,
				id: `${g.id}:confirmed`,
				at: g.confirmedAt,
				kind: "owner_confirmed",
				actor: null,
			});

		// How it ended — unless a newer row already tells that story.
		const endKind = (
			{
				removed: "removed",
				left: "left",
				cancelled: "invite_cancelled",
				expired: "invite_expired",
				reported_wrong: "invite_reported_wrong",
			} as const
		)[g.endReason as "removed" | "left" | "cancelled" | "expired" | "reported_wrong"];
		if (g.revokedAt !== null && endKind)
			items.push({
				...base,
				id: `${g.id}:end`,
				at: g.revokedAt,
				kind: endKind,
				actor: person(g.revokedByUserId),
			});
	}

	if (input.filter === "all")
		for (const a of accounts)
			items.push({
				id: `${a.id}:added`,
				at: a.createdAt,
				kind: "account_added",
				actor: person(a.createdByUserId),
				subject: null,
				level: null,
				fromLevel: null,
				target: { kind: "account", id: a.id, label: a.label },
				detail: null,
			});

	const page = items
		.filter((item) => input.before === undefined || item.at < input.before)
		.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
	const shown = page.slice(0, input.limit);
	return {
		items: shown,
		nextBefore:
			page.length > shown.length ? (shown[shown.length - 1]?.at ?? null) : null,
	};
}
