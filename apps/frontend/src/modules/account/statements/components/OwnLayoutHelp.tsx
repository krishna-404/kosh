import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { IconDownload } from "@connected-repo/ui-mui/kosh/icons";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { UPLOAD } from "@frontend/copy/statements.copy";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/** Hand a small text file to the browser to save. */
const saveText = (fileName: string, text: string): void => {
	const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};

interface OwnLayoutHelpProps {
	/** Said when Kosh has no reader for this account's broker: the layout is then the way in. */
	lead?: string;
}

/**
 * Kosh's own layout: two small tables anyone can fill in from any broker's
 * statement and upload like any other file. The examples come from the
 * server, which reads them back itself — so they cannot drift from what it accepts.
 */
export const OwnLayoutHelp = ({ lead }: OwnLayoutHelpProps) => {
	const snack = useSnack();
	const queryClient = useQueryClient();
	const [busy, setBusy] = useState(false);

	const download = async (which: "trades" | "cash") => {
		setBusy(true);
		try {
			const layouts = await queryClient.fetchQuery({ ...orpc.imports.layouts.queryOptions(), staleTime: Number.POSITIVE_INFINITY });
			saveText(which === "trades" ? UPLOAD.ownLayout.tradesFile : UPLOAD.ownLayout.cashFile, layouts[which]);
		} catch {
			snack(UPLOAD.ownLayout.failed);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
			{lead && (
				<Typography variant="subtitle2" component="div">
					{lead}
				</Typography>
			)}
			<Typography variant="body2" sx={{ color: "text.secondary" }}>
				{UPLOAD.ownLayout.body}
			</Typography>
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
				<Button variant="outlined" size="small" startIcon={<IconDownload />} disabled={busy} onClick={() => void download("trades")}>
					{UPLOAD.ownLayout.trades}
				</Button>
				<Button variant="outlined" size="small" startIcon={<IconDownload />} disabled={busy} onClick={() => void download("cash")}>
					{UPLOAD.ownLayout.cash}
				</Button>
			</Box>
		</Box>
	);
};
