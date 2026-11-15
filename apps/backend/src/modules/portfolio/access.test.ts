import { db } from "@backend/db/db";
import { requestContext } from "@backend/lib/request-context";
import { activityRouter } from "@backend/modules/activity/activity.router";
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
	activity: createRouterClient(activityRouter, { context }),
	imports: createRouterClient(importsRouter, { context }),
});
type Person = ReturnType<typeof as>;

/**
 * Another login whose email is verified — as every real (Google) login is —
 * so a grant links to it directly and an invite to its address is accepted.
 */
async function signUp(email?: string): Promise<Person> {
	const session = await createUserAndLogin(email ? { email } : {});
	await db.users.where({ id: session.user.id }).update({ emailVerified: true });
	session.user.emailVerified = true;
	return as(session);
}

/** What `who` sees: their level on each account. */

const LEDGER = [
	"particulars,posting_date,cost_center,voucher_type,debit,credit,net_balance",
	"Opening Balance,,,,,,0.000000",
	"Funds added using UPI ref1,2025-09-01,NSE-EQ - Z,Bank Receipts,0.000000,10000.000000,10000.000000",
	"Closing Balance,,,,,,10000.000000",
].join("\n");
const ledger = (accountId: string) => ({
	accountId,
	fileName: "ledger.csv",
	contentBase64: Buffer.from(LEDGER).toString("base64"),
});

const levels = async (who: Person) =>
	Object.fromEntries(
		(await who.portfolio.directory()).accounts.map((a) => [a.id, a.myLevel]),
	);

/** The holders `who` can see, by name. */
const holderNames = async (who: Person) =>
	(await who.portfolio.directory()).holders.map((h) => h.displayName);

