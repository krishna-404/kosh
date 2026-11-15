import { handleBoundaryError } from "@backend/utils/errorParser";
import { ORPCError, ValidationError } from "@orpc/server";
import { describe, expect, it } from "vitest";

// What leaves the server when something is refused. Screens branch on
// `data.code`, so it has to survive the trip.
describe("the error boundary", () => {
	it("keeps the reason a handler gave for a refusal", () => {
		const sent = handleBoundaryError(
			new ORPCError("CONFLICT", {
				status: 409,
				message: "Anil · Zerodha needs an owner.",
				data: { code: "LAST_OWNER" },
			}),
			"access.revoke",
		);
		expect(sent.code).toBe("CONFLICT");
		expect(sent.status).toBe(409);
		expect(sent.message).toBe("Anil · Zerodha needs an owner.");
		expect(sent.data).toEqual({ code: "LAST_OWNER", domainCode: "CONFLICT" });
	});

	it("answers malformed input with a 400 that names the field, not a 500", () => {
		const sent = handleBoundaryError(
			new ORPCError("BAD_REQUEST", {
				message: "Input validation failed",
				cause: new ValidationError({
					message: "Input validation failed",
					issues: [{ path: ["scope", "kind"], message: "Invalid input" }],
					data: {},
				}),
			}),
			"money.returns",
		);
		expect(sent.status).toBe(400);
		expect(sent.data).toMatchObject({
			domainCode: "VALIDATION_ERROR",
			fieldErrors: { "scope.kind": ["Invalid input"] },
		});
	});

	it("says nothing about what went wrong inside when it was not expected", () => {
		const sent = handleBoundaryError(new Error("relation \"secrets\" exploded"), "money.returns");
		expect(sent.status).toBe(500);
		expect(sent.message).toBe("An unexpected error occurred");
		expect(sent.data).toEqual({ domainCode: "INTERNAL_SERVER_ERROR" });
	});
});
