import { db } from "@backend/db/db";
import { logger } from "@backend/utils/logger.utils";
import { ulid } from "ulid";

export interface RateLimitCheckResult {
	allowed: boolean;
	/** Number of hits mathematically implied by the missing tokens. */
	currentCount: number;
	/** Configured ceiling. */
	limit: number;
	/** Seconds until a full token is regenerated. */
	retryAfterSeconds: number;
}

/**
 * Debounced "this bucket is empty" note: logged at most once per key per 60s,
 * so a caller hammering an empty bucket does not flood the log.
 *
 * Map is process-local — good enough for observability signal ("this key is
 * hot"); not a strict distributed guarantee. Bounded by unique-keys-per-60s,
 * with periodic pruning below.
 */
const EXHAUSTION_LOG_DEBOUNCE_MS = 60_000;
const exhaustionLastLoggedAt = new Map<string, number>();

const logExhaustionOncePerMinute = (
	key: string,
	limit: number,
	windowSeconds: number,
	retries: number,
): void => {
	const now = Date.now();
	const last = exhaustionLastLoggedAt.get(key);
	if (last !== undefined && now - last < EXHAUSTION_LOG_DEBOUNCE_MS) return;
	exhaustionLastLoggedAt.set(key, now);

	// Opportunistic prune to keep the Map bounded when the process serves many
	// distinct hot keys over time. O(n) but only runs when we would have logged.
	if (exhaustionLastLoggedAt.size > 1000) {
		for (const [k, t] of exhaustionLastLoggedAt) {
			if (now - t >= EXHAUSTION_LOG_DEBOUNCE_MS) exhaustionLastLoggedAt.delete(k);
		}
	}

	logger.info(
		{ key, limit, windowSeconds, retries },
		"[rateLimit] bucket empty (debounced 60s per key)",
	);
};

/**
 * Token Bucket rate limiter — Postgres-backed, one atomic statement per hit.
 *
 * Semantics: each `key` holds a bucket of `tokens`. The bucket regenerates
 * continuously at a rate of `limit / windowSeconds` up to a maximum of
 * `limit`. Every request costs 1 token.
 *
 * Storage: EXACTLY ONE row per key. Zero ongoing cleanup required.
 *
 * The refill-and-take is a single `INSERT … ON CONFLICT DO UPDATE … WHERE`,
 * so concurrent requests for one key queue on the row's lock and each sees
 * the bucket as the one before left it. (The earlier version read the row,
 * then updated it only if nobody else had, retrying five times — and when a
 * page fired a dozen requests at once for the same person, the losers ran
 * out of retries and were turned away with 429 although the bucket was
 * nearly full. A screen that loads many figures in parallel hit that
 * routinely.)
 */
export const checkAndRecordRateLimit = async (
	key: string,
	limit: number,
	windowSeconds: number,
): Promise<RateLimitCheckResult> => {
	const rate = limit / windowSeconds; // tokens per second

	// Take a token if there is one. A row comes back only when the take happened.
	const taken = await db.$query<{ tokens: number }>`
		INSERT INTO "rate_limits" ("id", "key", "tokens", "last_updated_at")
		VALUES (${ulid()}, ${key}, ${limit - 1}::float8, clock_timestamp())
		ON CONFLICT ("key") DO UPDATE SET
			"tokens" = LEAST(
				${limit}::float8,
				"rate_limits"."tokens"
					+ GREATEST(0, EXTRACT(EPOCH FROM (clock_timestamp() - "rate_limits"."last_updated_at"))) * ${rate}::float8
			) - 1,
			"last_updated_at" = clock_timestamp()
		WHERE LEAST(
			${limit}::float8,
			"rate_limits"."tokens"
				+ GREATEST(0, EXTRACT(EPOCH FROM (clock_timestamp() - "rate_limits"."last_updated_at"))) * ${rate}::float8
		) >= 1
		RETURNING "tokens"`;

	const left = taken.rows[0]?.tokens;
	if (left !== undefined)
		return {
			allowed: true,
			currentCount: Math.ceil(limit - Number(left)),
			limit,
			retryAfterSeconds: 0,
		};

	// Empty. How long until one whole token is back?
	const current = await db.rateLimits.findByOptional({ key });
	const tokens = current
		? Math.min(limit, Number(current.tokens) + Math.max(0, (Date.now() - current.lastUpdatedAt) / 1000) * rate)
		: 0;
	logExhaustionOncePerMinute(key, limit, windowSeconds, 0);
	return {
		allowed: false,
		currentCount: limit,
		limit,
		retryAfterSeconds: Math.max(1, Math.ceil((1 - tokens) / rate)),
	};
};
