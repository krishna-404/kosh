import { BaseTable } from "@backend/db/base_table";
import { db } from "@backend/db/db";
import {
	userCreatedEventDef,
	userDeletedEventDef,
} from "@backend/events/events.schema";
import { orchidToTbusQueryAdapter } from "@backend/events/events.utils";
import { tbus } from "@backend/events/tbus";
import { defaultFamilyName } from "@backend/modules/portfolio/services/ensure_family.portfolio.service";

export class UserTable extends BaseTable {
	readonly table = "users";

	columns = this.setColumns((t) => ({
		id: t.uuid().primaryKey().default(t.sql`gen_random_uuid()`),
		email: t.string().unique().nullable(),
		emailVerified: t.boolean().default(false),
		phoneNumber: t.string().unique().nullable(),
		phoneNumberVerified: t.boolean().default(false),
		name: t.string(),
		image: t.string().nullable(),
		timezone: t.string().default("Etc/UTC"),
		themeSetting: t.themeSettingEnum(),
		// The household this login belongs to — the tenant for every Kosh
		// row. Nullable only because better-auth inserts the user first and
		// the `afterCreate` hook below fills it in right after;
		// `ensureFamilyId` covers any row that slipped through.
		familyId: t
			.ulid()
			.foreignKey("families", "id", {
				onDelete: "RESTRICT",
				onUpdate: "RESTRICT",
			})
			.nullable(),
		...t.timestampsAsNumbers(),
	}));

	init() {
		// User creation goes through better-auth's adapter, so we can't
		// wrap the insert with a nested create. `afterCreate` is the
		// integration seam. It fires exactly once per insert.
		this.afterCreate(
			["email", "emailVerified", "id", "name"],
			async (users, queryCtx) => {
				await Promise.all(
					users.map(async (user) => {
						// 1. Give the user their family, so the first portfolio
						//    request after sign-up already has a tenant.
						const family = await db.families.create({
							name: defaultFamilyName(user.name),
						});
						await db.users
							.where({ id: user.id })
							.update({ familyId: family.id });

						// 2. Publish the user.created event once the email is
						//    verified (marketing / onboarding webhook fan-out).
						if (user.email && user.emailVerified) {
							const eventData = {
								userId: user.id,
								email: user.email,
								name: user.name,
							};
							return tbus.publish(userCreatedEventDef.from(eventData), {
								query: orchidToTbusQueryAdapter(queryCtx),
							});
						}
					}),
				);
			},
		);

		// Better-auth account deletion (or admin delete) removes the row here.
		// CASCADE handles push_devices etc. on our side; the event exists so the Novu subscriber gets deleted too
		// (see user_deleted.notifications.user.ts). Fires inside the same
		// transaction as the delete so a failed publish rolls the delete back.
		this.afterDelete(["id"], async (users, queryCtx) => {
			await Promise.all(
				users.map((user) =>
					tbus.publish(userDeletedEventDef.from({ userId: user.id }), {
						query: orchidToTbusQueryAdapter(queryCtx),
					}),
				),
			);
		});
	}
}
