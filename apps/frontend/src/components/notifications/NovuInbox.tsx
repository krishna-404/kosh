import { useLiteralPalette, useThemeMode } from "@connected-repo/ui-mui/theme/ThemeProvider";
import { useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { env } from "@frontend/configs/env.config";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { inboxDarkTheme } from "@novu/js/themes";
import { Inbox } from "@novu/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";

export const NovuInbox = () => {
	const navigate = useNavigate();
	const theme = useTheme();
	const { actualMode } = useThemeMode();
	// Novu needs literal colour values, not CSS variables.
	const palette = useLiteralPalette();

	const { data: creds } = useQuery({
		...orpc.notifications.inboxCredentials.queryOptions({}),
		staleTime: Number.POSITIVE_INFINITY,
	});

	if (!env.VITE_NOVU_APP_IDENTIFIER || !env.VITE_NOVU_API_URL || !env.VITE_NOVU_SOCKET_URL) return null;
	if (!creds) return null;

	return (
		<Inbox
			applicationIdentifier={env.VITE_NOVU_APP_IDENTIFIER}
			subscriberId={creds.subscriberId}
			subscriberHash={creds.subscriberHash}
			backendUrl={env.VITE_NOVU_API_URL}
			socketUrl={env.VITE_NOVU_SOCKET_URL}
			routerPush={(path: string) => navigate(path)}
			appearance={{
				baseTheme: actualMode === "dark" ? inboxDarkTheme : undefined,
				variables: {
					colorPrimary: palette.primary.main,
					colorPrimaryForeground: palette.primary.contrastText,
					colorSecondary: palette.action.hover,
					colorSecondaryForeground: palette.text.primary,
					colorBackground: palette.background.paper,
					colorForeground: palette.text.primary,
					colorNeutral: palette.divider,
					fontSize: `${theme.typography.fontSize}px`,
				},
			}}
		/>
	);
};
