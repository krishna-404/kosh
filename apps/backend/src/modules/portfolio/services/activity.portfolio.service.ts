import { db } from "@backend/db/db";
import { toMoney } from "@backend/modules/imports/lib/decimal.imports";
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

/** How an answer about a ledger line reads in a sentence. */
const ANSWER_WORDS: Record<string, string> = {
	external_deposit: "money put in",
	external_withdrawal: "money taken out",
	charge: "a charge",
	interest: "interest",
	trade_settlement: "part of a trade settling",
	other_internal: "neither money in nor out",
};

/** Rupees with Indian grouping, no paise: "1234567.00" → "12,34,567". */
const formatInr = (amount: string): string => {
	const whole = toMoney(amount).split(".")[0] ?? "0";
	const digits = whole.replace("-", "");
	const grouped =
		digits.length <= 3
			? digits
			: `${digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${digits.slice(-3)}`;
	return whole.startsWith("-") ? `−${grouped}` : grouped;
};

interface ListInput {
	accountId?: string;
	filter: "all" | "uploads" | "access" | "answers";
	before?: string;
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
	"expiresAt",
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

	const now = Date.now();
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

	// Statements: uploads, undos and answers — for anyone who can see the account.
	const wantsUploads = input.filter === "all" || input.filter === "uploads";
	const wantsAnswers = input.filter === "all" || input.filter === "answers";
	const accountIds = accounts.map((a) => a.id);
	const batches =
		wantsUploads && accountIds.length > 0
			? await db.importBatches
					.where({ accountId: { in: accountIds }, status: { in: ["applied", "retracted"] } })
					.select("id", "accountId", "fileName", "kind", "uploadedByUserId", "appliedAt", "createdAt", "stats")
			: [];
	const ledgerEvents =
		(wantsUploads || wantsAnswers) && accountIds.length > 0
			? await db.events
					.where({
						accountId: { in: accountIds },
						kind: { in: ["retraction", "user_resolution"] },
					})
					.select("id", "accountId", "kind", "payload", "userId", "occurredAt")
			: [];
	const transfers = wantsAnswers
		? (
				await db.transferLinks.select(
					"id",
					"outAccountId",
					"inAccountId",
					"same",
					"decidedByUserId",
					"createdAt",
				)
			).filter(
				(l) => !input.accountId || l.outAccountId === input.accountId || l.inAccountId === input.accountId,
			)
		: [];

	const users = await usersById([
		...grants.flatMap((g) => [g.userId, g.grantedByUserId, g.revokedByUserId]),
		...accounts.map((a) => a.createdByUserId),
		...batches.map((b) => b.uploadedByUserId),
		...ledgerEvents.map((e) => e.userId),
		...transfers.map((t) => t.decidedByUserId),
	]);
	const person = (userId: string | null) => {
		if (!userId) return null;
		const u = users.get(userId);
		return { key: userId, name: u?.name ?? u?.email ?? "Someone", isMe: userId === meId };
	};
	const subjectOf = (g: { userId: string | null; invitedEmail: string | null }) =>
		g.userId
			? { name: person(g.userId)?.name ?? "Someone", isMe: g.userId === meId, pending: false }
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
			inviteOpen: false,
		};
		// An invite nobody has used yet, and that still works.
		const open =
			g.userId === null && g.revokedAt === null && (g.expiresAt === null || g.expiresAt > now);
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
				inviteOpen: open,
			});
		} else if (g.personId && g.userId && g.userId === g.grantedByUserId) {
			// Adding a person is not about any one account: left out when
			// the record is being read for a single account.
			if (!input.accountId) items.push({
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
				inviteOpen: open,
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

	const accountTarget = (accountId: string | null) => {
		const a = accountId ? accountById.get(accountId) : undefined;
		return a ? { kind: "account" as const, id: a.id, label: a.label } : null;
	};
	const plain = { subject: null, level: null, fromLevel: null, inviteOpen: false };

	for (const b of batches) {
		const stats = (b.stats ?? {}) as { new?: number; questions?: number };
		const lines = Number(stats.new ?? 0);
		const questions = Number(stats.questions ?? 0);
		items.push({
			...plain,
			id: `${b.id}:upload`,
			at: b.appliedAt ?? b.createdAt,
			kind: "upload",
			actor: person(b.uploadedByUserId),
			target: accountTarget(b.accountId),
			detail: [
				b.fileName ?? `A ${b.kind}`,
				`${lines} ${lines === 1 ? "line" : "lines"}`,
				...(questions > 0 ? [`${questions} ${questions === 1 ? "question" : "questions"} raised`] : []),
			].join(" — "),
		});
	}

	for (const e of ledgerEvents) {
		const payload = e.payload as {
			batchId?: string;
			fileName?: string;
			cashFlowId?: string;
			question?: string;
			answer?: string;
			amount?: string;
		};
		if (e.kind === "retraction") {
			// Undoing an upload; taking an answer back is told with the answers.
			const isUpload = payload.batchId !== undefined && payload.cashFlowId === undefined;
			if (isUpload ? !wantsUploads : !wantsAnswers) continue;
			items.push({
				...plain,
				id: `${e.id}:undo`,
				at: e.occurredAt,
				kind: isUpload ? "undo" : "answer",
				actor: person(e.userId),
				target: accountTarget(e.accountId),
				detail: isUpload ? (payload.fileName ?? "an upload") : "took an answer back",
			});
		} else if (wantsAnswers) {
			items.push({
				...plain,
				id: `${e.id}:answer`,
				at: e.occurredAt,
				kind: "answer",
				actor: person(e.userId),
				target: accountTarget(e.accountId),
				detail:
					payload.question === "opening_balance"
						? `counted the ₹${formatInr(payload.amount ?? "0")} the account started with as money put in`
						: `said a ledger line was ${ANSWER_WORDS[payload.answer ?? ""] ?? "something else"}`,
			});
		}
	}

	for (const t of transfers) {
		const from = accountById.get(t.outAccountId)?.label;
		const to = accountById.get(t.inAccountId)?.label;
		items.push({
			...plain,
			id: `${t.id}:transfer`,
			at: t.createdAt,
			kind: "answer",
			actor: person(t.decidedByUserId),
			// Filed under the account the caller can see; the other is named only if they see it too.
			target: accountTarget(to ? t.inAccountId : t.outAccountId),
			detail: t.same
				? `said money moving ${from ? `from ${from} ` : ""}${to ? `to ${to} ` : ""}was the same money`.trim()
				: "said two matching amounts were not the same money",
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
				inviteOpen: false,
			});

	// Newest first; entries of the same moment in a fixed order. The cursor
	// names an entry ("<when>|<id>"), so a page boundary that falls between
	// two entries of the same millisecond loses neither.
	const [beforeAt, beforeId] = input.before ? input.before.split("|") : [];
	const cutAt = Number(beforeAt);
	const page = items
		.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
		.filter(
			(item) =>
				input.before === undefined ||
				item.at < cutAt ||
				(item.at === cutAt && item.id.localeCompare(beforeId ?? "") < 0),
		);
	const shown = page.slice(0, input.limit);
	const last = shown[shown.length - 1];
	return {
		items: shown,
		nextBefore: page.length > shown.length && last ? `${last.at}|${last.id}` : null,
	};
}
