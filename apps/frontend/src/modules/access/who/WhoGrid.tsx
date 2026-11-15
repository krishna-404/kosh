import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { ButtonBase } from "@connected-repo/ui-mui/form/ButtonBase";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconChevronDown, IconClock, IconHolderWide } from "@connected-repo/ui-mui/kosh/icons";
import { LEVEL_LABEL, LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { WHO } from "@frontend/copy/who.copy";
import { firstNameOf, possessive } from "@frontend/modules/access/people.utils";
import type { ReactNode } from "react";
import { PersonAvatar } from "./PersonAvatar";
import {
	allAccounts,
	cellsFor,
	columnNames,
	type Entry,
	type HolderCells,
	type MatrixAccount,
	type MatrixHolder,
	type MatrixPerson,
	nameOf,
	type ShareTarget,
} from "./who.utils";

/** Column widths from the canvas: a wide column for the person, even ones for accounts. */
const PERSON_COLUMN = 240;
/** The least an account column can be and still hold "layers icon + level" in the last, padded one. */
const ACCOUNT_COLUMN = 168;
const CELL_HEIGHT = 44;
/** Marks the cells of the first column, which stays in place when the grid scrolls. */
const PERSON_CELL = "data-person-cell";
const personCell = { [PERSON_CELL]: "" };

/** Read out, not shown: what a span stands for where there is no room to write it. */
const srOnly = {
	position: "absolute",
	width: "1px",
	height: "1px",
	overflow: "hidden",
	clipPath: "inset(50%)",
	whiteSpace: "nowrap",
} as const;

interface WhoGridProps {
	holders: MatrixHolder[];
	/** The rows, already filtered. */
	people: MatrixPerson[];
	/** Accepted Owner invites still waiting for a confirm — worth "Can view" for now. */
	unconfirmed: ReadonlySet<string>;
	onShare: (target: ShareTarget) => void;
	onOpenPerson: (person: MatrixPerson) => void;
}

/**
 * The grid: one row per person, one column per account, grouped under the
 * account's holder. A dashed span is access to all of a holder's accounts.
 * A real table, so it reads row by row and scrolls sideways inside its card
 * when there are many accounts.
 */
export const WhoGrid = ({ holders, people, unconfirmed, onShare, onOpenPerson }: WhoGridProps) => {
	const accounts = allAccounts(holders);
	const showValues = accounts.some((a) => a.value !== null);

	return (
		<SectionCard padding="none" sx={{ overflow: "hidden" }}>
			<Box sx={{ overflowX: "auto" }}>
				<Box
					component="table"
					aria-label={WHO.gridLabel}
					sx={(theme) => {
						const k = theme.vars.palette.kosh;
						return {
							width: "100%",
							minWidth: PERSON_COLUMN + accounts.length * ACCOUNT_COLUMN,
							tableLayout: "fixed",
							borderCollapse: "separate",
							borderSpacing: 0,
							"& th, & td": { textAlign: "left", fontWeight: "inherit", verticalAlign: "middle" },
							// The person column stays put while the accounts scroll under it.
							"& thead th, & thead td": {
								bgcolor: k.surface2,
								paddingBlock: "14px 4px",
								paddingInline: "4px",
							},
							"& thead tr + tr th": { paddingBlock: "4px 12px" },
							"& tbody th, & tbody td": {
								height: 68,
								paddingBlock: "8px",
								paddingInline: "4px",
								borderTop: `1px solid ${k.line}`,
							},
							"& tbody th": { bgcolor: k.surface },
							"& tr > *:last-child": { paddingRight: "16px" },
							// The person column stays put while the accounts scroll under it.
							[`& [${PERSON_CELL}]`]: {
								position: "sticky",
								left: 0,
								zIndex: 2,
								paddingLeft: "16px",
								paddingRight: "12px",
							},
						};
					}}
				>
					<colgroup>
						<col style={{ width: PERSON_COLUMN }} />
						{accounts.map((account) => (
							<col key={account.id} />
						))}
					</colgroup>
					<thead>
						<tr>
							<td {...personCell} />
							{holders.map((holder) => (
								<th key={holder.id} scope="colgroup" colSpan={holder.accounts.length}>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
										<HolderAvatar
											name={holder.displayName}
											colorKey={holder.id}
											kind={holder.kind}
											size="xs"
										/>
										<Typography variant="subtitle2" component="span" noWrap>
											{holder.displayName}
										</Typography>
									</Box>
								</th>
							))}
						</tr>
						<tr>
							<th scope="col" {...personCell}>
								<ColumnName>{WHO.personColumn}</ColumnName>
							</th>
							{holders.flatMap((holder) => {
								const names = columnNames(holder);
								return holder.accounts.map((account, index) => (
									<th key={account.id} scope="col" title={account.label}>
										<ColumnName>
											{names[index]}
											{showValues && account.value !== null && (
												<>
													{" · "}
													<Money value={account.value} notation="compact" />
												</>
											)}
										</ColumnName>
									</th>
								));
							})}
						</tr>
					</thead>
					<tbody>
						{people.map((person) => (
							<PersonRow
								key={person.key}
								person={person}
								cells={cellsFor(person, holders, unconfirmed)}
								onShare={onShare}
								onOpenPerson={onOpenPerson}
							/>
						))}
					</tbody>
				</Box>
			</Box>
		</SectionCard>
	);
};

const ColumnName = ({ children }: { children: ReactNode }) => (
	<Typography variant="caption" component="div" noWrap sx={{ fontWeight: 700 }}>
		{children}
	</Typography>
);

interface PersonRowProps {
	person: MatrixPerson;
	cells: HolderCells[];
	onShare: (target: ShareTarget) => void;
	onOpenPerson: (person: MatrixPerson) => void;
}

const PersonRow = ({ person, cells, onShare, onOpenPerson }: PersonRowProps) => {
	const who = person.isMe ? WHO.you : nameOf(person);
	// "…incl. new ones" is said once per row, on the first span with room for it.
	const firstRoomy = person.isMe
		? undefined
		: cells.find((c) => c.wide && freeRun(c.accounts).length >= 2)?.holder.id;

	const face = (
		<>
			<PersonAvatar person={person} />
			<Box sx={{ minWidth: 0 }}>
				<Typography variant="subtitle2" component="div" noWrap title={who}>
					{who}
				</Typography>
				{person.pending ? (
					<Tag tone="pending" icon={<IconClock />} sx={{ mt: 0.25 }}>
						{WHO.invited}
					</Tag>
				) : (
					<Typography variant="caption" component="div" noWrap title={person.email}>
						{person.email}
					</Typography>
				)}
			</Box>
		</>
	);
	const faceSx = { display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 } as const;

	return (
		<tr>
			<th scope="row" {...personCell}>
				{person.isMe ? (
					<Box sx={faceSx}>{face}</Box>
				) : (
					<ButtonBase
						aria-label={WHO.openPerson(who)}
						onClick={() => onOpenPerson(person)}
						sx={[
							faceSx,
							(theme) => ({
								width: "calc(100% + 16px)",
								mx: "-8px",
								px: "8px",
								py: "6px",
								borderRadius: "12px",
								justifyContent: "flex-start",
								textAlign: "left",
								transition: theme.transitions.create("background-color", { duration: 200 }),
								"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
							}),
						]}
					>
						{face}
					</ButtonBase>
				)}
			</th>
			{cells.flatMap(({ holder, wide, accounts }) => {
				if (wide)
					return [
						<td key={holder.id} colSpan={holder.accounts.length}>
							<WideSpan
								holder={holder}
								wide={wide}
								accounts={accounts}
								who={who}
								isMe={person.isMe}
								inclNew={holder.id === firstRoomy}
								onShare={onShare}
							/>
						</td>,
					];
				return holder.accounts.map((account, index) => {
					const entry = accounts[index];
					return (
						<td key={account.id}>
							{entry ? (
								<AccountLevel
									account={account}
									entry={entry}
									who={who}
									plain={person.isMe}
									onShare={onShare}
									hover="surface2"
									sx={{ px: "8px" }}
								/>
							) : (
								<Box
									sx={(theme) => ({
										display: "flex",
										alignItems: "center",
										minHeight: CELL_HEIGHT,
										pl: "12px",
										color: theme.vars.palette.kosh.ink3,
										fontSize: "0.8125rem",
									})}
								>
									<span role="img" aria-label={WHO.noAccess}>
										—
									</span>
								</Box>
							)}
						</td>
					);
				});
			})}
		</tr>
	);
};

/** The longest stretch of a holder's columns with no entry of their own. */
const freeRun = (accounts: readonly (Entry | null)[]): { start: number; length: number } => {
	let best = { start: 0, length: 0 };
	let start = 0;
	accounts.forEach((entry, index) => {
		if (entry) {
			start = index + 1;
			return;
		}
		const length = index - start + 1;
		if (length > best.length) best = { start, length };
	});
	return best;
};

interface WideSpanProps {
	holder: MatrixHolder;
	wide: Entry;
	/** Entries on single accounts that are higher than the holder-wide one. */
	accounts: (Entry | null)[];
	who: string;
	isMe: boolean;
	inclNew: boolean;
	onShare: (target: ShareTarget) => void;
}

/**
 * Access to all of a holder's accounts: one dashed span across the holder's
 * columns. An account where the person has more than the span gives shows
 * its own, higher badge in its own column.
 */
const WideSpan = ({ holder, wide, accounts, who, isMe, inclNew, onShare }: WideSpanProps) => {
	const whose = possessive(firstNameOf(holder.displayName));
	const run = freeRun(accounts);
	const roomy = run.length >= 2;
	const canChange = holder.ownsHolder && !isMe;
	const label = WHO.changeHolder(who, whose, LEVEL_LABEL[wide.level]);

	const body = (
		<>
			<WideIcon />
			{run.length > 0 && <LevelBadge level={wide.level} />}
			{roomy ? (
				<Typography variant="caption" component="span" noWrap sx={{ minWidth: 0 }}>
					{inclNew ? WHO.allOfInclNew(whose) : WHO.allOf(whose)}
				</Typography>
			) : (
				!canChange && (
					<Box component="span" sx={srOnly}>
						{run.length > 0 ? WHO.allOf(whose) : `${WHO.allOf(whose)}: ${LEVEL_LABEL[wide.level]}`}
					</Box>
				)
			)}
			{roomy && canChange && (
				<Box
					component="span"
					aria-hidden
					sx={(theme) => ({
						display: "flex",
						ml: "auto",
						color: theme.vars.palette.kosh.ink3,
						"& svg": { fontSize: 18 },
					})}
				>
					<IconChevronDown />
				</Box>
			)}
		</>
	);
	const segmentSx = {
		// With every column taken by a higher badge, only the icon is left: it
		// sits in front of the first badge.
		gridColumn: run.length > 0 ? `${run.start + 1} / span ${run.length}` : "1",
		gridRow: 1,
		display: "flex",
		alignItems: "center",
		justifyContent: "flex-start",
		gap: "8px",
		minWidth: 0,
		minHeight: CELL_HEIGHT - 2,
		px: "11px",
		borderRadius: "11px",
		textAlign: "left",
		...(run.length === 0 ? { justifySelf: "start", position: "relative", zIndex: 1 } : {}),
	} as const;
	const hint = `${WHO.allOfAccounts(whose)}: ${LEVEL_LABEL[wide.level]}`;

	return (
		<Box
			title={holder.ownsHolder ? hint : `${hint}. ${WHO.notYoursToChange(whose)}`}
			sx={(theme) => ({
				// Holds the read-out-only text, so it scrolls (and is clipped) with the grid.
				position: "relative",
				display: "grid",
				gridTemplateColumns: `repeat(${holder.accounts.length}, minmax(0, 1fr))`,
				columnGap: "8px",
				alignItems: "center",
				minHeight: CELL_HEIGHT,
				borderRadius: "12px",
				bgcolor: theme.vars.palette.kosh.surface2,
				border: `1px dashed ${theme.vars.palette.kosh.line2}`,
			})}
		>
			{canChange ? (
				<ButtonBase
					aria-label={label}
					onClick={() => onShare({ personId: holder.id })}
					sx={[
						segmentSx,
						(theme) => ({
							transition: theme.transitions.create("background-color", { duration: 200 }),
							"&:hover": { bgcolor: theme.vars.palette.kosh.line },
						}),
					]}
				>
					{body}
				</ButtonBase>
			) : (
				<Box sx={segmentSx}>{body}</Box>
			)}
			{holder.accounts.map((account, index) => {
				const entry = accounts[index];
				if (!entry) return null;
				return (
					<AccountLevel
						key={account.id}
						account={account}
						entry={entry}
						who={who}
						plain={isMe}
						onShare={onShare}
						hover="line"
						sx={{
							gridColumn: index + 1,
							gridRow: 1,
							minHeight: CELL_HEIGHT - 2,
							// Leave the icon its place when it has no column of its own.
							pl: run.length === 0 && index === 0 ? "37px" : "8px",
							pr: "8px",
						}}
					/>
				);
			})}
		</Box>
	);
};

const WideIcon = () => (
	<Box
		component="span"
		aria-hidden
		sx={(theme) => ({
			display: "flex",
			flex: "none",
			color: theme.vars.palette.kosh.ink2,
			"& svg": { fontSize: 18 },
		})}
	>
		<IconHolderWide />
	</Box>
);

interface AccountLevelProps {
	account: MatrixAccount;
	entry: Entry;
	who: string;
	/** Shown without a way to change it (the signed-in person's own row). */
	plain: boolean;
	onShare: (target: ShareTarget) => void;
	/** The hover tint: one step darker than whatever the cell sits on. */
	hover: "surface2" | "line";
	sx?: Record<string, string | number>;
}

/** A level on one account. Every account in the grid is the viewer's to change. */
const AccountLevel = ({ account, entry, who, plain, onShare, hover, sx }: AccountLevelProps) => {
	const base = {
		display: "flex",
		alignItems: "center",
		justifyContent: "flex-start",
		width: "100%",
		minWidth: 0,
		minHeight: CELL_HEIGHT,
		borderRadius: "12px",
		...sx,
	} as const;
	if (plain)
		return (
			<Box sx={base}>
				<LevelBadge level={entry.level} />
			</Box>
		);
	return (
		<ButtonBase
			aria-label={WHO.changeAccount(who, account.label, LEVEL_LABEL[entry.level])}
			onClick={() => onShare({ accountId: account.id })}
			sx={[
				base,
				(theme) => ({
					transition: theme.transitions.create("background-color", { duration: 200 }),
					"&:hover": { bgcolor: theme.vars.palette.kosh[hover] },
				}),
			]}
		>
			<LevelBadge level={entry.level} />
		</ButtonBase>
	);
};
