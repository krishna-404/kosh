import { Box } from "@connected-repo/ui-mui/layout/Box";

/**
 * The drawn radio mark from the design's menus and choice rows: a ring, filled
 * green when chosen. Decoration only — the element around it carries the
 * role and the checked state.
 */
export const RadioMark = ({ on }: { on: boolean }) => (
	<Box
		aria-hidden
		sx={(theme) => {
			const k = theme.vars.palette.kosh;
			return {
				width: 22,
				height: 22,
				flex: "none",
				mt: "1px",
				borderRadius: "50%",
				border: `2px solid ${on ? k.accent : k.ink3}`,
				bgcolor: on ? k.accent : k.surface,
				boxShadow: on ? `inset 0 0 0 4px ${k.surface}` : "none",
				transition: theme.transitions.create(["background-color", "border-color"], {
					duration: 200,
				}),
			};
		}}
	/>
);
