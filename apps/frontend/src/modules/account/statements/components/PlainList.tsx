import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { ReactNode } from "react";

/** Rows with a hairline between them, as a real list (`<ul>` of `<li>`). */
export const PlainList = ({ children }: { children: ReactNode }) => (
	<Box
		component="ul"
		sx={(theme) => ({
			m: 0,
			p: 0,
			listStyle: "none",
			"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
		})}
	>
		{children}
	</Box>
);
