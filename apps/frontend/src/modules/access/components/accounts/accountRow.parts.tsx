import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { DirectoryAccount } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ACCOUNTS } from "@frontend/copy/accounts.copy";
import { accountPath } from "@frontend/copy/nav.copy";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";

/**
 * The pieces every account row shares, so "You're an owner" and "Shared with
 * you" line up under one set of column captions on desktop.
 */

/** Money and return columns exist only once some account has a figure. */
export const hasMoney = (accounts: readonly DirectoryAccount[]): boolean =>
	accounts.some((a) => a.value !== null || a.xirr !== null);

/** Rupee total of what is known; null when nothing is. */
export const totalValue = (accounts: readonly DirectoryAccount[]): number | null => {
	const known = accounts.flatMap((a) => (a.value === null ? [] : [Number(a.value)]));
	return known.length > 0 ? known.reduce((sum, n) => sum + n, 0) : null;
};

/** Desktop: a grid shared with the caption row. Phone: a two-line flex row. */
const rowLayout = (withMoney: boolean) =>
	({
		display: { xs: "flex", md: "grid" },
		gridTemplateColumns: withMoney
			? "minmax(0,1fr) 108px 164px 108px 138px 88px"
			: "minmax(0,1fr) 130px 200px 88px",
		alignItems: "center",
		columnGap: 2,
		rowGap: 0,
	}) as const;

/** The captions above the cards. Desktop only; the cells speak for themselves on a phone. */
export const ColumnCaptions = ({ withMoney }: { withMoney: boolean }) => (
	<Box
		aria-hidden
		sx={[
			rowLayout(withMoney),
			(theme) => ({
				display: { xs: "none", md: "grid" },
				px: 2.5,
				mb: -1,
				color: theme.vars.palette.kosh.ink3,
				fontSize: "0.71875rem",
				fontWeight: 700,
				letterSpacing: "0.06em",
				textTransform: "uppercase",
			}),
		]}
	>
		<div>{ACCOUNTS.columns.account}</div>
		{withMoney && (
			<>
				<Box sx={{ textAlign: "right" }}>{ACCOUNTS.columns.value}</Box>
				<Box sx={{ textAlign: "right" }}>{ACCOUNTS.columns.returns}</Box>
			</>
		)}
		<div>{ACCOUNTS.columns.you}</div>
		<div>{ACCOUNTS.columns.access}</div>
		<div />
	</Box>
);

/**
 * The account's name as a link whose target covers the whole row. Buttons in
 * the row sit above it (`raised`), so the row opens the account and the
 * buttons still do their own thing — without a button inside a link.
 */
export const RowLink = ({ account }: { account: DirectoryAccount }) => (
	<Box
		component={RouterLink}
		to={accountPath(account.id)}
		sx={(theme) => ({
			display: "block",
			overflow: "hidden",
			textOverflow: "ellipsis",
			// A phone has room for two lines but not for a long name on one.
			whiteSpace: { xs: "normal", md: "nowrap" },
			overflowWrap: "anywhere",
			color: "inherit",
			fontWeight: 700,
			textDecoration: "none",
			outline: "none",
			"&::after": { content: '""', position: "absolute", inset: 0 },
			"&:focus-visible::after": {
				outline: `2px solid ${theme.vars.palette.kosh.accent}`,
				outlineOffset: -2,
				borderRadius: "inherit",
			},
		})}
	>
		{account.label}
	</Box>
);

/** Lifts a control above the row's link. */
export const raised = { position: "relative", zIndex: 1 } as const;

/** One account row: a list item laid out on the shared grid, tinted on hover. */
export const AccountRowShell = ({
	withMoney,
	children,
}: {
	withMoney: boolean;
	children: ReactNode;
}) => (
	<Box
		component="li"
		sx={[
			rowLayout(withMoney),
			(theme) => ({
				position: "relative",
				minHeight: { xs: 64, md: 60 },
				px: { xs: 2, md: 2.5 },
				py: 1.25,
				transition: theme.transitions.create("background-color", { duration: 200 }),
				"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
			}),
		]}
	>
		{children}
	</Box>
);

/** A card's rows: a real list, with a hairline between rows. */
export const AccountRows = ({ children }: { children: ReactNode }) => (
	<Box
		component="ul"
		sx={(theme) => ({
			listStyle: "none",
			m: 0,
			p: 0,
			"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
		})}
	>
		{children}
	</Box>
);

/** The value and return cells (desktop). */
export const MoneyCells = ({ account }: { account: DirectoryAccount }) => (
	<>
		<Box sx={{ display: { xs: "none", md: "block" }, textAlign: "right", fontWeight: 700 }}>
			<Money value={account.value} />
		</Box>
		<Box sx={{ display: { xs: "none", md: "block" }, textAlign: "right" }}>
			<Box sx={{ fontWeight: 700 }}>
				<ReturnFigure account={account} />
			</Box>
			{account.benchmarkXirr !== null && (
				<Typography variant="caption" component="div" noWrap>
					{ACCOUNTS.nifty} <Percent value={account.benchmarkXirr} />
				</Typography>
			)}
		</Box>
	</>
);

/** The return, green when it is ahead of the same money in NIFTY. */
const ReturnFigure = ({ account }: { account: DirectoryAccount }) => (
	<Percent
		value={account.xirr}
		tone={
			account.xirr !== null &&
			account.benchmarkXirr !== null &&
			account.xirr >= account.benchmarkXirr
				? "pos"
				: "plain"
		}
	/>
);

/** Phone: the return and NIFTY, in the quiet second line. Null when there is none. */
export const phoneReturn = (account: DirectoryAccount): ReactNode =>
	account.xirr === null ? null : (
		<>
			<Box component="span" sx={{ fontWeight: 700 }}>
				<ReturnFigure account={account} />
			</Box>
			{account.benchmarkXirr !== null && (
				<>
					{" · NIFTY "}
					<Percent value={account.benchmarkXirr} />
				</>
			)}
		</>
	);
