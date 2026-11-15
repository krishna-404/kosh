import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconGroup, IconHolderWide, IconInbox } from "@connected-repo/ui-mui/kosh/icons";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type { Directory } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ROUTES } from "@frontend/copy/nav.copy";
import { ARRIVAL } from "@frontend/copy/shared.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import {
	brokerNameOf,
	errorWords,
	firstNameOf,
	possessive,
} from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
	type Arrival,
	type ArrivalRow,
	arrivalSections,
	arrivedAccountIds,
	namesOf,
	sharedLastName,
} from "./shared.utils";

const LEVELS_LOW_TO_HIGH: readonly AccessLevel[] = ["view", "edit", "owner"];

interface ArrivalBlockProps {
	arrivals: Arrival[];
	directory: Directory;
}

/**
 * "N accounts were just shared with you": what arrived, from whom, what each
 * level means, and the offer to keep them together as a group.
 *
 * The arrival is marked as seen when the person saves the group, says "Not
 * now", or leaves the page — not on first paint, so they get to read it.
 */
export const ArrivalBlock = ({ arrivals, directory }: ArrivalBlockProps) => {
	const snack = useSnack();
	const navigate = useNavigate();
	const refresh = useRefreshPeople();
	const titleId = useId();
	const createGroup = useMutation(orpc.portfolio.createGroup.mutationOptions());

	const sections = arrivalSections(arrivals, directory);
	const accountIds = arrivedAccountIds(sections);
	const sharerNames = sections.map((s) => s.sharer.name);
	const family = sharedLastName(sharerNames);
	const levels = LEVELS_LOW_TO_HIGH.filter((level) =>
		sections.some((s) => s.rows.some((r) => r.level === level)),
	);

	const [name, setName] = useState(family ? ARRIVAL.household(family) : "");
	const [nameMissing, setNameMissing] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	// Marking as seen. The ids are kept in a ref so leaving the page can use
	// the latest ones; the timer undoes the mount → unmount → mount that
	// React's development mode performs, which is not the person leaving.
	const ids = useRef<string[]>([]);
	ids.current = arrivals.map((a) => a.grantId);
	const seen = useRef(false);
	const leaving = useRef<number | undefined>(undefined);
	const markSeen = useRef(async () => {
		if (seen.current || ids.current.length === 0) return;
		seen.current = true;
		try {
			await orpc.access.acknowledge.call({ arrivals: ids.current });
			await refresh();
		} catch {
			// Not marked: it is simply shown again next time.
			seen.current = false;
		}
	});
	useEffect(() => {
		window.clearTimeout(leaving.current);
		const mark = markSeen.current;
		return () => {
			leaving.current = window.setTimeout(() => void mark(), 0);
		};
	}, []);

	if (dismissed) return null;

	const dismiss = () => {
		setDismissed(true);
		void markSeen.current();
	};

	const saveGroup = (event: FormEvent) => {
		event.preventDefault();
		const groupName = name.trim();
		if (!groupName) {
			setNameMissing(true);
			return;
		}
		createGroup.mutate(
			{ name: groupName, kind: family ? "family" : null, accountIds },
			{
				onSuccess: () => {
					snack({
						message: ARRIVAL.saved(groupName),
						actionLabel: ARRIVAL.openGroups,
						onAction: () => navigate(ROUTES.groups),
					});
					dismiss();
				},
				onError: (error) => snack(errorWords(error, ARRIVAL.saveFailed)),
			},
		);
	};

	const onlyRow = sections.length === 1 ? sections[0]?.rows[0] : undefined;
	const title =
		accountIds.length > 0
			? ARRIVAL.title(accountIds.length)
			: ARRIVAL.titleNoAccounts(possessive(firstNameOf(onlyRow?.holderName ?? onlyRow?.label ?? "")));
	const offerGroup = accountIds.length >= 2;

	return (
		<Box
			component="section"
			aria-labelledby={titleId}
			sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.5 } }}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, md: 2.5 } }}>
				<SpotIcon size="lg" sx={{ display: { xs: "none", md: "grid" } }}>
					<IconInbox />
				</SpotIcon>
				<Box sx={{ minWidth: 0 }}>
					<Typography variant="eyebrow" component="div">
						{ARRIVAL.welcome(firstNameOf(directory.me.name))}
					</Typography>
					<Typography
						id={titleId}
						component="h2"
						sx={{ typography: { xs: "h2", md: "h1" }, mt: 0.75 }}
					>
						{title}
					</Typography>
					<Typography color="text.secondary" sx={{ mt: 0.75 }}>
						{ARRIVAL.from(namesOf(sharerNames), accountIds.length)}
					</Typography>
				</Box>
			</Box>

			<Box
				sx={{
					display: "flex",
					flexDirection: { xs: "column", lg: "row" },
					alignItems: { lg: "flex-start" },
					gap: { xs: 2, md: 2.5 },
				}}
			>
				<SectionCard padding="none" sx={{ flex: 1.35, minWidth: 0, overflow: "hidden" }}>
					{sections.map((section, index) => (
						<Box key={section.sharer.userId}>
							<Box
								sx={(theme) => ({
									display: "flex",
									alignItems: "center",
									gap: 1.25,
									px: { xs: 2, md: 2.5 },
									py: 1.5,
									bgcolor: theme.vars.palette.kosh.surface2,
									borderTop: index > 0 ? `1px solid ${theme.vars.palette.kosh.line}` : 0,
								})}
							>
								<HolderAvatar name={section.sharer.name} colorKey={section.sharer.userId} size="xs" />
								<Typography variant="subtitle2" component="h3" noWrap sx={{ flex: 1, minWidth: 0 }}>
									{ARRIVAL.fromSharer(section.sharer.name)}
								</Typography>
								<Tag tone="new">{ARRIVAL.isNew}</Tag>
							</Box>
							<Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
								{section.rows.map((row) => (
									<ArrivedRow key={row.key} row={row} sharerName={section.sharer.name} />
								))}
							</Box>
						</Box>
					))}
					<Box
						sx={(theme) => ({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: 1.25,
							px: { xs: 2, md: 2.5 },
							py: 1.75,
							borderTop: `1px solid ${theme.vars.palette.kosh.line}`,
						})}
					>
						<Typography variant="body2" sx={{ flex: "1 1 240px" }}>
							{levels.map((level) => ARRIVAL.levelMeans[level]).join(" ")}
						</Typography>
						{!offerGroup && (
							<Button variant="outlined" onClick={dismiss}>
								{ARRIVAL.gotIt}
							</Button>
						)}
					</Box>
				</SectionCard>

				{offerGroup && (
					<SectionCard
						sx={(theme) => ({
							flex: 1,
							minWidth: 0,
							borderWidth: 2,
							borderColor: theme.vars.palette.kosh.accent,
						})}
					>
						<Box
							component="form"
							noValidate
							onSubmit={saveGroup}
							sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
								<Box
									aria-hidden
									sx={(theme) => ({
										display: "flex",
										color: theme.vars.palette.kosh.accentText,
										"& svg": { fontSize: 26 },
									})}
								>
									<IconGroup />
								</Box>
								<Typography variant="h2">{family ? ARRIVAL.keepFamily : ARRIVAL.keepThese}</Typography>
							</Box>
							<Typography variant="body2">{ARRIVAL.keepBody(accountIds.length)}</Typography>
							<TextField
								label={ARRIVAL.groupName}
								value={name}
								onChange={(event) => {
									setName(event.target.value);
									setNameMissing(false);
								}}
								placeholder={ARRIVAL.groupNameHint}
								error={nameMissing}
								helperText={nameMissing ? ARRIVAL.groupNameMissing : undefined}
								fullWidth
								slotProps={{ htmlInput: { maxLength: 120 } }}
							/>
							<Box sx={{ display: "flex", gap: 1.25 }}>
								<Button
									type="submit"
									variant="contained"
									disabled={createGroup.isPending}
									sx={{ flex: 1 }}
								>
									{ARRIVAL.saveGroup}
								</Button>
								<Button variant="text" onClick={dismiss} disabled={createGroup.isPending}>
									{ARRIVAL.notNow}
								</Button>
							</Box>
						</Box>
					</SectionCard>
				)}
			</Box>
		</Box>
	);
};

