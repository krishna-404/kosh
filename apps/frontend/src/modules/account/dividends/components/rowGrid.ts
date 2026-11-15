/**
 * The columns a dividend's row and its year's heading share, so a year's
 * total sits exactly above the amounts it adds up.
 *
 * Desktop: script and facts · state · amount · what can be done.
 * Phone: script and amount on one line, the facts and the state beneath;
 * what can be done is one button at the right.
 *
 * Someone who cannot answer has no last column, so amounts run to the edge.
 */
export const rowGrid = (withActions: boolean) =>
	({
		display: "grid",
		alignItems: "center",
		columnGap: 1.5,
		px: { xs: 2, md: 2.5 },
		gridTemplateColumns: {
			xs: withActions ? "minmax(0, 1fr) auto 44px" : "minmax(0, 1fr) auto",
			md: withActions ? "minmax(0, 1fr) 140px 124px 148px" : "minmax(0, 1fr) 140px 124px",
		},
	}) as const;

/** Where each part of a dividend's row goes. */
export const rowAreas = (withActions: boolean) =>
	({
		gridTemplateAreas: {
			xs: withActions
				? `"name amount actions" "facts facts actions" "state state state"`
				: `"name amount" "facts facts" "state state"`,
			md: withActions
				? `"name state amount actions" "facts state amount actions"`
				: `"name state amount" "facts state amount"`,
		},
	}) as const;

/**
 * Where each part of a year's heading goes: its label takes the script's
 * place and its counts the facts'. On a phone the counts that wait are said
 * in that line, so there is no third row.
 */
export const headingAreas = (withActions: boolean) =>
	({
		gridTemplateAreas: {
			xs: withActions ? `"name amount actions" "facts facts actions"` : `"name amount" "facts facts"`,
			md: rowAreas(withActions).gridTemplateAreas.md,
		},
	}) as const;
