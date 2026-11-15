/*
 * Copyright (c) 2025 Hexatech Hub Solutions LLP, India
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { LoadingSpinner } from "@connected-repo/ui-mui/components/LoadingSpinner";
import { SnackProvider, useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { KoshThemeProvider } from "@connected-repo/ui-mui/theme/ThemeProvider";
import { CustomErrorBoundary } from "@frontend/components/error_fallback";
import { BOTTOM_NAV_HEIGHT } from "@frontend/components/layout/PhoneBars";
import { PwaInstallHost } from "@frontend/components/notifications/PwaInstallHost";
import { router } from "@frontend/router";
import { bindNotifier } from "@frontend/utils/notify";
import { ErrorBoundary } from "@sentry/react";
import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router";

/** Connects `notify()` (usable outside React) to the snackbar. */
function NotifyBridge() {
	const snack = useSnack();
	useEffect(() => bindNotifier(snack), [snack]);
	return null;
}

// App focuses on rendering the router tree and error boundaries. Providers
// (QueryClient + oRPC client) are created and mounted at the root in
// `main.tsx` following the oRPC + TanStack React Query recommended setup.
function App() {
	return (
		<KoshThemeProvider>
			<SnackProvider phoneBottomOffset={BOTTOM_NAV_HEIGHT}>
				<NotifyBridge />
				<Suspense fallback={<LoadingSpinner text="Loading..." />}>
					<ErrorBoundary
						fallback={<CustomErrorBoundary />}
						beforeCapture={(scope) => {
							scope.setTag("level", "top-level");
						}}
					>
						<PwaInstallHost>
							<RouterProvider router={router} />
						</PwaInstallHost>
					</ErrorBoundary>
				</Suspense>
			</SnackProvider>
		</KoshThemeProvider>
	);
}

export default App;
