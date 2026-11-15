import { env } from "@backend/configs/env.config";
import { db } from "@backend/db/db";
import { logger } from "@backend/utils/logger.utils";
import {
	triggerNotification,
	upsertSubscriber,
} from "@backend/utils/notifications.utils";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";

// Telling people about sharing. Best-effort and after the fact: sharing has
// already happened by the time this runs, and a notification that cannot be
// sent must never undo it. Does nothing when Novu is not configured.

const LEVEL_WORDS: Record<AccessLevel, string> = {
	view: "can see holdings, cash flows and returns, and how each number was worked out",
	edit: "can see everything, upload statements, undo an upload and answer questions",
	owner:
		"can see and change everything, including who else has access — once an owner confirms it is you",
};

async function send(input: {
	grantId: string;
	inviteToken: string | null;
	by: { name: string };
}): Promise<void> {
	const grant = await db.accessGrants
		.where({ id: input.grantId })
		.select("personId", "accountId", "userId", "invitedEmail", "level", "expiresAt")
		.takeOptional();
	if (!grant) return;

	const label = grant.accountId
		? await db.brokerAccounts.unscope("default").find(grant.accountId).get("label")
		: await db.persons
				.unscope("default")
				.find(grant.personId as string)
				.get("displayName");
	const user = grant.userId
		? await db.users.find(grant.userId).select("id", "email", "name")
		: null;
	const email = user?.email ?? grant.invitedEmail;
	if (!email) return;

	// Someone who is not a login yet is reached as a subscriber of their own,
	// keyed by the address, so nothing links them to an account before sign-in.
	const subscriberId = user?.id ?? `invite:${email}`;
	await upsertSubscriber(subscriberId, { email, firstName: user?.name });

	const path = input.inviteToken ? `/invite/${input.inviteToken}` : "/shared";
	await triggerNotification({
		workflowId: "access-shared",
		subscriberId,
		payload: {
			inviterName: input.by.name,
			email,
			scope: grant.accountId ? "account" : "holder",
			targetLabel: label,
			levelWords: LEVEL_WORDS[grant.level],
			path,
			url: `${env.WEBAPP_URL}${path}`,
			wrongPersonUrl: input.inviteToken
				? `${env.WEBAPP_URL}/invite/${input.inviteToken}/wrong-person`
				: `${env.WEBAPP_URL}/shared`,
			expiresOn: grant.expiresAt
				? new Date(grant.expiresAt).toLocaleDateString("en-IN", {
						day: "numeric",
						month: "short",
						year: "numeric",
					})
				: "you are removed",
		},
	});
}

/** Fire-and-forget: never throws, never delays the response. */
export function notifyShared(input: {
	grantId: string;
	inviteToken: string | null;
	by: { name: string };
}): void {
	void send(input).catch((error) =>
		logger.warn({ error, grantId: input.grantId }, "Could not send the share notification"),
	);
}

/**
 * Who, besides `exceptUserId`, can answer questions on an account: everyone
 * whose access to it — directly or through its holder — is Can edit or Owner.
 * (An Owner invite not yet confirmed counts as Can view, so it is left out.)
 */
export async function answerersOf(accountId: string, exceptUserId: string): Promise<string[]> {
	const account = await db.brokerAccounts.unscope("default").where({ id: accountId }).select("personId").takeOptional();
	if (!account) return [];
	const grants = await db.accessGrants
		.where({
			revokedAt: null,
			userId: { not: null },
			needsConfirmation: false,
			level: { in: ["edit", "owner"] },
			OR: [{ accountId }, { personId: account.personId, accountId: null }],
		})
		.select("userId");
	return [...new Set(grants.map((g) => g.userId as string))].filter((id) => id !== exceptUserId);
}

async function sendQuestions(input: { accountId: string; count: number; by: { id: string; name: string } }): Promise<void> {
	const account = await db.brokerAccounts.unscope("default").where({ id: input.accountId }).select("label").takeOptional();
	if (!account) return;
	for (const userId of await answerersOf(input.accountId, input.by.id)) {
		const user = await db.users.find(userId).select("id", "email", "name");
		await upsertSubscriber(user.id, { email: user.email ?? undefined, firstName: user.name });
		await triggerNotification({
			workflowId: "questions-waiting",
			subscriberId: user.id,
			payload: {
				uploaderName: input.by.name,
				accountLabel: account.label,
				count: input.count,
				path: `/accounts/${input.accountId}?tab=statements`,
			},
		});
	}
}

/**
 * After an upload that left questions: tell the other people who can answer
 * them. Fire-and-forget: never throws, never delays the response.
 */
export function notifyQuestions(input: { accountId: string; count: number; by: { id: string; name: string } }): void {
	if (input.count <= 0) return;
	void sendQuestions(input).catch((error) =>
		logger.warn({ error, accountId: input.accountId }, "Could not send the questions notification"),
	);
}
