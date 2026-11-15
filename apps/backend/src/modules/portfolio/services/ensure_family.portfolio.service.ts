import { db } from "@backend/db/db";

export const defaultFamilyName = (userName: string): string => {
	const firstName = userName.trim().split(/\s+/)[0];
	return firstName ? `${firstName}'s family` : "My family";
};

/**
 * The family a user belongs to. Read fresh from the row on every request —
 * NOT from the session — so it can never be stale behind better-auth's
 * cookie cache.
 *
 * `UserTable.afterCreate` gives every new user a family, so the create branch
 * only runs for a user row that arrived some other way (seed, manual insert).
 * It locks the user row so two concurrent first requests can't each mint one.
 */
export async function ensureFamilyId(userId: string): Promise<string> {
	const existing = await db.users.where({ id: userId }).get("familyId");
	if (existing) return existing;

	return db.$transaction(async () => {
		const user = await db.users
			.where({ id: userId })
			.select("familyId", "name")
			.forUpdate()
			.take();
		if (user.familyId) return user.familyId;

		const family = await db.families.create({
			name: defaultFamilyName(user.name),
		});
		await db.users.where({ id: userId }).update({ familyId: family.id });
		return family.id;
	});
}
