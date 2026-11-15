import { activityRouter } from "@backend/modules/activity/activity.router";
import { cdnRouter } from "@backend/modules/cdn/cdn.user_app.router";
import { dividendsRouter } from "@backend/modules/dividends/dividends.router";
import { filesRouter } from "@backend/modules/files/files.router";
import { importsRouter } from "@backend/modules/imports/imports.router";
import { ledgerRouter } from "@backend/modules/ledger/ledger.router";
import { moneyRouter } from "@backend/modules/metrics/money.router";
import { notificationsRouter } from "@backend/modules/notifications/notifications.router";
import { accessRouter } from "@backend/modules/portfolio/access.router";
import { portfolioRouter } from "@backend/modules/portfolio/portfolio.router";
import { questionsRouter } from "@backend/modules/questions/questions.router";
import { meRouter } from "@backend/modules/users/me.user_app.router";
import { rpcPublicProcedure } from "@backend/procedures/public.procedure";
import type {
	InferRouterInputs,
	InferRouterOutputs,
	RouterClient,
} from "@orpc/server";
import { z } from "zod";

// Phase 1: Basic health check and testing endpoints
// Modules will be added in later phases

// Health check endpoint
const healthCheck = rpcPublicProcedure
	.route({ method: "GET", tags: ["Health Check"] })
	.output(
		z.object({
			status: z.string(),
			timestamp: z.string(),
			phase: z.number(),
			message: z.string(),
		}),
	)
	.handler(async () => {
		return {
			status: "ok",
			timestamp: new Date().toISOString(),
			phase: 1,
			message: "Phase 1: Core Infrastructure - oRPC server is running",
		};
	});

export const userAppRouter = {
	access: accessRouter,
	activity: activityRouter,
	cdn: cdnRouter,
	dividends: dividendsRouter,
	files: filesRouter,
	health: healthCheck,
	imports: importsRouter,
	ledger: ledgerRouter,
	me: meRouter,
	money: moneyRouter,
	notifications: notificationsRouter,
	portfolio: portfolioRouter,
	questions: questionsRouter,
};

export type UserAppRouter = RouterClient<typeof userAppRouter>;
export type UserAppRouterInputs = InferRouterInputs<typeof userAppRouter>;
export type UserAppRouterOutputs = InferRouterOutputs<typeof userAppRouter>;
