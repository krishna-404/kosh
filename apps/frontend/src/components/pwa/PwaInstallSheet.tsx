import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import {
	IconAlert,
	IconBolt,
	IconClose,
	IconInstall,
	IconPhone,
	IconShare,
} from "@connected-repo/ui-mui/kosh/icons";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Card } from "@connected-repo/ui-mui/layout/Card";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { usePwaInstallCtx } from "@frontend/components/notifications/PwaInstallHost";
import { isTest } from "@frontend/configs/env.config";
import { getDeviceEnv } from "@frontend/utils/device.utils";
import { notify } from "@frontend/utils/notify";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const TITLE = "Put Kosh on your home screen";

const DISMISS_KEY = "pwa.installSheetDismissedAt";
const DISMISS_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const isDismissedRecently = (): boolean => {
	if (typeof localStorage === "undefined") return false;
	const raw = localStorage.getItem(DISMISS_KEY);
	if (!raw) return false;
	const ts = Number.parseInt(raw, 10);
	if (Number.isNaN(ts)) return false;
	return Date.now() - ts < DISMISS_TTL_MS;
};

/**
 * Offers to install Kosh. A bottom sheet on a phone; a small card in the
 * corner on desktop, so it never blocks the page it appeared over.
 *
 * Opens by itself when either:
 *  - Chromium fired `beforeinstallprompt` (state.isInstallAvailable), or
 *  - the person is on iOS Safari (no native prompt exists, so we show the
 *    manual Add-to-Home-Screen steps).
 *
 * Dismissals are remembered for 3 days — it does not nag on every visit.
 * If Kosh is already running installed, this never renders.
 */
export const PwaInstallSheet = () => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("sm"));
	const pwa = usePwaInstallCtx();
	const device = getDeviceEnv();

	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);

	const canOffer = !isTest && !pwa.isStandalone && (pwa.isInstallAvailable || device.isIOS);

	useEffect(() => {
		if (!canOffer) {
			setOpen(false);
			return;
		}
		if (isDismissedRecently()) return;
		const t = window.setTimeout(() => setOpen(true), 1200);
		return () => window.clearTimeout(t);
	}, [canOffer]);

	if (!canOffer) return null;

	const remember = () => {
		try {
			localStorage.setItem(DISMISS_KEY, String(Date.now()));
		} catch {
			// Storage may be blocked (Safari private mode) — user just sees
			// the sheet again next session; not worth surfacing an error.
		}
	};

	const handleInstall = async () => {
		setPending(true);
		try {
			await pwa.install();
			remember();
			setOpen(false);
		} catch (error) {
			console.error("[PwaInstallSheet] install failed", error);
			notify("Couldn't open install prompt.");
		} finally {
			setPending(false);
		}
	};

	const handleClose = () => {
		remember();
		setOpen(false);
	};

	const iosSteps: { id: string; icon: ReactNode; text: ReactNode }[] = [
		{
			id: "share",
			icon: <IconShare />,
			text: (
				<>
					Tap the <strong>Share</strong> icon in Safari's toolbar.
				</>
			),
		},
		{
			id: "a2hs",
			icon: <IconPhone />,
			text: (
				<>
					Scroll down and choose <strong>Add to Home Screen</strong>.
				</>
			),
		},
	];

	const features: { id: string; icon: ReactNode; text: string }[] = [
		{
			id: "offline",
			icon: <IconBolt />,
			text: "Opens like an app — your money one tap away.",
		},
		{
			id: "fullscreen",
			icon: <IconPhone />,
			text: "Its own window and icon, no browser bars.",
		},
		{
			id: "notices",
			icon: <IconAlert />,
			text: "Can tell you when a question is waiting or something is shared with you.",
		},
	];

	const showIosGuide = device.isIOS && !pwa.isInstallAvailable;

	const lines = (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
			{(showIosGuide ? iosSteps : features).map((line, index) => (
				<Box key={line.id} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
					<SpotIcon size="sm">{line.icon}</SpotIcon>
					<Typography variant="body2" sx={{ color: "text.primary" }}>
						{showIosGuide && <b>{index + 1}. </b>}
						{line.text}
					</Typography>
				</Box>
			))}
		</Box>
	);

	const actions = (
		<>
			<Button variant="text" onClick={handleClose} disabled={pending}>
				Not now
			</Button>
			{!showIosGuide && (
				<Button
					variant="contained"
					startIcon={<IconInstall />}
					onClick={handleInstall}
					disabled={pending}
				>
					{pending ? "Opening…" : "Install"}
				</Button>
			)}
		</>
	);

	if (phone) {
		return (
			<ResponsiveDialog open={open} onClose={handleClose} title={TITLE} actions={actions}>
				{lines}
			</ResponsiveDialog>
		);
	}

	if (!open) return null;
	return (
		<Card
			role="dialog"
			aria-label={TITLE}
			sx={(t) => ({
				position: "fixed",
				right: 24,
				bottom: 24,
				zIndex: t.zIndex.snackbar,
				width: 380,
				p: 2.5,
				display: "flex",
				flexDirection: "column",
				gap: 2,
				boxShadow: t.vars.palette.kosh.shadowPop,
			})}
		>
			<Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
				<Typography variant="h3" component="h2" sx={{ flex: 1, pt: 1 }}>
					{TITLE}
				</Typography>
				<IconButton aria-label="Close" onClick={handleClose} sx={{ mr: -1, mt: -0.5 }}>
					<IconClose />
				</IconButton>
			</Box>
			{lines}
			<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>{actions}</Box>
		</Card>
	);
};
