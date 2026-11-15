import { db } from "@backend/db/db";
import { rpcProtectedProcedure } from "@backend/procedures/protected.procedure";
import { userSelectAllZod } from "@connected-repo/zod-schemas/user.zod";

const profile = rpcProtectedProcedure
	.route({ method: "GET", tags: ["Me"] })
	.output(userSelectAllZod)
	.handler(
		async ({
			context: {
				user: { id: userId },
			},
		}) => {
			return await db.users.find(userId);
		},
	);

export const meRouter = {
	profile,
};
