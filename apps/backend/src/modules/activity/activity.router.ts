import { listActivity } from "@backend/modules/portfolio/services/activity.portfolio.service";
import { rpcPortfolioProcedure } from "@backend/procedures/protected.procedure";
import {
	activityListInputZod,
	activityListZod,
} from "@connected-repo/zod-schemas/kosh/people.zod";

// Who did what, when — on accounts the caller can see. Read-only by nature.
const list = rpcPortfolioProcedure
	.input(activityListInputZod)
	.output(activityListZod)
	.handler(({ input, context: { user } }) => listActivity(user.id, input));

export const activityRouter = { list };
