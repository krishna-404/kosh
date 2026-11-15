import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import { useEffect, useState } from "react";

/**
 * Persistent banner above the app header when the browser reports the
 * device as offline. Kosh is online-only — every figure is computed on the
 * server — so this just tells the user why nothing is loading. Cheap
 * wrapper around `navigator.onLine` + `online`/`offline` events.
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
		<Box
			role="status"
			sx={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 1,
				py: 0.75,
				px: 2,
				bgcolor: "warning.main",
				color: "warning.contrastText",
				position: "sticky",
				top: 0,
				zIndex: (t) => t.zIndex.appBar + 1,
			}}
		>
			<CloudOffIcon fontSize="small" />
			<Typography variant="body2" sx={{ fontWeight: 600 }}>
				You're offline. Kosh needs a connection — reconnect to continue.
			</Typography>
		</Box>
	);
};
