/**
 * For a kit `RowList` whose rows are buttons: the hairline between rows.
 * The kit draws it with a selector a button's own reset outranks, so rows
 * that can be clicked lose their dividers; this names the button to win.
 *
 * Use: `<RowList sx={(theme) => rowLines(theme.vars.palette.kosh.line)}>`
 */
export const rowLines = (lineColor: string) => ({
	"& > * + button": { borderTop: `1px solid ${lineColor}` },
});
