import { db } from "@backend/db/db";
import { portfolioRouter } from "@backend/modules/portfolio/portfolio.router";
import { ensureFamilyId } from "@backend/modules/portfolio/services/ensure_family.portfolio.service";
import { defaultContext } from "@backend/test/setup";
import { createUserAndLogin } from "@backend/test/utils/user-auth.utils";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it } from "vitest";

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe("Family tenancy", () => {
	let mine: RouterClient<typeof portfolioRouter>;
	let myUserId: string;

	beforeEach(() => {
		if (!defaultContext) throw new Error("defaultContext not initialized");
		myUserId = defaultContext.user.id;
		mine = createRouterClient(portfolioRouter, { context: defaultContext });
	});

	it("gives every new user a family of their own at sign-up", async () => {
		const me = await db.users.find(myUserId);
		expect(me.familyId).toMatch(ULID);

		const other = await createUserAndLogin();
		const them = await db.users.find(other.user.id);
		expect(them.familyId).toMatch(ULID);
		expect(them.familyId).not.toBe(me.familyId);

		const family = await db.families.find(me.familyId as string);
		expect(family.name).toBe(`${me.name.trim().split(/\s+/)[0]}'s family`);
	});

	it("stamps the caller's family — not the row id — on what they create", async () => {
		const person = await mine.createPerson({ displayName: "Dad" });
		const me = await db.users.find(myUserId);

		expect(person.familyId).toBe(me.familyId);
		expect(person.id).toMatch(ULID);
		expect(person.id).not.toBe(me.familyId);
	});

	it("gives each row of a bulk insert the family and nothing else", async () => {
		const person = await mine.createPerson({ displayName: "Dad" });
		const a = await mine.createAccount({
			personId: person.id,
			broker: "zerodha",
			label: "Dad Zerodha",
		});
		const b = await mine.createAccount({
			personId: person.id,
			broker: "groww",
			label: "Dad Groww",
		});
		const group = await mine.createGroup({ name: "Parents" });

		// setGroupMembers goes through createMany.
		await mine.setGroupMembers({
			groupId: group.id,
			accountIds: [a.id, b.id],
		});

		const me = await db.users.find(myUserId);
		const rows = await db.accountGroupMembers.where({ groupId: group.id });
		expect(rows.map((r) => r.accountId).sort()).toEqual([a.id, b.id].sort());
		expect(rows.every((r) => r.familyId === me.familyId)).toBe(true);

		expect(await mine.listGroups()).toEqual([
			{ id: group.id, name: "Parents", accountIds: expect.any(Array) },
		]);
	});

	it("hides one family's portfolio from another", async () => {
		const person = await mine.createPerson({ displayName: "Dad" });
		const account = await mine.createAccount({
			personId: person.id,
			broker: "zerodha",
			label: "Dad Zerodha",
		});
		const group = await mine.createGroup({ name: "Parents" });

		const theirs = createRouterClient(portfolioRouter, {
			context: await createUserAndLogin(),
		});

		expect(await theirs.listPersons()).toEqual([]);
		expect(await theirs.listAccounts()).toEqual([]);
		expect(await theirs.listGroups()).toEqual([]);

		// Referencing another family's rows by id must fail, not attach to them.
		await expect(
			theirs.createAccount({
				personId: person.id,
				broker: "zerodha",
				label: "Hijack",
			}),
		).rejects.toThrow();
		await expect(
			theirs.setGroupMembers({ groupId: group.id, accountIds: [account.id] }),
		).rejects.toThrow();

		// …and the owner still sees exactly what they made.
		expect(await mine.listPersons()).toEqual([
			{ id: person.id, displayName: "Dad" },
		]);
		expect((await mine.listAccounts()).map((a) => a.id)).toEqual([account.id]);
	});

	it("rejects callers without a session", async () => {
		const anonymous = createRouterClient(portfolioRouter, {
			context: { reqHeaders: new Headers() },
		});
		await expect(anonymous.listPersons()).rejects.toThrow();
	});

	it("mints a family for a user row that has none, once", async () => {
		await db.users.where({ id: myUserId }).update({ familyId: null });

		const first = await ensureFamilyId(myUserId);
		const second = await ensureFamilyId(myUserId);
		expect(first).toMatch(ULID);
		expect(second).toBe(first);

		// The procedure heals the same way, so the request just works.
		await db.users.where({ id: myUserId }).update({ familyId: null });
		const person = await mine.createPerson({ displayName: "Mom" });
		const me = await db.users.find(myUserId);
		expect(me.familyId).toMatch(ULID);
		expect(person.familyId).toBe(me.familyId);
	});
});
