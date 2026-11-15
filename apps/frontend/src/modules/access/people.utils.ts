import type { DirectoryAccount } from "@connected-repo/zod-schemas/kosh/people.zod";
import { BROKER_LABEL } from "@frontend/copy/levels.copy";

/** "Zerodha", or the name typed in for a broker Kosh does not know. */
export const brokerNameOf = (account: Pick<DirectoryAccount, "broker" | "brokerName">): string =>
	account.broker === "manual" ? (account.brokerName ?? BROKER_LABEL.manual) : BROKER_LABEL[account.broker];

/** "Anil Mehta" → "Anil". An HUF or a single word is used whole. */
export const firstNameOf = (name: string): string => {
	const words = name.trim().split(/\s+/);
	return /\bHUF\b/i.test(name) ? name.trim() : (words[0] ?? name);
};

/** "Anil" → "Anil’s", "Suhas" → "Suhas’s". */
export const possessive = (name: string): string => `${name}’s`;

/** A sensible default name for a new account: "Anil · Zerodha". */
export const defaultAccountLabel = (holderName: string, broker: string): string =>
	`${firstNameOf(holderName)} · ${broker}`;

interface RpcErrorLike {
	message?: string;
	code?: string;
	status?: number;
	data?: { code?: string } & Record<string, unknown>;
}

/** The server's own code for a refusal it explains (LAST_OWNER, SELF, COVERED_BY_HOLDER…). */
export const refusalCode = (error: unknown): string | undefined =>
	(error as RpcErrorLike | null)?.data?.code;

/** Whether the request never reached the server (offline, dropped connection). */
export const isNetworkError = (error: unknown): boolean => {
	const e = error as RpcErrorLike | null;
	return !e?.code && !e?.status;
};

/**
 * Words for something that went wrong, for a snackbar or a field. The server
 * writes its refusals for people to read; anything else gets a plain line.
 */
export const errorWords = (error: unknown, fallback: string): string => {
	if (isNetworkError(error)) return "Couldn’t reach Kosh. Check your connection and try again.";
	const e = error as RpcErrorLike;
	return e.status && e.status < 500 && e.message ? e.message : fallback;
};

const COMMON_DOMAINS = [
	"gmail.com",
	"yahoo.com",
	"yahoo.co.in",
	"outlook.com",
	"hotmail.com",
	"icloud.com",
	"rediffmail.com",
	"live.com",
];

const editDistance = (a: string, b: string): number => {
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let previous = row[0] as number;
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const current = row[j] as number;
			row[j] = Math.min(
				(row[j] as number) + 1,
				(row[j - 1] as number) + 1,
				previous + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
			previous = current;
		}
	}
	return row[b.length] as number;
};

/**
 * "vikram@gmial.com" → "vikram@gmail.com". Returns the corrected address
 * when the domain is one or two slips away from a common one, else null.
 * Typos matter here: whoever signs in with the address typed gets the access.
 */
export const suggestEmailFix = (email: string): string | null => {
	const [local, domain] = email.trim().toLowerCase().split("@");
	if (!local || !domain || COMMON_DOMAINS.includes(domain)) return null;
	const close = COMMON_DOMAINS.find((known) => {
		const distance = editDistance(domain, known);
		return distance > 0 && distance <= 2;
	});
	return close ? `${local}@${close}` : null;
};
