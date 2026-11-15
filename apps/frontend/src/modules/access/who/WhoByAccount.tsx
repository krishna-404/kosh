import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { ButtonBase } from "@connected-repo/ui-mui/form/ButtonBase";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconAddPerson, IconHolderWide } from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { RowItem, RowList } from "@connected-repo/ui-mui/kosh/RowItem";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { AccessMatrix } from "@connected-repo/zod-schemas/kosh/people.zod";
import { WHO } from "@frontend/copy/who.copy";
import { brokerNameOf, firstNameOf, possessive } from "@frontend/modules/access/people.utils";
import { PersonAvatar } from "./PersonAvatar";
import { rowLines } from "./rowLines";
import { allAccounts, nameOf, peopleOnAccount, type ShareTarget } from "./who.utils";

interface WhoByAccountProps {
	matrix: AccessMatrix;
	unconfirmed: ReadonlySet<string>;
	/** The chosen account; falls back to the first one. */
	accountId: string | null;
	onPick: (accountId: string) => void;
	onShare: (target: ShareTarget) => void;
	phone: boolean;
	/** Not enough width for the accounts and the people side by side: pick with chips instead. */
	compact: boolean;
}

/**
 * "By account": pick one account and see everyone on it — their level, and
 * whether it comes from the account alone or from all of its holder's accounts.
 */
export const WhoByAccount = ({
	matrix,
	unconfirmed,
	accountId,
	onPick,
	onShare,
	phone,
	compact,
}: WhoByAccountProps) => {
	const accounts = allAccounts(matrix.holders);
	const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
	const holder = matrix.holders.find((h) => h.accounts.some((a) => a.id === account?.id));
	if (!account || !holder) return null;

	const people = peopleOnAccount(matrix, account.id, unconfirmed);
	const whose = possessive(firstNameOf(holder.displayName));

	const list = (
		<RowList sx={(theme) => rowLines(theme.vars.palette.kosh.line)}>
			{people.map(({ person, seen }) => {
				const viaHolder = seen.via === "holder";
				const changeable = !person.isMe && (!viaHolder || holder.ownsHolder);
				return (
					<RowItem
						key={person.key}
						leading={<PersonAvatar person={person} />}
						primary={person.isMe ? WHO.you : nameOf(person)}
						secondary={
							viaHolder || person.pending ? (
								<Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
									{person.pending && (
										<Box
											component="span"
											sx={(theme) => ({ color: theme.vars.palette.kosh.sunText, fontWeight: 600 })}
										>
											{WHO.invitedNotSignedIn}
											{viaHolder && " ·"}
										</Box>
									)}
									{viaHolder && (
										<>
											<Box
												component="span"
												aria-hidden
												sx={{ display: "flex", "& svg": { fontSize: 14 } }}
											>
												<IconHolderWide />
											</Box>
											{WHO.allOf(whose)}
										</>
									)}
								</Box>
							) : undefined
						}
						trailing={<LevelBadge level={seen.level} />}
						onClick={
							changeable
								? () => onShare(viaHolder ? { personId: holder.id } : { accountId: account.id })
								: undefined
						}
					/>
				);
			})}
		</RowList>
	);

	const invite = (
		<Button
			variant="contained"
			size={phone ? "large" : "medium"}
			fullWidth={phone}
			startIcon={<IconAddPerson />}
			onClick={() => onShare({ accountId: account.id })}
			sx={{ whiteSpace: "normal", py: 1, alignSelf: phone ? undefined : "flex-start" }}
		>
			{WHO.inviteTo(account.label)}
		</Button>
	);

	if (compact)
		return (
			<>
				<FilterChips
					ariaLabel={WHO.pickAccount}
					value={account.id}
					onChange={onPick}
					options={accounts.map((a) => ({ value: a.id, label: a.label }))}
					sx={{ mx: -2, px: 2 }}
				/>
				<SectionCard padding="none" sx={{ overflow: "hidden" }}>
					{list}
				</SectionCard>
				{invite}
			</>
		);

	return (
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)",
				gap: 2.5,
				alignItems: "start",
			}}
		>
			<SectionCard padding="none" component="nav" sx={{ overflow: "hidden" }}>
				<Box aria-label={WHO.accountsLabel} role="group">
					{matrix.holders.map((h) => (
						<Box key={h.id}>
							<Box
								sx={(theme) => ({
									display: "flex",
									alignItems: "center",
									gap: 1,
									px: 2,
									py: 1.25,
									bgcolor: theme.vars.palette.kosh.surface2,
								})}
							>
								<HolderAvatar name={h.displayName} colorKey={h.id} kind={h.kind} size="xs" />
								<Typography variant="subtitle2" noWrap>
									{h.displayName}
								</Typography>
							</Box>
							{h.accounts.map((a) => {
								const on = a.id === account.id;
								const count = peopleOnAccount(matrix, a.id, unconfirmed).length;
								return (
									<ButtonBase
										key={a.id}
										aria-pressed={on}
										onClick={() => onPick(a.id)}
										sx={(theme) => {
											const k = theme.vars.palette.kosh;
											return {
												display: "flex",
												alignItems: "center",
												justifyContent: "flex-start",
												gap: 1.5,
												width: "100%",
												minHeight: 60,
												px: 2,
												py: 1,
												textAlign: "left",
												borderTop: `1px solid ${k.line}`,
												// Chosen: a green bar at the edge, as well as the tint.
												boxShadow: on ? `inset 3px 0 0 ${k.accent}` : "none",
												bgcolor: on ? k.accentSoft : "transparent",
												transition: theme.transitions.create("background-color", { duration: 200 }),
												"&:hover": { bgcolor: on ? k.accentSoft : k.surface2 },
											};
										}}
									>
										<BrokerMark broker={brokerNameOf(a)} size={34} />
										<Box sx={{ minWidth: 0 }}>
											<Typography variant="subtitle2" component="div" noWrap>
												{a.label}
											</Typography>
											<Typography variant="caption" component="div" noWrap>
												{`${brokerNameOf(a)} · ${WHO.peopleCount(count)}`}
											</Typography>
										</Box>
									</ButtonBase>
								);
							})}
						</Box>
					))}
				</Box>
			</SectionCard>

			<SectionCard padding="none" sx={{ overflow: "hidden" }}>
				<Box
					sx={{
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: 1.5,
						px: 2.5,
						pt: 2.5,
						pb: 1,
					}}
				>
					<Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
						<Typography variant="h3" component="h2">
							{account.label}
						</Typography>
						<Typography variant="body2">
							{WHO.heldBy(brokerNameOf(account), holder.displayName)}
						</Typography>
					</Box>
					{invite}
				</Box>
				<Box
					aria-label={WHO.peopleOn(account.label)}
					role="group"
					sx={(theme) => ({ borderTop: `1px solid ${theme.vars.palette.kosh.line}`, mt: 1 })}
				>
					{list}
				</Box>
			</SectionCard>
		</Box>
	);
};
