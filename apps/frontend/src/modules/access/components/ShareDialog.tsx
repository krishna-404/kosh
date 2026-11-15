import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconAddPerson, IconBack, IconOwner, IconSend } from "@connected-repo/ui-mui/kosh/icons";
import { LEVEL_LABEL } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Money } from "@connected-repo/ui-mui/kosh/Money";
import { ConfirmDialog, ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Divider } from "@connected-repo/ui-mui/layout/Divider";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import type { AccessEntry, AccessList } from "@connected-repo/zod-schemas/kosh/people.zod";
import { OWNER_WARNING } from "@frontend/copy/levels.copy";
import { SHARING } from "@frontend/copy/sharing.copy";
import { useDirectory, useRefreshPeople } from "@frontend/modules/access/people.queries";
import {
	brokerNameOf,
	errorWords,
	firstNameOf,
	possessive,
} from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { CheckPanel } from "./share/CheckPanel";
import type { ShareActions, ShareContext } from "./share/EntryRow";
import { InviteForm } from "./share/InviteForm";
import { PeopleList } from "./share/PeopleList";
import {
	checkEmail,
	coveringEntry,
	type EmailProblem,
	entryFirstName,
	entryName,
	existingEntry,
	refusalOf,
	type ShareTarget,
	targetKey,
	wontSeeWords,
} from "./share/share.utils";

/**
 * The share dialog: who has access to one account (or to all of a holder's
 * accounts), and inviting someone new through "Check before you send".
 *
 * Opened from Accounts and people, Who can see what, and the account page.
 * `target` null means closed.
 */
export interface ShareDialogProps {
	target: { accountId: string } | { personId: string } | null;
	onClose: () => void;
	/** Prefill the invite field (e.g. "Share more with Sunita"). */
	initialEmail?: string;
}

export const ShareDialog = ({ target, onClose, initialEmail }: ShareDialogProps) => {
	// Every opening is a fresh session, so closing resets everything. The last
	// session stays mounted (closed) so the dialog can animate away with its
	// content, and so an "Undo" in a snackbar still has somewhere to run.
	const key = target ? targetKey(target) : null;
	const [seenKey, setSeenKey] = useState<string | null>(null);
	const [session, setSession] = useState<{ start: ShareTarget; count: number } | null>(null);
	if (key !== seenKey) {
		setSeenKey(key);
		if (target) setSession({ start: target, count: (session?.count ?? 0) + 1 });
	}
	if (!session) return null;
	return (
		<ShareSession
			key={session.count}
			open={target !== null}
			start={session.start}
			initialEmail={initialEmail}
			onClose={onClose}
		/>
	);
};

/** `people`: who has access (with the invite form on desktop). `invite`: phone only. `check`: before sending. */
type Step = "people" | "invite" | "check";

type LevelChange = Parameters<ShareActions["setLevel"]>[0];

/** A decision that needs a yes first. */
type Ask =
	| { kind: "remove"; entry: AccessEntry }
	| { kind: "leave"; entry: AccessEntry }
	| { kind: "owner"; change: LevelChange }
	| { kind: "lastOwner" };

const isSettledOwner = (entry: AccessEntry): boolean =>
	entry.level === "owner" && !entry.pending && !entry.needsConfirmation;

const LoadingList = () => (
	<Box aria-busy aria-label="Loading who has access" sx={{ display: "grid", gap: 1.5 }}>
		<Skeleton variant="rounded" height={48} />
		<Skeleton variant="rounded" height={48} />
		<Skeleton variant="text" width="40%" sx={{ mt: 1.5 }} />
		{[0, 1, 2].map((row) => (
			<Box key={row} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
				<Skeleton variant="circular" width={34} height={34} />
				<Box sx={{ flex: 1 }}>
					<Skeleton variant="text" width="50%" />
					<Skeleton variant="text" width="35%" />
				</Box>
				<Skeleton variant="rounded" width={92} height={30} />
			</Box>
		))}
	</Box>
);

interface ShareSessionProps {
	open: boolean;
	start: ShareTarget;
	initialEmail?: string;
	onClose: () => void;
}

