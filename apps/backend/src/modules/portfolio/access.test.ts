import { db } from "@backend/db/db";
import { requestContext } from "@backend/lib/request-context";
import { importsRouter } from "@backend/modules/imports/imports.router";
import { accessRouter } from "@backend/modules/portfolio/access.router";
import { portfolioRouter } from "@backend/modules/portfolio/portfolio.router";
import { loadAccess } from "@backend/modules/portfolio/services/access.portfolio.service";
import { defaultContext } from "@backend/test/setup";
import { createUserAndLogin } from "@backend/test/utils/user-auth.utils";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it } from "vitest";

// The account is the unit of access. These tests drive the real routers as
// different signed-in people and check what each can see and do.

type Session = Awaited<ReturnType<typeof createUserAndLogin>>;

const as = (context: Session) => ({
	email: context.user.email as string,
	id: context.user.id,
	portfolio: createRouterClient(portfolioRouter, { context }),
	access: createRouterClient(accessRouter, { context }),
	imports: createRouterClient(importsRouter, { context }),
});
type Person = ReturnType<typeof as>;

/** A second login whose email is verified, so a grant links to it directly. */
async function signUp(): Promise<Person> {
	const session = await createUserAndLogin();
	await db.users.where({ id: session.user.id }).update({ emailVerified: true });
	return as(session);
}

const LEDGER = [
	"particulars,posting_date,cost_center,voucher_type,debit,credit,net_balance",
	"Opening Balance,,,,,,0.000000",
	"Funds added using UPI ref1,2025-09-01,NSE-EQ - Z,Bank Receipts,0.000000,10000.000000,10000.000000",
	"Closing Balance,,,,,,10000.000000",
].join("\n");
const ledger = (accountId: string) => ({
	accountId,
	kind: "ledger" as const,
	fileName: "ledger.csv",
	content: LEDGER,
});

const levels = async (who: Person) =>
	Object.fromEntries(
		(await who.portfolio.listAccounts()).map((a) => [a.id, a.level]),
	);

