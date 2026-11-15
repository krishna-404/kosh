import { describe, expect, it } from "vitest";
import { defaultAccountLabel, errorWords, firstNameOf, suggestEmailFix } from "./people.utils";

describe("suggestEmailFix", () => {
	it("catches a slip in a common domain", () => {
		expect(suggestEmailFix("vikram.sethi@gmial.com")).toBe("vikram.sethi@gmail.com");
		expect(suggestEmailFix("A@GMAL.COM")).toBe("a@gmail.com");
		expect(suggestEmailFix("x@outlok.com")).toBe("x@outlook.com");
	});

	it("leaves correct and unfamiliar addresses alone", () => {
		expect(suggestEmailFix("ramesh@gmail.com")).toBeNull();
		expect(suggestEmailFix("ramesh@iyercapital.in")).toBeNull();
		expect(suggestEmailFix("not an email")).toBeNull();
	});
});

describe("names", () => {
	it("uses the first name, but an HUF whole", () => {
		expect(firstNameOf("Anil Mehta")).toBe("Anil");
		expect(firstNameOf("Anil Mehta HUF")).toBe("Anil Mehta HUF");
		expect(defaultAccountLabel("Anil Mehta", "Zerodha")).toBe("Anil · Zerodha");
	});
});

describe("errorWords", () => {
	it("passes on a refusal the server explained, and softens everything else", () => {
		expect(errorWords({ status: 400, code: "BAD_REQUEST", message: "That's you." }, "x")).toBe("That's you.");
		expect(errorWords({ status: 500, code: "INTERNAL_SERVER_ERROR", message: "boom" }, "Couldn’t save.")).toBe("Couldn’t save.");
		expect(errorWords(new TypeError("Failed to fetch"), "x")).toMatch(/connection/);
	});
});
