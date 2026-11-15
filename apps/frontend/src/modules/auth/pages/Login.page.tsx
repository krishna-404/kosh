import { GoogleIcon } from "@connected-repo/ui-mui/components/GoogleIcon";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconLock, IconPeople, IconTrend } from "@connected-repo/ui-mui/kosh/icons";
import { KoshWordmark } from "@connected-repo/ui-mui/kosh/KoshMark";
import { HeroCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Card } from "@connected-repo/ui-mui/layout/Card";
import { userCreateFixture } from "@connected-repo/zod-schemas/user.fixture";
import { AppVersionLabel } from "@frontend/components/AppVersionLabel";
import { env, isTest } from "@frontend/configs/env.config";
import { HOME } from "@frontend/copy/nav.copy";
import { authClient } from "@frontend/utils/auth.client";
import { getLastLogin } from "@frontend/utils/auth.persistence";
import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

const SIGN_IN_ERRORS: Record<string, string> = {
	oauth_failed: "Google couldn't sign you in. Try again.",
	state_mismatch: "That sign-in took too long and was cancelled. Try again.",
	callback_error: "Google couldn't finish signing you in. Try again.",
};

export const LoginPage = () => {
	const [isLoading, setIsLoading] = useState(false);
	const [searchParams] = useSearchParams();
	const error = searchParams.get("error");
	const lastLogin = getLastLogin();

	// Track OAuth errors in Sentry when they occur
	useEffect(() => {
		if (error) {
			const errorMessage = decodeURIComponent(error);
			
			// Capture OAuth error in Sentry for monitoring
			Sentry.captureMessage(`OAuth Error: ${errorMessage}`, {
				level: "warning",
				tags: {
					error_type: "oauth_error_frontend",
					error_code: error,
				},
				contexts: {
					auth: {
						error_message: errorMessage,
						location: "login_page",
					},
				},
			});
		}
	}, [error]);

   const handleGoogleLogin = async () => {
    setIsLoading(true);
 		let data: { url?: string } | undefined;
		// Same-origin deploys leave VITE_USER_APP_URL empty; fall back to the
		// visible origin so OAuth callbacks land on the frontend domain.
		const appOrigin = env.VITE_USER_APP_URL || window.location.origin;
		const callbackURL = `${appOrigin}${HOME}`;
		
    try {
			if(isTest){
				const dummyUser = userCreateFixture();
				const password = env.VITE_TEST_PASSWORD;
				const email = dummyUser.email ?? "test@example.com";
				if(!password){
					throw new Error("Test password is not set in environment variables");
				}

				await authClient.signUp.email({
					...dummyUser,
					email,
					image: dummyUser.image ?? undefined,
					password,
					callbackURL
				}, {
					throw: true
				});

				await authClient.signIn.email({
					email,
					password,
					rememberMe: true,
					callbackURL,
				}, {
					throw: true
				});
				// Email/password sign-in does NOT return a redirect URL — it
				// just sets the session cookie. Navigate manually so the
				// Playwright e2e globalSetup's `waitForURL` on the home page
				// resolves instead of timing out on the login page.
				window.location.href = callbackURL;
				return;
			} else {
				data = await authClient.signIn.social({
					provider: 'google',
					callbackURL,
					errorCallbackURL: `${appOrigin}/auth/error`,
					// newUserCallbackURL: "/welcome",
					disableRedirect: true,
				}, {
					throw: true,
				});
			}
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      setIsLoading(false);
    }
  };

	return (
		<Box
			sx={{
				minHeight: "100dvh",
				display: "grid",
				gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
				gap: { xs: 2, md: 3 },
				alignItems: "stretch",
				maxWidth: 1080,
				mx: "auto",
				p: { xs: 2, md: 4 },
			}}
		>
			<HeroCard
				sx={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					gap: 4,
					p: { xs: 3, md: 5 },
				}}
			>
				<KoshWordmark />
				<Box>
					<Typography variant="h1" component="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
						Your family's money, in one place.
					</Typography>
					<Typography sx={{ mt: 1.5, color: "text.secondary", maxWidth: 420 }}>
						Every broker account side by side, with the return your money really earned — and what
						the same money would have made in NIFTY 50 or gold.
					</Typography>
				</Box>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					<Point icon={<IconTrend />}>
						True returns: every deposit and withdrawal counted, on the day it happened.
					</Point>
					<Point icon={<IconPeople />}>
						Each person signs in as themselves and sees only what is shared with them.
					</Point>
					<Point icon={<IconLock />}>
						You decide who can view or edit each account, one account at a time.
					</Point>
				</Box>
			</HeroCard>

			<Card
				sx={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					gap: 2.5,
					p: { xs: 3, md: 5 },
				}}
			>
				<Box>
					<Typography variant="h1" component="h2">
						{lastLogin ? "Welcome back" : "Sign in to Kosh"}
					</Typography>
					<Typography color="text.secondary" sx={{ mt: 0.75 }}>
						{lastLogin
							? "Carry on where you left off."
							: "Use the Google account people will share with."}
					</Typography>
				</Box>

				{error && <Banner tone="bad">{SIGN_IN_ERRORS[error] ?? "Sign-in didn't work. Try again."}</Banner>}

				{lastLogin && (
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<HolderAvatar name={lastLogin.name} colorKey={lastLogin.email} />
						<Box sx={{ minWidth: 0 }}>
							<Typography variant="subtitle2" noWrap>
								{lastLogin.name}
							</Typography>
							<Typography variant="caption" component="div" noWrap>
								{lastLogin.email}
							</Typography>
						</Box>
					</Box>
				)}

				<Button
					variant="outlined"
					size="large"
					fullWidth
					onClick={handleGoogleLogin}
					disabled={isLoading}
					startIcon={<GoogleIcon width={20} height={20} />}
				>
					{isLoading ? "Connecting…" : "Continue with Google"}
				</Button>

				<Box>
					<Typography variant="caption" component="p">
						Kosh never asks for your broker password or an OTP. You bring statements in yourself.
					</Typography>
					<AppVersionLabel align="left" />
				</Box>
			</Card>
		</Box>
	);
};

const Point = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
	<Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", "& svg": { fontSize: 20, mt: "1px" } }}>
		{icon}
		<Typography variant="body2">{children}</Typography>
	</Box>
);
