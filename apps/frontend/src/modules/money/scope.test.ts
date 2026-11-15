import { describe, expect, it } from "vitest";
import { EVERYTHING, periodFromParam, sameScope, scopeFromParam, scopeSearch, scopeToParam } from "./scope";

describe("scope in the address", () => {
	it("round-trips a group, a holder and an account", () => {
		for (const scope of [
			{ kind: "group", id: "01HGROUP" },
			{ kind: "holder", id: "01HHOLDER" },
			{ kind: "account", id: "01HACCOUNT" },
		] as const)
			expect(scopeFromParam(scopeToParam(scope))).toEqual(scope);
	});

	it("reads anything else as everything, never as an error", () => {
		expect(scopeToParam(EVERYTHING)).toBeNull();
		for (const raw of [null, "", "group", "group:", "team:1", "nonsense"]) expect(scopeFromParam(raw)).toEqual(EVERYTHING);
		expect(periodFromParam("1y")).toBe("1y");
		expect(periodFromParam("10y")).toBe("all");
		expect(periodFromParam(null)).toBe("all");
	});

	it("keeps the plain address for the defaults", () => {
		expect(scopeSearch(EVERYTHING)).toBe("");
		expect(scopeSearch({ kind: "group", id: "g1" }, "3y")).toBe("?in=group%3Ag1&over=3y");
		expect(sameScope({ kind: "group", id: "g1" }, { kind: "group", id: "g1" })).toBe(true);
		expect(sameScope({ kind: "group", id: "g1" }, { kind: "holder", id: "g1" })).toBe(false);
	});
});
