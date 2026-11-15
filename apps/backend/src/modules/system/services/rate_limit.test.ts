import { db } from "@backend/db/db";
import { checkAndRecordRateLimit } from "@backend/modules/system/services/rate_limit.service";
import { describe, expect, it } from "vitest";

// The request limiter. A screen loads many figures at once, so many requests
// for one person arrive together: none may be turned away while the bucket
// still has tokens, and exactly `limit` may pass when it does not.
describe("the request limiter", () => {
	const key = () => `test:user:${Math.random().toString(36).slice(2)}`;

	it("lets a burst through while there are tokens — every request, however many arrive together", async () => {
		const k = key();
		const results = await Promise.all(Array.from({ length: 60 }, () => checkAndRecordRateLimit(k, 300, 60)));
		expect(results.filter((r) => r.allowed)).toHaveLength(60);
		const row = await db.rateLimits.findBy({ key: k });
		// 60 taken from 300, give or take what trickled back in meanwhile.
		expect(Number(row.tokens)).toBeGreaterThan(239.9);
		expect(Number(row.tokens)).toBeLessThan(241);
	});

	it("lets exactly the limit through when more than that arrive together", async () => {
		const k = key();
		// A long window, so nothing refills while the test runs.
		const results = await Promise.all(Array.from({ length: 40 }, () => checkAndRecordRateLimit(k, 10, 100_000)));
		expect(results.filter((r) => r.allowed)).toHaveLength(10);
		const refused = results.find((r) => !r.allowed);
		expect(refused).toMatchObject({ allowed: false, limit: 10 });
		expect(refused?.retryAfterSeconds).toBeGreaterThan(0);
	});

	it("gives tokens back with time, never more than the limit", async () => {
		const k = key();
		for (let i = 0; i < 5; i++) await checkAndRecordRateLimit(k, 5, 60);
		expect((await checkAndRecordRateLimit(k, 5, 60)).allowed).toBe(false);

		// Thirty seconds on: half the bucket is back.
		await db.rateLimits.where({ key: k }).update({ lastUpdatedAt: new Date(Date.now() - 30_000) });
		expect((await checkAndRecordRateLimit(k, 5, 60)).allowed).toBe(true);
		expect((await checkAndRecordRateLimit(k, 5, 60)).allowed).toBe(true);
		expect((await checkAndRecordRateLimit(k, 5, 60)).allowed).toBe(false);

		// A day on: full, not overflowing.
		await db.rateLimits.where({ key: k }).update({ lastUpdatedAt: new Date(Date.now() - 86_400_000) });
		const results = await Promise.all(Array.from({ length: 8 }, () => checkAndRecordRateLimit(k, 5, 60)));
		expect(results.filter((r) => r.allowed)).toHaveLength(5);
	});
});