const ArrivedRow = ({ row, sharerName }: { row: ArrivalRow; sharerName: string }) => {
	const whose = possessive(firstNameOf(row.holderName ?? row.label));
	const questions = row.account?.questionsWaiting ?? 0;
	const line = row.awaitingOwner
		? ARRIVAL.ownerOnceConfirmed(firstNameOf(sharerName))
		: !row.account
			? ARRIVAL.noneYet
			: row.wide
				? ARRIVAL.wideLine(whose)
				: questions > 0
					? ARRIVAL.questionsLine(questions)
					: ARRIVAL.levelForYou[row.level];
	return (
		<Box
			component="li"
			sx={(theme) => ({
				display: "flex",
				alignItems: "center",
				gap: 1.5,
				px: { xs: 2, md: 2.5 },
				py: 1.5,
				"& + &": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
			})}
		>
			{row.account ? (
				<BrokerMark broker={brokerNameOf(row.account)} />
			) : (
				<Box
					aria-hidden
					sx={(theme) => ({
						width: 38,
						display: "grid",
						placeItems: "center",
						color: theme.vars.palette.kosh.ink2,
					})}
				>
					<IconHolderWide />
				</Box>
			)}
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Typography variant="subtitle2" component="div" noWrap>
					{row.account ? row.label : ARRIVAL.wideTitle(whose)}
				</Typography>
				<Typography
					variant="caption"
					component="div"
					sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
				>
					{row.wide && row.account && !row.awaitingOwner && (
						<Box component="span" aria-hidden sx={{ display: "flex", "& svg": { fontSize: 14 } }}>
							<IconHolderWide />
						</Box>
					)}
					{line}
				</Typography>
			</Box>
			<LevelBadge level={row.level} />
		</Box>
	);
};
