import { describe, expect, it } from "vitest";
import { niceTicks } from "./LineChart";

describe("niceTicks", () => {
	it("picks round steps that cover the range", () => {
		expect(niceTicks(0, 3_305_674)).toEqual([0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]);
		expect(niceTicks(0, 84_20_000)).toEqual([0, 2_500_000, 5_000_000, 7_500_000, 10_000_000]);
		expect(niceTicks(0, 950)).toEqual([0, 250, 500, 750, 1000]);
	});

	it("starts below the low end when the series never come near zero", () => {
		const ticks = niceTicks(7_100_000, 8_420_000);
		expect(ticks[0]).toBeLessThanOrEqual(7_100_000);
		expect(ticks.at(-1)).toBeGreaterThanOrEqual(8_420_000);
		expect(ticks.length).toBeLessThanOrEqual(6);
	});

	it("does not fall over on an empty or flat range", () => {
		expect(niceTicks(5, 5)).toEqual([5]);
		expect(niceTicks(Number.NaN, 1)).toEqual([0]);
	});
});
