import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { CustomErrorBoundary } from "@frontend/components/error_fallback";
import { AppShell } from "@frontend/components/layout/AppShell";
import { RootLayout } from "@frontend/components/layout/RootLayout";
import { HOME, ROUTES } from "@frontend/copy/nav.copy";
import { authLoader } from "@frontend/utils/auth.loader";
import * as Sentry from "@sentry/react";
import { createBrowserRouter, type RouteObject, redirect } from "react-router";

type NavbarFields = {
	nb_icon?: string;
};

type BaseRouterWithNavbar = RouteObject & NavbarFields;
type ReactRouterWithNavbar = BaseRouterWithNavbar & {
	children?: ReactRouterWithNavbar[];
};

// HydrateFallback component for initial app loading
const HydrateFallback = () => (
	<Box
		sx={{
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			minHeight: "100vh",
			bgcolor: "background.default",
		}}
	>
		<LoadingSpinner size={48} />
	</Box>
);

// react-router `lazy` route property: the router awaits the chunk before
// swapping the page, so `useNavigation().state` is "loading" during the fetch
// (which drives the TopProgressBar) instead of React.lazy's blank-Suspense flash.
const lazyRoute = (importer: () => Promise<{ default: React.ComponentType }>) =>
	async () => {
		const mod = await importer();
		return { Component: mod.default };
	};

// The component gallery is a development and test aid, not a product page.
const kitRoute: ReactRouterWithNavbar[] =
	import.meta.env.MODE === "production"
		? []
		: [{ path: "kit", lazy: lazyRoute(() => import("@frontend/modules/kit/pages/Kit.page")) }];

const page = (path: string, importer: () => Promise<{ default: React.ComponentType }>) => ({
	path: path.replace(/^\//, ""),
	lazy: lazyRoute(importer),
});

// Signed-in development aids (inside the app shell), left out of production builds.
const devPages =
	import.meta.env.MODE === "production"
		? []
		: [
				page(
					"/kit/statements/:accountId",
					() => import("@frontend/modules/kit/pages/StatementsPreview.page"),
				),
			];

const routerObjectWithNavbar: ReactRouterWithNavbar[] = [
	{
		path: "/",
		Component: RootLayout,
		errorElement: <CustomErrorBoundary />,
		hydrateFallbackElement: <HydrateFallback />,
		children: [
			{ index: true, loader: () => redirect(HOME) },
			{
				path: "auth/*",
				lazy: lazyRoute(() => import("@frontend/modules/auth/auth.router")),
			},
			...kitRoute,
			// From the invite email, for someone who is not (and need not be) signed in.
			{
				path: "invite/:token/wrong-person",
				lazy: lazyRoute(() => import("@frontend/modules/invite/pages/WrongPerson.page")),
			},
			// Signed-in pages, inside the app shell.
			{
				element: <AppShell />,
				loader: authLoader,
				children: [
					page(ROUTES.overview, () => import("@frontend/modules/money/pages/Overview.page")),
					page(ROUTES.holdings, () => import("@frontend/modules/money/pages/Holdings.page")),
					page(
						`${ROUTES.holdings}/:instrumentId`,
						() => import("@frontend/modules/money/pages/Script.page"),
					),
					page(ROUTES.groups, () => import("@frontend/modules/groups/pages/Groups.page")),
					page(
						ROUTES.accounts,
						() => import("@frontend/modules/access/pages/AccountsAndPeople.page"),
					),
					page(
						`${ROUTES.accounts}/:accountId`,
						() => import("@frontend/modules/account/pages/Account.page"),
					),
					page("/invite/:token", () => import("@frontend/modules/invite/pages/Invite.page")),
					page(ROUTES.shared, () => import("@frontend/modules/access/pages/SharedWithMe.page")),
					page(ROUTES.access, () => import("@frontend/modules/access/pages/WhoCanSeeWhat.page")),
					page(ROUTES.activity, () => import("@frontend/modules/activity/pages/Activity.page")),
					page(ROUTES.profile, () => import("@frontend/modules/profile/pages/Profile.page")),
					...devPages,
				],
			},
			// Anything else — including bookmarks to pages that no longer
			// exist, such as the old /dashboard — goes home instead of a blank screen.
			{ path: "*", loader: () => redirect(HOME) },
		],
	},
];

// Call this AFTER Sentry.init()
const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV7(
  createBrowserRouter,
);

export const router = sentryCreateBrowserRouter(routerObjectWithNavbar);
