import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconOffline } from "@connected-repo/ui-mui/kosh/icons";
import { useEffect, useState } from "react";

/**
 * Shown while the browser reports the device as offline. Kosh is
 * online-only — every figure is worked out on the server — so this simply
 * says why nothing is loading.
 */
export const OfflineBanner = () => {
	const [online, setOnline] = useState<boolean>(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);

	useEffect(() => {
		const on = () => setOnline(true);
		const off = () => setOnline(false);
		window.addEventListener("online", on);
		window.addEventListener("offline", off);
		return () => {
			window.removeEventListener("online", on);
			window.removeEventListener("offline", off);
		};
	}, []);

	if (online) return null;

	return (
		<Banner
			tone="warn"
			icon={<IconOffline fontSize="inherit" />}
			sx={{ borderRadius: 0, justifyContent: "center" }}
		>
			You're offline. Kosh needs a connection — it will carry on when you're back.
		</Banner>
	);
};
