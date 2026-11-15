import { workflow } from "@novu/framework";

/**
 * "A statement went in and Kosh has questions" — sent to the other people
 * who can answer them (owners and editors of the account), not to whoever
 * uploaded it: they have just been shown the questions.
 *
 * Like every Kosh message it carries no amount: only who uploaded, to which
 * account, and how many questions are waiting. In-app and push only — a
 * question is not worth an email.
 */
export const questionsWaitingWorkflow = workflow(
	"questions-waiting",
	async ({ step, payload }) => {
		const count = payload.count === 1 ? "1 question needs" : `${payload.count} questions need`;
		const subject = `${payload.accountLabel}: ${count} an answer`;
		const body = `${payload.uploaderName} added a statement. Returns use Kosh’s best guess until someone answers.`;

		await step.inApp("in-app", async () => ({ subject, body, redirect: { url: payload.path } }));
		await step.push("push", async () => ({ subject, body }));
	},
	{
		payloadSchema: {
			type: "object",
			properties: {
				uploaderName: { type: "string" },
				accountLabel: { type: "string" },
				count: { type: "number" },
				path: { type: "string" },
			},
			required: ["uploaderName", "accountLabel", "count", "path"],
			additionalProperties: false,
		} as const,
	},
);