describe("Account access", () => {
	let anil: Person;
	let holderId: string;
	let zerodha: string;
	let groww: string;

	beforeEach(async () => {
		if (!defaultContext) throw new Error("defaultContext not initialized");
		// Real logins come in through Google with a verified address.
		await db.users
			.where({ id: defaultContext.user.id })
			.update({ emailVerified: true });
		anil = as(defaultContext);
		holderId = (await anil.portfolio.createPerson({ displayName: "Anil" })).id;
		zerodha = (
			await anil.portfolio.createAccount({
				personId: holderId,
				broker: "zerodha",
				label: "Anil Zerodha",
			})
		).id;
		groww = (
			await anil.portfolio.createAccount({
				personId: holderId,
				broker: "groww",
				label: "Anil Groww",
			})
		).id;
	});

	describe("ownership", () => {
		it("makes whoever adds a holder the owner of it and of every account under it", async () => {
			expect(await levels(anil)).toEqual({
				[zerodha]: "owner",
				[groww]: "owner",
			});
			expect(await anil.portfolio.listPersons()).toEqual([
				{ id: holderId, displayName: "Anil" },
			]);
		});

		it("shows a stranger nothing and gives them nothing to attach to", async () => {
			const stranger = await signUp();

			expect(await stranger.portfolio.listPersons()).toEqual([]);
			expect(await stranger.portfolio.listAccounts()).toEqual([]);
			// An account they cannot see does not exist as far as they can tell.
			await expect(
				stranger.imports.list({ accountId: zerodha }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				stranger.portfolio.createAccount({
					personId: holderId,
					broker: "dhan",
					label: "Hijack",
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				stranger.access.list({ accountId: zerodha }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("rejects callers without a session", async () => {
			const anonymous = createRouterClient(portfolioRouter, {
				context: { reqHeaders: new Headers() },
			});
			await expect(anonymous.listAccounts()).rejects.toThrow();
		});
	});

	describe("the safety net under every handler", () => {
		// Each account-scoped table filters itself to the caller's accounts, so
		// a handler that forgets to check still cannot read someone else's rows.
		const visibleRows = (user: Person) =>
			loadAccess({ id: user.id, email: user.email, emailVerified: true }).then(
				(access) =>
					requestContext.run(access, async () => ({
						persons: await db.persons.count(),
						accounts: await db.brokerAccounts.count(),
						batches: await db.importBatches.count(),
						ledgerLines: await db.rawLedgerLines.count(),
						cashFlows: await db.cashFlows.count(),
						events: await db.events.count(),
					})),
			);

		it("limits every table to the accounts the caller can see", async () => {
			await anil.imports.apply(ledger(zerodha));
			const stranger = await signUp();
			const vikram = await signUp();
			await anil.access.grant({
				target: { accountId: groww },
				email: vikram.email,
				level: "view",
			});

			expect(await visibleRows(anil)).toEqual({
				persons: 1,
				accounts: 2,
				batches: 1,
				ledgerLines: 1,
				cashFlows: 1,
				events: 1,
			});
			// Vikram sees Groww, which has no imports; Zerodha's rows stay hidden.
			expect(await visibleRows(vikram)).toEqual({
				persons: 1,
				accounts: 1,
				batches: 0,
				ledgerLines: 0,
				cashFlows: 0,
				events: 0,
			});
			expect(await visibleRows(stranger)).toEqual({
				persons: 0,
				accounts: 0,
				batches: 0,
				ledgerLines: 0,
				cashFlows: 0,
				events: 0,
			});
		});
	});

	describe("sharing one account", () => {
		it("View: sees that account only, and can change nothing", async () => {
			const vikram = await signUp();
			await anil.access.grant({
				target: { accountId: groww },
				email: vikram.email,
				level: "view",
			});

			expect(await levels(vikram)).toEqual({ [groww]: "view" });
			expect(await vikram.portfolio.listPersons()).toEqual([
				{ id: holderId, displayName: "Anil" },
			]);
			expect(await vikram.imports.list({ accountId: groww })).toEqual([]);

			await expect(vikram.imports.preview(ledger(groww))).rejects.toMatchObject(
				{ code: "FORBIDDEN" },
			);
			await expect(vikram.imports.apply(ledger(groww))).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
			await expect(
				vikram.access.list({ accountId: groww }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			// The sibling account stays invisible.
			await expect(
				vikram.imports.list({ accountId: zerodha }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("Edit: can upload and undo an upload, but cannot share or add accounts", async () => {
			const ramesh = await signUp();
			await anil.access.grant({
				target: { accountId: zerodha },
				email: ramesh.email,
				level: "edit",
			});

			const applied = await ramesh.imports.apply(ledger(zerodha));
			expect(applied.summary.classified).toBe(1);
			await ramesh.imports.retract({
				batchId: applied.batchId,
				reason: "wrong file",
			});
			// The owner sees the manager's work, attributed to the manager.
			const [batch] = await anil.imports.list({ accountId: zerodha });
			expect(batch?.status).toBe("retracted");
			const retraction = await db.events
				.where({ accountId: zerodha, kind: "retraction" })
				.take();
			expect(retraction.userId).toBe(ramesh.id);

			await expect(
				ramesh.access.grant({
					target: { accountId: zerodha },
					email: "someone@example.com",
					level: "view",
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				ramesh.portfolio.createAccount({
					personId: holderId,
					broker: "dhan",
					label: "Extra",
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("Owner of one account: can share that account, not the holder's others", async () => {
			const sunita = await signUp();
			const friend = await signUp();
			await anil.access.grant({
				target: { accountId: groww },
				email: sunita.email,
				level: "owner",
			});

			await sunita.access.grant({
				target: { accountId: groww },
				email: friend.email,
				level: "view",
			});
			expect(await levels(friend)).toEqual({ [groww]: "view" });

			await expect(
				sunita.access.grant({
					target: { personId: holderId },
					email: friend.email,
					level: "view",
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	});

	describe("sharing a holder", () => {
		it("covers every account the holder has, including ones added later", async () => {
			const sunita = await signUp();
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "view",
			});
			expect(await levels(sunita)).toEqual({
				[zerodha]: "view",
				[groww]: "view",
			});

			const dhan = (
				await anil.portfolio.createAccount({
					personId: holderId,
					broker: "dhan",
					label: "Anil Dhan",
				})
			).id;
			expect((await levels(sunita))[dhan]).toBe("view");
		});

		it("lets one account be raised above the holder-wide level", async () => {
			const sunita = await signUp();
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "view",
			});
			await anil.access.grant({
				target: { accountId: zerodha },
				email: sunita.email,
				level: "edit",
			});

			expect(await levels(sunita)).toEqual({
				[zerodha]: "edit",
				[groww]: "view",
			});
			// The account's access list shows both routes in.
			const entries = await anil.access.list({ accountId: zerodha });
			expect(
				entries
					.filter((e) => e.userId === sunita.id)
					.map((e) => [e.via, e.level]),
			).toEqual([
				["holder", "view"],
				["account", "edit"],
			]);
		});
	});

	describe("changing and removing access", () => {
		it("changes a level by granting again, keeping the old row as history", async () => {
			const ramesh = await signUp();
			const target = { accountId: zerodha };
			await anil.access.grant({ target, email: ramesh.email, level: "view" });
			await anil.access.grant({ target, email: ramesh.email, level: "edit" });

			expect(await levels(ramesh)).toEqual({ [zerodha]: "edit" });
			const rows = await db.accessGrants
				.where({ accountId: zerodha, userId: ramesh.id })
				.order({ createdAt: "ASC" })
				.select("level", "revokedAt", "revokedByUserId");
			expect(rows.map((r) => [r.level, r.revokedAt !== null])).toEqual([
				["view", true],
				["edit", false],
			]);
			expect(rows[0]?.revokedByUserId).toBe(anil.id);
		});

		it("removes access from the very next request", async () => {
			const ramesh = await signUp();
			const { grantId } = await anil.access.grant({
				target: { accountId: zerodha },
				email: ramesh.email,
				level: "edit",
			});
			expect(await levels(ramesh)).toEqual({ [zerodha]: "edit" });

			await anil.access.revoke({ grantId });

			expect(await ramesh.portfolio.listAccounts()).toEqual([]);
			await expect(ramesh.imports.apply(ledger(zerodha))).rejects.toMatchObject(
				{
					code: "NOT_FOUND",
				},
			);
		});

		it("never leaves a holder without an owner", async () => {
			const [mine] = await anil.access.list({ personId: holderId });
			if (!mine) throw new Error("expected the creator's grant");

			await expect(
				anil.access.revoke({ grantId: mine.grantId }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				anil.access.grant({
					target: { personId: holderId },
					email: anil.email,
					level: "view",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			// With a second owner in place, the first can step back.
			const sunita = await signUp();
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "owner",
			});
			await anil.access.revoke({ grantId: mine.grantId });

			expect(await anil.portfolio.listAccounts()).toEqual([]);
			expect(await levels(sunita)).toEqual({
				[zerodha]: "owner",
				[groww]: "owner",
			});
		});
	});

	describe("invites", () => {
		it("wait for a sign-in with that address, and only once it is verified", async () => {
			const invited = "new.manager@example.com";
			const result = await anil.access.grant({
				target: { accountId: zerodha },
				email: "New.Manager@Example.com",
				level: "edit",
			});
			expect(result.pending).toBe(true);
			expect(await anil.access.list({ accountId: zerodha })).toContainEqual(
				expect.objectContaining({
					email: invited,
					pending: true,
					level: "edit",
				}),
			);

			// Someone signs up with that address…
			const session = await createUserAndLogin({ email: invited });
			const who = { id: session.user.id, email: invited };
			// …but until the address is proven theirs, the invite does nothing.
			const unverified = await loadAccess({ ...who, emailVerified: false });
			expect(unverified.accountLevels.size).toBe(0);
			const verified = await loadAccess({ ...who, emailVerified: true });
			expect(verified.accountLevels.get(zerodha)).toBe("edit");
		});
	});

	describe("a fund manager with clients in two households", () => {
		it("sees each client's shared accounts in one login; the clients do not see each other", async () => {
			const mehta = await signUp();
			const mehtaHolder = (
				await mehta.portfolio.createPerson({ displayName: "Mehta" })
			).id;
			const mehtaAccount = (
				await mehta.portfolio.createAccount({
					personId: mehtaHolder,
					broker: "dhan",
					label: "Mehta Dhan",
				})
			).id;

			const ramesh = await signUp();
			await anil.access.grant({
				target: { accountId: zerodha },
				email: ramesh.email,
				level: "edit",
			});
			await mehta.access.grant({
				target: { accountId: mehtaAccount },
				email: ramesh.email,
				level: "view",
			});

			expect(await levels(ramesh)).toEqual({
				[zerodha]: "edit",
				[mehtaAccount]: "view",
			});
			expect(Object.keys(await levels(anil)).sort()).toEqual(
				[zerodha, groww].sort(),
			);
			expect(await levels(mehta)).toEqual({ [mehtaAccount]: "owner" });
		});
	});

	describe("saved groups", () => {
		it("are personal, and hold only accounts their owner can still see", async () => {
			const ramesh = await signUp();
			const { grantId } = await anil.access.grant({
				target: { accountId: zerodha },
				email: ramesh.email,
				level: "view",
			});

			const clients = await ramesh.portfolio.createGroup({ name: "Clients" });
			await ramesh.portfolio.setGroupMembers({
				groupId: clients.id,
				accountIds: [zerodha],
			});
			// Not an account he can see — so not one he can group.
			await expect(
				ramesh.portfolio.setGroupMembers({
					groupId: clients.id,
					accountIds: [zerodha, groww],
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			expect(await ramesh.portfolio.listGroups()).toEqual([
				{ id: clients.id, name: "Clients", accountIds: [zerodha] },
			]);
			// Anil has his own groups; Ramesh's are not among them.
			expect(await anil.portfolio.listGroups()).toEqual([]);

			// When access goes, the account drops out of the group.
			await anil.access.revoke({ grantId });
			expect(await ramesh.portfolio.listGroups()).toEqual([
				{ id: clients.id, name: "Clients", accountIds: [] },
			]);
		});
	});
});
