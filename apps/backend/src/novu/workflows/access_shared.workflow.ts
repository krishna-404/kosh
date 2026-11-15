import { workflow } from "@novu/framework";

/**
 * "Someone shared accounts with you" — sent when an owner shares with an
 * address, whether or not a login for it exists yet.
 *
 * For the family's privacy the message never carries an amount: only who
 * shared, how many accounts, and what the level allows.
 *
 * The email step needs an email provider connected in Novu; without one the
 * in-app and push steps still reach people who already use Kosh, and the
 * inviter can pass the link on by hand.
 */
/** Names and labels are typed by people; in an email's HTML they are text, never markup. */
const esc = (text: string): string =>
	text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const accessSharedWorkflow = workflow(
	"access-shared",
	async ({ step, payload }) => {
		const what =
			payload.scope === "holder"
				? `all of ${payload.targetLabel}'s accounts`
				: payload.targetLabel;
		const subject = `${payload.inviterName} shared ${what} with you on Kosh`;

		await step.inApp("in-app", async () => ({
			subject,
			body: `You ${payload.levelWords}.`,
			redirect: { url: payload.path },
		}));

		await step.push("push", async () => ({
			subject,
			body: `You ${payload.levelWords}.`,
		}));

		await step.email("email", async () => ({
			subject,
			body: [
				`<p>${esc(payload.inviterName)} uses Kosh to keep track of investments and has shared ${esc(what)} with you.</p>`,
				`<p>You ${esc(payload.levelWords)}.</p>`,
				`<p><a href="${esc(payload.url)}">Open Kosh</a></p>`,
				`<p>Sign in with <b>${esc(payload.email)}</b> — the address this was sent to. Access only works with this address. This email never shows amounts.</p>`,
				`<p><b>Not you, or not expecting this?</b> <a href="${esc(payload.wrongPersonUrl)}">Tell ${esc(payload.inviterName)} it reached the wrong person</a> — the invite stops working at once. Or ignore this email: nothing is shared until someone signs in with this address.</p>`,
				`<p>This invite works until ${esc(payload.expiresOn)}. Kosh will never ask for your broker password or an OTP by email.</p>`,
			].join(""),
		}));
	},
	{
		payloadSchema: {
			type: "object",
			properties: {
				inviterName: { type: "string" },
				email: { type: "string" },
				scope: { type: "string", enum: ["account", "holder"] },
				targetLabel: { type: "string" },
				levelWords: { type: "string" },
				path: { type: "string" },
				url: { type: "string" },
				wrongPersonUrl: { type: "string" },
				expiresOn: { type: "string" },
			},
			required: [
				"inviterName",
				"email",
				"scope",
				"targetLabel",
				"levelWords",
				"path",
				"url",
				"wrongPersonUrl",
				"expiresOn",
			],
			additionalProperties: false,
		} as const,
		name: "Accounts shared with you",
		description: "Sent when an owner shares an account, or all of a person's accounts.",
	},
);
