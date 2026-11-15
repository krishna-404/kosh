import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { IconEdit, IconHolderWide, IconMore } from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { accountPath } from "@frontend/copy/nav.copy";
import { SHARED } from "@frontend/copy/shared.copy";
import { brokerNameOf, firstNameOf, possessive } from "@frontend/modules/access/people.utils";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { SharedAccount } from "./shared.utils";

/** Which figure columns exist — only the ones at least one account has a number for. */
export interface MoneyColumns {
	value: boolean;
	returns: boolean;
}

interface SharedCardProps {
	/** A face or an icon for whoever (or whatever) the card is about. */
	leading: ReactNode;
	title: string;
	line: string;
	/** Something in it has not been looked at yet. */
	isNew?: boolean;
	rows: SharedAccount[];
	/** Say who shared each account on its own line (when the card is not about a sharer). */
	showSharer?: boolean;
	money: MoneyColumns;
	onMore: (row: SharedAccount, anchor: HTMLElement) => void;
}

/** One card of "Shared with me": who it is from, and the accounts as rows. */
export const SharedCard = ({
	leading,
	title,
	line,
	isNew = false,
	rows,
	showSharer = false,
	money,
	onMore,
}: SharedCardProps) => (
	<SectionCard padding="none" sx={{ overflow: "hidden" }}>
		<Box
			sx={(theme) => ({
				display: "flex",
				alignItems: "center",
				gap: 1.5,
				px: { xs: 2, md: 2.5 },
				py: 1.5,
				bgcolor: theme.vars.palette.kosh.surface2,
			})}
		>
			{leading}
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Typography variant="subtitle2" component="h2" noWrap>
					{title}
				</Typography>
				<Typography variant="caption" component="div" noWrap>
					{line}
				</Typography>
			</Box>
			{isNew && <Tag tone="new">{SHARED.isNew}</Tag>}
		</Box>
		<Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
			{rows.map((row) => (
				<SharedRow
					key={row.account.id}
					row={row}
					showSharer={showSharer}
					money={money}
					onMore={onMore}
				/>
			))}
		</Box>
	</SectionCard>
);

interface SharedRowProps {
	row: SharedAccount;
	showSharer: boolean;
	money: MoneyColumns;
	onMore: (row: SharedAccount, anchor: HTMLElement) => void;
}

/**
 * One shared account. The whole row opens the account; the "more" button
 * sits above that link. Columns on a wide screen, two lines on a narrow one.
 */
const SharedRow = ({ row, showSharer, money, onMore }: SharedRowProps) => {
	const { account, holder } = row;
	const holderName = holder?.displayName ?? "";
	// One line where there is room for the columns; two lines (name, then the rest) below that.
	const wide = "lg";
	const columns = [
		"minmax(0, 1fr)",
		...(money.value ? ["140px"] : []),
		...(money.returns ? ["96px"] : []),
		"124px",
		"140px",
		"44px",
	].join(" ");

	return (
		<Box
			component="li"
			sx={(theme) => {
				const k = theme.vars.palette.kosh;
				return {
					position: "relative",
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr) 44px",
					alignItems: "center",
					columnGap: 1,
					rowGap: 0.75,
					minHeight: 62,
					pl: 2,
					pr: 1,
					py: 1.25,
					borderTop: `1px solid ${k.line}`,
					transition: theme.transitions.create("background-color", { duration: 200 }),
					"&:hover": { bgcolor: k.surface2 },
					[theme.breakpoints.up(wide)]: {
						gridTemplateColumns: columns,
						columnGap: 2,
						pl: 2.5,
						pr: 1.5,
					},
				};
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
				<BrokerMark broker={brokerNameOf(account)} />
				<Box sx={{ minWidth: 0 }}>
					<Typography
						variant="subtitle2"
						noWrap
						component={Link}
						to={accountPath(account.id)}
						sx={(theme) => ({
							display: "block",
							color: "inherit",
							textDecoration: "none",
							outline: "none",
							// The link's hit area is the whole row.
							"&::after": { content: '""', position: "absolute", inset: 0 },
							"&:focus-visible::after": {
								outline: `2px solid ${theme.vars.palette.kosh.accent}`,
								outlineOffset: -2,
							},
						})}
					>
						{account.label}
					</Typography>
					<Typography
						variant="caption"
						component="div"
						noWrap
						sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
					>
						{account.via === "holder" && (
							<Box component="span" aria-hidden sx={{ display: "flex", "& svg": { fontSize: 14 } }}>
								<IconHolderWide />
							</Box>
						)}
						<Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
							{account.via === "holder"
								? SHARED.allOfAccounts(possessive(firstNameOf(holderName)))
								: holderName}
							{showSharer && ` · ${SHARED.fromFirstName(firstNameOf(account.sharedBy.name))}`}
						</Box>
					</Typography>
				</Box>
			</Box>

			{/* On a narrow screen these sit together on a second line, under the name. */}
			<Box
				sx={(theme) => ({
					gridColumn: 1,
					gridRow: 2,
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					gap: 1,
					pl: "50px",
					[theme.breakpoints.up(wide)]: { display: "contents" },
				})}
			>
				{money.value && (
					<Box
						sx={(theme) => ({
							order: 3,
							ml: "auto",
							[theme.breakpoints.up(wide)]: { order: 0, ml: 0, textAlign: "right" },
						})}
					>
						<Money value={account.value} sx={{ fontWeight: 700 }} />
					</Box>
				)}
				{money.returns && (
					<Box
						sx={(theme) => ({
							display: "none",
							[theme.breakpoints.up(wide)]: { display: "block", textAlign: "right" },
						})}
					>
						<Percent value={account.xirr} tone="auto" sx={{ fontWeight: 700 }} />
					</Box>
				)}
				<Box sx={{ display: "flex" }}>
					<LevelBadge level={account.myLevel} />
				</Box>
				<Box sx={{ display: "flex", minWidth: 0 }}>
					{account.questionsWaiting > 0 ? (
						<Tag tone="pending" icon={<IconEdit />}>
							{SHARED.questions(account.questionsWaiting)}
						</Tag>
					) : (
						<Typography variant="caption" noWrap>
							{account.myLevel === "view" ? SHARED.viewOnly : SHARED.nothingWaiting}
						</Typography>
					)}
				</Box>
			</Box>

			<IconButton
				aria-label={SHARED.more(account.label)}
				aria-haspopup="menu"
				onClick={(event) => onMore(row, event.currentTarget)}
				sx={(theme) => ({
					position: "relative",
					zIndex: 1,
					gridColumn: 2,
					gridRow: "1 / span 2",
					[theme.breakpoints.up(wide)]: { gridColumn: "auto", gridRow: "auto" },
				})}
			>
				<IconMore />
			</IconButton>
		</Box>
	);
};