const ShareSession = ({ open, start, initialEmail, onClose }: ShareSessionProps) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("sm"));
	const wide = useMediaQuery(theme.breakpoints.up("md"));
	const snack = useSnack();
	const refresh = useRefreshPeople();
	const queryClient = useQueryClient();
	const directory = useDirectory();
	const formId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);

	// The dialog can move between an account and its holder; `trail` remembers the way back.
	const [trail, setTrail] = useState<ShareTarget[]>([start]);
	const target = trail[trail.length - 1] ?? start;
	const onAccount = "accountId" in target;

	const [step, setStep] = useState<Step>(initialEmail && phone ? "invite" : "people");
	const [email, setEmail] = useState(initialEmail ?? "");
	const [level, setLevel] = useState<AccessLevel>("view");
	const [problem, setProblem] = useState<EmailProblem | null>(null);
	/** An address they were warned about and chose to keep. */
	const [keptTypo, setKeptTypo] = useState<string | null>(null);
	const [sendFailure, setSendFailure] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [ask, setAsk] = useState<Ask | null>(null);
	const [askOpen, setAskOpen] = useState(false);
	const [wantFocus, setWantFocus] = useState(Boolean(initialEmail));

	const listOptions = orpc.access.list.queryOptions({ input: target, enabled: open });
	const list = useQuery(listOptions);
	const grant = useMutation(orpc.access.grant.mutationOptions());
	const revoke = useMutation(orpc.access.revoke.mutationOptions());
	const resend = useMutation(orpc.access.resend.mutationOptions());
	const confirm = useMutation(orpc.access.confirm.mutationOptions());

	const data = list.data;

	// ── Names, from the list when it is in and from the directory until then ──
	const dirAccounts = directory.data?.accounts ?? [];
	const dirAccount = onAccount ? dirAccounts.find((a) => a.id === target.accountId) : undefined;
	const holderId =
		data?.target.holder.id ?? dirAccount?.personId ?? ("personId" in target ? target.personId : "");
	const dirHolder = directory.data?.holders.find((h) => h.id === holderId);
	const holder = data?.target.holder ?? dirHolder;
	const holderName = holder?.displayName ?? "";
	const holderFirst = firstNameOf(holderName);
	const holderPossessive = possessive(holderFirst);
	const label = data?.target.label ?? dirAccount?.label ?? holderName;
	const what = onAccount ? label : SHARING.allOf(holderPossessive);
	const brokerOf = (accountId: string): string => {
		const account = dirAccounts.find((a) => a.id === accountId);
		return account ? brokerNameOf(account) : "";
	};
	const holderAccounts = dirAccounts
		.filter((a) => a.personId === holderId)
		.map((a) => ({ id: a.id, label: a.label, broker: brokerNameOf(a) }));
	const myEmail = directory.data?.me.email ?? "";

	const settledOwners = (data?.holderWide ?? []).filter(isSettledOwner);
	const soleOwner = settledOwners.length === 1 && settledOwners[0]?.isMe === true;

	// Put the cursor in the invite field when something asked for it.
	useEffect(() => {
		if (!wantFocus || !data || !inputRef.current) return;
		inputRef.current.focus();
		setWantFocus(false);
	}, [wantFocus, data]);

	const openAsk = (next: Ask) => {
		setAsk(next);
		setAskOpen(true);
	};
	const closeAsk = () => setAskOpen(false);

	/** Runs a change; a refusal is said in words, and "last owner" gets its own dialog. */
	const guard = async (work: () => Promise<void>) => {
		setBusy(true);
		try {
			await work();
		} catch (error) {
			if (refusalOf(error) === "LAST_OWNER") openAsk({ kind: "lastOwner" });
			else snack(errorWords(error, SHARING.changeFailed));
			// A refusal usually means the list on screen is out of date.
			void refresh();
		} finally {
			setBusy(false);
		}
	};

	const resetInvite = (invite?: { email: string; level: AccessLevel }) => {
		setEmail(invite?.email ?? "");
		setLevel(invite?.level ?? "view");
		setProblem(null);
		setKeptTypo(null);
		setSendFailure(null);
		setStep(invite && phone ? "invite" : "people");
		setWantFocus(Boolean(invite));
	};

	const openTarget: ShareActions["open"] = (next, invite) => {
		if (targetKey(next) !== targetKey(target)) setTrail([...trail, next]);
		resetInvite(invite);
	};
	const goBack = () => {
		setTrail(trail.slice(0, -1));
		resetInvite();
	};

	// ── Changes to people already on the list ──
	const applyLevel = (change: LevelChange) =>
		guard(async () => {
			const { entry, target: on, level: next, previous, what: words } = change;
			const { grantId } = await grant.mutateAsync({ target: on, email: entry.email, level: next });
			await refresh();
			snack({
				message: entry.pending
					? SHARING.inviteChanged(entry.email, LEVEL_LABEL[next])
					: SHARING.canNow(entryName(entry), next, words),
				actionLabel: SHARING.undo,
				onAction: () =>
					guard(async () => {
						if (previous)
							await grant.mutateAsync({ target: on, email: entry.email, level: previous });
						else await revoke.mutateAsync({ grantId });
						await refresh();
						snack(SHARING.undone);
					}),
			});
		});

	const actions: ShareActions = {
		// Owner hands over the keys, so it is confirmed first.
		setLevel: (change) =>
			change.level === "owner" ? openAsk({ kind: "owner", change }) : void applyLevel(change),
		remove: (entry) => openAsk({ kind: "remove", entry }),
		// The only owner cannot leave; say why instead of asking "are you sure?".
		leave: (entry) =>
			openAsk(soleOwner && !onAccount ? { kind: "lastOwner" } : { kind: "leave", entry }),
		resend: (entry) =>
			void guard(async () => {
				await resend.mutateAsync({ grantId: entry.grantId });
				await refresh();
				snack(SHARING.inviteSentAgain(entry.email));
			}),
		cancelInvite: (entry) =>
			void guard(async () => {
				await revoke.mutateAsync({ grantId: entry.grantId });
				await refresh();
				snack(SHARING.inviteCancelled(entry.email));
			}),
		confirmOwner: (entry) =>
			void guard(async () => {
				await confirm.mutateAsync({ grantId: entry.grantId });
				await refresh();
				snack(SHARING.confirmed(entryName(entry), what));
			}),
		open: openTarget,
	};

	const confirmAsk = () => {
		if (!ask) return;
		closeAsk();
		if (ask.kind === "owner") void applyLevel(ask.change);
		if (ask.kind === "remove")
			void guard(async () => {
				await revoke.mutateAsync({ grantId: ask.entry.grantId });
				await refresh();
				snack(SHARING.removed(entryFirstName(ask.entry), what));
			});
		if (ask.kind === "leave")
			void guard(async () => {
				await revoke.mutateAsync({ grantId: ask.entry.grantId });
				onClose();
				// This list is no longer theirs to read; drop it rather than refetch it.
				queryClient.removeQueries({ queryKey: listOptions.queryKey });
				await refresh();
				snack(SHARING.left(what));
			});
		if (ask.kind === "lastOwner") {
			// "Choose a new owner": ready to invite one.
			setLevel("owner");
			setProblem(null);
			setStep(phone ? "invite" : "people");
			setWantFocus(true);
		}
	};

	// ── Inviting ──
	const backToForm = () => setStep(phone ? "invite" : "people");

	const check = (candidate: string, forLevel: AccessLevel, kept: string | null): boolean => {
		if (!data) return false;
		const found = checkEmail({
			email: candidate,
			level: forLevel,
			list: data,
			myEmail,
			keepAsTyped: kept === candidate,
		});
		setProblem(found);
		setSendFailure(null);
		if (found) backToForm();
		return found === null;
	};

	const next = (candidate: string = email, keep = false) => {
		const clean = candidate.trim().toLowerCase();
		const kept = keep ? clean : keptTypo;
		setKeptTypo(kept);
		if (!check(clean, level, kept)) return;
		setEmail(clean);
		setStep("check");
	};

	// Beside the check panel the field stays live and the panel follows it;
	// the address is checked again when "Send" is pressed.
	const changeEmail = (value: string) => {
		setEmail(value);
		setProblem(null);
	};

	const changeLevel = (nextLevel: AccessLevel) => {
		setLevel(nextLevel);
		if (step === "check") check(email.trim().toLowerCase(), nextLevel, keptTypo);
		else if (problem?.kind === "covered" || problem?.kind === "same") setProblem(null);
	};

	const send = async () => {
		if (!data) return;
		const sentTo = email.trim().toLowerCase();
		if (!check(sentTo, level, keptTypo)) return;
		const sentLevel = level;
		const on = target;
		const before = existingEntry(data, sentTo);
		setBusy(true);
		setSendFailure(null);
		try {
			const result = await grant.mutateAsync({ target: on, email: sentTo, level: sentLevel });
			await refresh();
			const fresh = queryClient.getQueryData<AccessList>(listOptions.queryKey);
			const entry = [...(fresh?.holderWide ?? []), ...(fresh?.direct ?? [])].find(
				(e) => e.grantId === result.grantId,
			);
			if (result.pending)
				snack({
					message: SHARING.inviteSent(sentTo),
					actionLabel: SHARING.cancelInvite,
					onAction: () =>
						guard(async () => {
							await revoke.mutateAsync({ grantId: result.grantId });
							await refresh();
							snack(SHARING.inviteCancelled(sentTo));
						}),
				});
			else
				snack({
					message: SHARING.canNow(entry ? entryName(entry) : sentTo, sentLevel, what),
					actionLabel: SHARING.undo,
					onAction: () =>
						guard(async () => {
							// Undo puts back what they had here before, or takes away what was just given.
							if (before && !before.pending)
								await grant.mutateAsync({ target: on, email: sentTo, level: before.level });
							else await revoke.mutateAsync({ grantId: result.grantId });
							await refresh();
							snack(SHARING.undone);
						}),
				});
			resetInvite();
		} catch (error) {
			const code = refusalOf(error);
			if (code === "SELF") {
				setProblem({ kind: "self" });
				backToForm();
			} else if (code === "COVERED_BY_HOLDER") {
				const covering = data.holderWide.find((e) => e.email.toLowerCase() === sentTo);
				setProblem(
					covering
						? { kind: "covered", name: entryFirstName(covering), got: covering.level }
						: { kind: "refused", message: errorWords(error, SHARING.sendFailed) },
				);
				backToForm();
			} else if (code === "LAST_OWNER") {
				openAsk({ kind: "lastOwner" });
			} else {
				setSendFailure(errorWords(error, SHARING.sendFailed));
			}
		} finally {
			setBusy(false);
		}
	};

	// ── What is on screen ──
	const checking = step === "check" && data !== undefined;
	const sideBySide = checking && wide;
	const showForm = data !== undefined && (phone ? step === "invite" : !checking || wide);
	const showPeople = data !== undefined && (phone ? step === "people" : !checking || wide);

	const context: ShareContext = {
		target,
		what,
		holderId,
		holderFirstName: holderFirst,
		ownsHolder: data?.ownsHolder ?? false,
		soleOwner: soleOwner && !onAccount,
		holderAccounts,
		busy,
	};

	const typed = email.trim().toLowerCase();
	const before = data && checking ? existingEntry(data, typed) : undefined;
	// Someone who has all of the holder's accounts and is being given more on this one.
	const covering = data && checking ? coveringEntry(data, typed) : undefined;
	let changeNote: string | null = null;
	if (before && !before.pending && before.level !== level)
		changeNote = SHARING.levelChangeNote(entryFirstName(before), before.level, LEVEL_LABEL[level]);
	else if (covering && !covering.pending)
		changeNote = SHARING.raiseNote(
			entryFirstName(covering),
			covering.level,
			holderPossessive,
			LEVEL_LABEL[level],
		);
	const checkPanel = data && checking && (
		<CheckPanel
			email={typed}
			level={level}
			accounts={
				onAccount
					? [{ id: target.accountId, label, broker: brokerOf(target.accountId) }]
					: holderAccounts
			}
			holder={
				onAccount || !holder
					? null
					: { id: holder.id, displayName: holderName, firstName: holderFirst, kind: holder.kind }
			}
			wontSee={wontSeeWords(directory.data, data.target, covering !== undefined)}
			changeNote={changeNote}
			accountCaption={covering ? SHARING.raisedHere : SHARING.onlyAccount}
			failure={sendFailure}
		/>
	);

	const sendButton = (
		<Button
			variant="contained"
			size={phone ? "large" : "medium"}
			startIcon={<IconSend />}
			onClick={send}
			disabled={busy}
		>
			{SHARING.send(LEVEL_LABEL[level])}
		</Button>
	);

	// ── The header: what is being shared ──
	let title: ReactNode;
	if (phone && step === "invite") title = SHARING.inviteTitle(what);
	else if (checking && !sideBySide) title = phone ? SHARING.checkTitlePhone : SHARING.checkEyebrow;
	else
		title = (
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
				{trail.length > 1 && (
					<IconButton aria-label={SHARING.back} onClick={goBack} sx={{ ml: -1.5, mr: -1 }}>
						<IconBack />
					</IconButton>
				)}
				{onAccount ? (
					<BrokerMark broker={brokerOf(target.accountId) || label} size={44} />
				) : (
					<HolderAvatar name={holderName || "?"} colorKey={holderId} kind={holder?.kind} />
				)}
				<Box sx={{ minWidth: 0 }}>
					<Box sx={{ overflowWrap: "anywhere" }}>
						{onAccount ? SHARING.titleAccount(label) : SHARING.titleHolder(holderPossessive)}
					</Box>
					<Typography variant="body2" component="div" sx={{ mt: 0.5, letterSpacing: 0 }}>
						{onAccount ? (
							<>
								{dirAccount?.value != null && (
									<>
										<Money value={dirAccount.value} />
										{" · "}
									</>
								)}
								{SHARING.heldBy(holderName)}
								{data?.ownsHolder && (
									<>
										{" · "}
										<Link
											component="button"
											type="button"
											onClick={() => openTarget({ personId: holderId })}
										>
											{SHARING.shareAllInstead(holderPossessive)}
										</Link>
									</>
								)}
							</>
						) : (
							SHARING.holderCovers(
								holderAccounts.map((a) => a.label),
								holderFirst,
							)
						)}
					</Typography>
				</Box>
			</Box>
		);

	// ── The footer: phone steps, and the check step when it is on its own ──
	let footer: ReactNode;
	if (checking)
		// Under the panel, outside the scrolling part, so "Send" is always in reach.
		footer = (
			<>
				<Button variant="text" onClick={backToForm} disabled={busy}>
					{phone ? SHARING.changeSomething : SHARING.back}
				</Button>
				{sendButton}
			</>
		);
	else if (phone && step === "invite")
		footer = (
			<>
				<Button variant="text" onClick={() => setStep("people")}>
					{SHARING.back}
				</Button>
				<Button type="submit" form={formId} variant="contained" size="large">
					{SHARING.next}
				</Button>
			</>
		);
	else if (phone && data)
		footer = (
			<Button
				variant="contained"
				size="large"
				startIcon={<IconAddPerson />}
				onClick={() => {
					setStep("invite");
					setWantFocus(true);
				}}
			>
				{SHARING.inviteSomeone}
			</Button>
		);

	const askEntryFirst = ask && "entry" in ask ? entryFirstName(ask.entry) : "";

	return (
		<>
			<ResponsiveDialog
				open={open}
				onClose={onClose}
				title={title}
				maxWidth={sideBySide ? "md" : "sm"}
				actions={footer}
			>
				{list.isPending && <LoadingList />}

				{list.isError && (
					<Banner
						tone="bad"
						action={
							<Button variant="text" color="error" onClick={() => list.refetch()}>
								{SHARING.retry}
							</Button>
						}
					>
						{errorWords(list.error, SHARING.loadFailed)}
					</Banner>
				)}

				{data && (
					<Box sx={{ display: "flex", alignItems: "stretch", gap: 3 }}>
						{(showForm || showPeople) && (
							<Box
								sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.5 }}
							>
								{showForm && (
									<InviteForm
										phone={phone}
										formId={formId}
										inputRef={inputRef}
										email={email}
										onEmail={changeEmail}
										level={level}
										onLevel={changeLevel}
										problem={problem}
										onUseSuggestion={() => problem?.kind === "typo" && next(problem.suggestion)}
										onKeepTyped={() => next(email, true)}
										onChangeOnHolder={
											data.ownsHolder ? () => openTarget({ personId: holderId }) : undefined
										}
										holderFirstName={holderFirst}
										whatHere={onAccount ? "this" : SHARING.allOf(holderPossessive)}
										showNext={!phone && !checking}
										onNext={() => next()}
									/>
								)}
								{showForm && showPeople && <Divider />}
								{showPeople && (
									<PeopleList
										list={data}
										context={context}
										actions={actions}
										brokerOf={brokerOf}
										onLeavePage={onClose}
									/>
								)}
							</Box>
						)}

						{checkPanel &&
							(sideBySide ? (
								<Box
									component="aside"
									aria-live="polite"
									sx={(t) => ({
										width: 392,
										flex: "none",
										display: "flex",
										flexDirection: "column",
										gap: 1.5,
										p: 2.5,
										borderRadius: "18px",
										border: `1px solid ${t.vars.palette.kosh.line}`,
										bgcolor: t.vars.palette.kosh.surface2,
									})}
								>
									<Typography variant="eyebrow" component="div">
										{SHARING.checkEyebrow}
									</Typography>
									{checkPanel}
								</Box>
							) : (
								<Box aria-live="polite" sx={{ flex: 1, minWidth: 0 }}>
									{checkPanel}
								</Box>
							))}
					</Box>
				)}
			</ResponsiveDialog>

			<ConfirmDialog
				open={askOpen && ask?.kind === "remove"}
				tone="danger"
				title={SHARING.removeTitle(askEntryFirst, what)}
				confirmLabel={SHARING.remove(askEntryFirst)}
				cancelLabel={SHARING.keep}
				onConfirm={confirmAsk}
				onCancel={closeAsk}
			>
				{SHARING.removeBody(!onAccount)}
			</ConfirmDialog>

			<ConfirmDialog
				open={askOpen && ask?.kind === "leave"}
				tone="danger"
				title={SHARING.leaveTitle(what)}
				confirmLabel={SHARING.leave}
				cancelLabel={SHARING.stay}
				onConfirm={confirmAsk}
				onCancel={closeAsk}
			>
				{SHARING.leaveBody(!onAccount)}
			</ConfirmDialog>

			<ConfirmDialog
				open={askOpen && ask?.kind === "owner"}
				icon={<IconOwner />}
				title={
					ask?.kind === "owner"
						? SHARING.makeOwnerTitle(entryFirstName(ask.change.entry), ask.change.what)
						: ""
				}
				confirmLabel={
					ask?.kind === "owner" ? SHARING.makeOwnerConfirm(entryFirstName(ask.change.entry)) : ""
				}
				cancelLabel={SHARING.notNow}
				onConfirm={confirmAsk}
				onCancel={closeAsk}
			>
				{OWNER_WARNING}
			</ConfirmDialog>

			<ConfirmDialog
				open={askOpen && ask?.kind === "lastOwner"}
				icon={<IconOwner />}
				title={
					onAccount
						? SHARING.needsOwnerTitle(label)
						: SHARING.needsOwnerTitleHolder(holderPossessive)
				}
				confirmLabel={SHARING.chooseNewOwner}
				cancelLabel={SHARING.keepMeAsOwner}
				onConfirm={confirmAsk}
				onCancel={closeAsk}
			>
				{SHARING.needsOwnerBody(!onAccount)}
			</ConfirmDialog>
		</>
	);
};