/** Everyone listed on a target, as [who, level, route]. */
const peopleOn = async (
	owner: Person,
	target: { accountId: string } | { personId: string },
) => {
	const list = await owner.access.list(target);
	return [
		...list.holderWide.map((e) => [e.email, e.level, "holder"] as const),
		...list.direct.map((e) => [e.email, e.level, "account"] as const),
		...list.onAccounts.map((e) => [e.email, e.level, e.accountLabel] as const),
	];
};

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
		defaultContext.user.emailVerified = true;
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
			expect(await holderNames(anil)).toEqual(["Anil"]);
		});

		it("shows a stranger nothing and gives them nothing to attach to", async () => {
			const stranger = await signUp();

			const seen = await stranger.portfolio.directory();
			expect(seen.holders).toEqual([]);
			expect(seen.accounts).toEqual([]);
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
			await expect(anonymous.directory()).rejects.toThrow();
		});
	});

	describe("the safety net under every handler", () => {
		// Each account-scoped table filters itself to the caller's accounts, so
		// a handler that forgets to check still cannot read someone else's rows.
		const visibleRows = (user: Person) =>
			loadAccess({ id: user.id, email: user.email }).then(
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
			expect(await holderNames(vikram)).toEqual(["Anil"]);
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
			expect(applied.added).toBe(1);
			await ramesh.imports.undo({ batchId: applied.batchId, reason: "wrong file" });
			// The owner sees the manager's work, attributed to the manager.
			const [batch] = await anil.imports.list({ accountId: zerodha });
			expect(batch).toMatchObject({ status: "retracted", byMe: false, fileName: "ledger.csv" });
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
			const list = await anil.access.list({ accountId: zerodha });
			expect(list.holderWide.find((e) => e.userId === sunita.id)?.level).toBe("view");
			expect(list.direct.find((e) => e.userId === sunita.id)?.level).toBe("edit");
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

			expect(await levels(ramesh)).toEqual({});
			await expect(ramesh.imports.apply(ledger(zerodha))).rejects.toMatchObject(
				{
					code: "NOT_FOUND",
				},
			);
		});

		it("never leaves a holder without an owner", async () => {
			const [mine] = (await anil.access.list({ personId: holderId })).holderWide;
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

			expect(await levels(anil)).toEqual({});
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
			expect(await peopleOn(anil, { accountId: zerodha })).toContainEqual([
				invited,
				"edit",
				"account",
			]);

			// Someone signs up with that address…
			const session = await createUserAndLogin({ email: invited });
			const who = { id: session.user.id, email: invited };
			// …but until the address is proven theirs, the invite does nothing.
			const unverified = await loadAccess(who);
			expect(unverified.accountLevels.size).toBe(0);
			expect(await levels(as(session))).toEqual({});

			await db.users.where({ id: who.id }).update({ emailVerified: true });
			const verified = await loadAccess(who);
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

			const clients = await ramesh.portfolio.createGroup({
				name: "Clients",
				kind: "fund_manager",
				accountIds: [zerodha],
			});
			// Not an account he can see — so not one he can group.
			await expect(
				ramesh.portfolio.updateGroup({
					groupId: clients.id,
					accountIds: [zerodha, groww],
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			const groupsOf = async (who: Person) =>
				(await who.portfolio.listGroups()).map((g) => [g.name, g.kind, g.accountIds]);
			expect(await groupsOf(ramesh)).toEqual([["Clients", "fund_manager", [zerodha]]]);
			// Anil has his own groups; Ramesh's are not among them, nor his to touch.
			expect(await groupsOf(anil)).toEqual([]);
			await expect(
				anil.portfolio.deleteGroup({ groupId: clients.id }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			// Renaming and relabelling change nothing about who sees what.
			await ramesh.portfolio.updateGroup({
				groupId: clients.id,
				name: "Mehta household",
				kind: "family",
			});
			expect(await groupsOf(ramesh)).toEqual([["Mehta household", "family", [zerodha]]]);

			// When access goes, the account drops out of the group.
			await anil.access.revoke({ grantId });
			expect(await groupsOf(ramesh)).toEqual([["Mehta household", "family", []]]);

			await ramesh.portfolio.deleteGroup({ groupId: clients.id });
			expect(await groupsOf(ramesh)).toEqual([]);
		});
	});

	describe("holders", () => {
		it("can be a person with a login, one without, or an HUF — and one can be 'me'", async () => {
			await anil.portfolio.updatePerson({ personId: holderId, isMe: true });
			await anil.portfolio.createPerson({ displayName: "Kabir", kind: "no_login" });
			await anil.portfolio.createPerson({ displayName: "Anil Mehta HUF", kind: "huf" });

			const { holders } = await anil.portfolio.directory();
			expect(holders.map((h) => [h.displayName, h.kind, h.isMe, h.myLevel])).toEqual([
				["Anil", "login", true, "owner"],
				["Kabir", "no_login", false, "owner"],
				["Anil Mehta HUF", "huf", false, "owner"],
			]);
		});

		it("are renamed or relinked by owners only, and nobody unlinks someone else", async () => {
			const sunita = await signUp();
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "edit",
			});
			await expect(
				sunita.portfolio.updatePerson({ personId: holderId, displayName: "Mine" }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				sunita.portfolio.updateAccount({ accountId: zerodha, label: "Mine" }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });

			await anil.portfolio.updatePerson({ personId: holderId, isMe: true });
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "owner",
			});
			// A second owner may rename, but cannot say the holder is no longer Anil.
			await sunita.portfolio.updatePerson({ personId: holderId, displayName: "Anil Mehta" });
			await expect(
				sunita.portfolio.updatePerson({ personId: holderId, isMe: false }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			expect(await holderNames(anil)).toEqual(["Anil Mehta"]);
		});
	});

	describe("what each person is told about an account", () => {
		it("tells owners who else can see it, and everyone else only who shared it", async () => {
			const sunita = await signUp();
			const priya = await signUp();
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "view",
			});
			await anil.access.grant({
				target: { accountId: groww },
				email: priya.email,
				level: "view",
			});
			await anil.access.grant({
				target: { accountId: groww },
				email: "vikram@example.com",
				level: "view",
			});

			const mine = (await anil.portfolio.directory()).accounts;
			const summary = (id: string) => {
				const a = mine.find((x) => x.id === id)?.access;
				return a && [a.people.length, a.owners, a.invited];
			};
			expect(summary(zerodha)).toEqual([2, 1, 0]); // Anil and Sunita
			expect(summary(groww)).toEqual([3, 1, 1]); // …plus Priya, and one invite

			const hers = (await priya.portfolio.directory()).accounts;
			expect(hers).toHaveLength(1);
			expect(hers[0]).toMatchObject({
				id: groww,
				myLevel: "view",
				via: "account",
				access: null,
				sharedBy: { userId: anil.id },
				isNew: true,
			});
			const sunitas = (await sunita.portfolio.directory()).accounts;
			expect(sunitas.map((a) => [a.via, a.access])).toEqual([
				["holder", null],
				["holder", null],
			]);
		});

		it("lists, for an owner, every person across everything they own", async () => {
			const sunita = await signUp();
			const ramesh = await signUp();
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "view",
			});
			await anil.access.grant({
				target: { accountId: zerodha },
				email: ramesh.email,
				level: "edit",
			});

			const matrix = await anil.access.matrix();
			expect(matrix.holders.map((h) => [h.displayName, h.ownsHolder, h.accounts.length])).toEqual([
				["Anil", true, 2],
			]);
			expect(
				matrix.people.map((p) => [p.email, p.holders.map((h) => h.level), p.accounts.map((a) => a.level)]),
			).toEqual([
				[anil.email, ["owner"], []],
				[sunita.email, ["view"], []],
				[ramesh.email, [], ["edit"]],
			]);

			// Someone who owns nothing has nothing to see here.
			expect(await ramesh.access.matrix()).toEqual({ holders: [], people: [] });
		});
	});

	describe("the life of an invite", () => {
		const invite = (email: string, level: "view" | "edit" | "owner" = "view") =>
			anil.access.grant({ target: { accountId: zerodha }, email, level });

		it("is accepted the first time its address signs in, and then belongs to that login", async () => {
			await invite("ramesh@example.com", "edit");
			const ramesh = await signUp("ramesh@example.com");

			expect(await levels(ramesh)).toEqual({ [zerodha]: "edit" });
			const list = await anil.access.list({ accountId: zerodha });
			expect(list.direct.map((e) => [e.email, e.pending, e.userId])).toEqual([
				["ramesh@example.com", false, ramesh.id],
			]);
		});

		it("stops working after 14 days, until it is sent again", async () => {
			const { grantId } = await invite("late@example.com");
			await db.accessGrants.where({ id: grantId }).update({ expiresAt: Date.now() - 1000 });
			const [expired] = (await anil.access.list({ accountId: zerodha })).direct;
			expect(expired).toMatchObject({ pending: true, expired: true });

			const sent = await anil.access.resend({ grantId });
			expect(sent.grantId).not.toBe(grantId);
			const [fresh] = (await anil.access.list({ accountId: zerodha })).direct;
			expect(fresh).toMatchObject({ grantId: sent.grantId, pending: true, expired: false });

			const late = await signUp("late@example.com");
			expect(await levels(late)).toEqual({ [zerodha]: "view" });
		});

		it("gives nothing once it has run out", async () => {
			const { grantId } = await invite("gone@example.com");
			await db.accessGrants.where({ id: grantId }).update({ expiresAt: Date.now() - 1000 });
			const gone = await signUp("gone@example.com");
			expect(await levels(gone)).toEqual({});
		});

		it("can be cancelled before anyone signs in", async () => {
			const { grantId } = await invite("typo@gmial.com");
			await anil.access.revoke({ grantId });
			expect((await anil.access.list({ accountId: zerodha })).direct).toEqual([]);

			const stranger = await signUp("typo@gmial.com");
			expect(await levels(stranger)).toEqual({});
		});

		it("for Owner counts as View until an owner confirms who signed in", async () => {
			await invite("handover@example.com", "owner");
			const newcomer = await signUp("handover@example.com");

			expect(await levels(newcomer)).toEqual({ [zerodha]: "view" });
			await expect(
				newcomer.access.grant({
					target: { accountId: zerodha },
					email: "friend@example.com",
					level: "view",
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });

			const { toConfirm } = await anil.access.notices();
			expect(toConfirm.map((c) => [c.email, c.target.id])).toEqual([
				["handover@example.com", zerodha],
			]);
			const waiting = toConfirm[0];
			if (!waiting) throw new Error("expected an invite to confirm");
			// The newcomer cannot confirm themselves.
			await expect(
				newcomer.access.confirm({ grantId: waiting.grantId }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });

			await anil.access.confirm({ grantId: waiting.grantId });
			expect(await levels(newcomer)).toEqual({ [zerodha]: "owner" });
			expect((await anil.access.notices()).toConfirm).toEqual([]);
		});

		it("says what became of its link, and can be stopped by whoever received it", async () => {
			const { grantId } = await invite("ramesh@example.com");
			const token = await db.accessGrants.find(grantId).get("inviteToken");
			if (!token) throw new Error("expected an invite token");

			// Opened by someone signed in with another address.
			const other = await signUp();
			expect(await other.access.inviteStatus({ token })).toMatchObject({
				state: "other_email",
				maskedEmail: "r•••@example.com",
				myEmail: other.email,
			});
			expect(await levels(other)).toEqual({});

			// "This reached the wrong person" needs no sign-in and stops it at once.
			const anyone = createRouterClient(accessRouter, {
				context: { reqHeaders: new Headers() },
			});
			await anyone.reportWrong({ token });
			expect(await other.access.inviteStatus({ token })).toMatchObject({ state: "cancelled" });
			const ramesh = await signUp("ramesh@example.com");
			expect(await levels(ramesh)).toEqual({});

			expect(await other.access.inviteStatus({ token: "x".repeat(43) })).toMatchObject({
				state: "not_found",
				maskedEmail: null,
			});
		});
	});

	describe("sharing rules", () => {
		it("will not share one account with someone who already has as much on all of them", async () => {
			const sunita = await signUp();
			await anil.access.grant({
				target: { personId: holderId },
				email: sunita.email,
				level: "edit",
			});
			await expect(
				anil.access.grant({ target: { accountId: zerodha }, email: sunita.email, level: "view" }),
			).rejects.toMatchObject({ code: "CONFLICT" });
			// More on one account is a real change, and allowed.
			await anil.access.grant({ target: { accountId: zerodha }, email: sunita.email, level: "owner" });
			expect(await levels(sunita)).toEqual({ [zerodha]: "owner", [groww]: "edit" });
		});

		it("lets anyone leave, and nobody but an owner remove someone else", async () => {
			const ramesh = await signUp();
			const priya = await signUp();
			const mine = await anil.access.grant({
				target: { accountId: zerodha },
				email: ramesh.email,
				level: "edit",
			});
			const hers = await anil.access.grant({
				target: { accountId: zerodha },
				email: priya.email,
				level: "view",
			});

			await expect(ramesh.access.revoke({ grantId: hers.grantId })).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
			// The directory hands each person the id of their own access to leave with.
			const [his] = (await ramesh.portfolio.directory()).accounts;
			expect(his?.myGrantId).toBe(mine.grantId);
			await ramesh.access.revoke({ grantId: mine.grantId });
			expect(await levels(ramesh)).toEqual({});
			expect(await levels(priya)).toEqual({ [zerodha]: "view" });
		});
	});

	describe("being told, once", () => {
		it("about accounts newly shared with you", async () => {
			const ramesh = await signUp();
			await anil.access.grant({ target: { accountId: zerodha }, email: ramesh.email, level: "edit" });

			const { arrivals } = await ramesh.access.notices();
			expect(arrivals.map((a) => [a.sharedBy.userId, a.target.label, a.level])).toEqual([
				[anil.id, "Anil Zerodha", "edit"],
			]);
			// Your own additions are not news to you.
			expect((await anil.access.notices()).arrivals).toEqual([]);

			await ramesh.access.acknowledge({ arrivals: arrivals.map((a) => a.grantId) });
			expect((await ramesh.access.notices()).arrivals).toEqual([]);
			expect((await ramesh.portfolio.directory()).accounts[0]?.isNew).toBe(false);
		});

		it("about access you no longer have — by name, and then never again", async () => {
			const ramesh = await signUp();
			const { grantId } = await anil.access.grant({
				target: { accountId: zerodha },
				email: ramesh.email,
				level: "edit",
			});
			await anil.access.revoke({ grantId });

			const { lost } = await ramesh.access.notices();
			expect(lost.map((l) => [l.label, l.byName])).toEqual([["Anil Zerodha", expect.any(String)]]);
			// One person's notice is not another's to dismiss.
			await anil.access.acknowledge({ lost: [grantId] });
			expect((await ramesh.access.notices()).lost).toHaveLength(1);

			await ramesh.access.acknowledge({ lost: [grantId] });
			expect((await ramesh.access.notices()).lost).toEqual([]);
		});

		it("but not when you can still see it another way, or when you left", async () => {
			const sunita = await signUp();
			await anil.access.grant({ target: { personId: holderId }, email: sunita.email, level: "view" });
			const extra = await anil.access.grant({
				target: { accountId: zerodha },
				email: sunita.email,
				level: "edit",
			});
			await anil.access.revoke({ grantId: extra.grantId });
			expect((await sunita.access.notices()).lost).toEqual([]);

			const [onHolder] = (await anil.access.list({ personId: holderId })).holderWide.filter(
				(e) => e.userId === sunita.id,
			);
			if (!onHolder) throw new Error("expected Sunita on the holder");
			await sunita.access.revoke({ grantId: onHolder.grantId });
			expect((await sunita.access.notices()).lost).toEqual([]);
		});
	});

	describe("the activity record", () => {
		it("shows access changes to owners, and to others only what happened to them", async () => {
			const ramesh = await signUp();
			const priya = await signUp();
			await anil.access.grant({ target: { accountId: zerodha }, email: ramesh.email, level: "view" });
			await anil.access.grant({ target: { accountId: zerodha }, email: ramesh.email, level: "edit" });
			const hers = await anil.access.grant({
				target: { accountId: zerodha },
				email: priya.email,
				level: "view",
			});
			await anil.access.revoke({ grantId: hers.grantId });
			await anil.access.grant({ target: { accountId: zerodha }, email: "vikram@example.com", level: "view" });

			const kinds = async (who: Person) =>
				(await who.activity.list({})).items.map((i) => [i.kind, i.subject?.name ?? i.target?.label]);

			const owners = await kinds(anil);
			expect(owners).toEqual(
				expect.arrayContaining([
					["holder_added", "Anil"],
					["account_added", "Anil Zerodha"],
					["account_added", "Anil Groww"],
					["access_given", expect.any(String)],
					["level_changed", expect.any(String)],
					["removed", expect.any(String)],
					["invited", "vikram@example.com"],
				]),
			);

			// Ramesh can edit, but is not an owner: he sees the account, and his own access.
			const his = await ramesh.activity.list({});
			expect(his.items.map((i) => i.kind).sort()).toEqual(
				["access_given", "account_added", "level_changed"].sort(),
			);
			expect(his.items.every((i) => i.subject === null || i.subject.isMe)).toBe(true);

			// An invite reads as open only while nobody has used or stopped it.
			const invite = (await anil.activity.list({})).items.find((i) => i.kind === "invited");
			expect(invite).toMatchObject({ inviteOpen: true, actor: { key: anil.id, isMe: true } });

			const change = his.items.find((i) => i.kind === "level_changed");
			expect(change).toMatchObject({ fromLevel: "view", level: "edit", actor: { isMe: false } });

			// An account you cannot see has no activity to ask for.
			await expect(priya.activity.list({ accountId: zerodha })).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		});

		it("can be filtered and paged", async () => {
			const access = await anil.activity.list({ filter: "access" });
			expect(access.items.map((i) => i.kind)).toEqual(["holder_added"]);

			// Page by page, one entry at a time: every entry turns up exactly once,
			// even the ones recorded in the same instant.
			const all = (await anil.activity.list({})).items.map((i) => i.id);
			const paged: string[] = [];
			let before: string | undefined;
			do {
				const page = await anil.activity.list({ limit: 1, before });
				paged.push(...page.items.map((i) => i.id));
				before = page.nextBefore ?? undefined;
			} while (before);
			expect(paged).toEqual(all);
			expect(all.length).toBeGreaterThanOrEqual(3);

			// Read for one account, the record leaves out what is not about it.
			const forOne = await anil.activity.list({ accountId: zerodha });
			expect(forOne.items.map((i) => i.kind)).toEqual(["account_added"]);
		});
	});
});
