import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Collapse } from "@connected-repo/ui-mui/feedback/Collapse";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import {
	IconCheck,
	IconClock,
	IconClose,
	IconCopy,
	IconHelp,
	IconLock,
	IconMail,
	IconSignOut,
} from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { InviteStatus } from "@connected-repo/zod-schemas/kosh/people.zod";
import { Page } from "@frontend/components/layout/Page";
import { INVITE } from "@frontend/copy/invite.copy";
import { ROUTES } from "@frontend/copy/nav.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import { errorWords, firstNameOf } from "@frontend/modules/access/people.utils";
import { InviteState } from "@frontend/modules/invite/components/InviteState";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { signout } from "@frontend/utils/signout.utils";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router";

/** How long an invite link's token can be — anything else is not a whole link. */
const TOKEN_MIN = 20;
const TOKEN_MAX = 64;
const NOT_FOUND: InviteStatus = {
	state: "not_found",
	inviterName: null,
	maskedEmail: null,
	myEmail: "",
};

/**
 * Where an invite link lands for someone who is signed in. An invite sent to
 * the address they are signed in with has already been accepted by the time
 * this page loads; every other outcome is explained here, with nothing about
 * what was shared.
 */
export default function InvitePage() {
	const { token = "" } = useParams();
	const refresh = useRefreshPeople();
	// A link cut short or mistyped by a mail app is not asked about at all.
	const wholeLink = token.length >= TOKEN_MIN && token.length <= TOKEN_MAX;
	const status = useQuery({
		...orpc.access.inviteStatus.queryOptions({ input: { token } }),
		enabled: wholeLink,
	});

	// Accepting changed what this person can see: fetch it again.
	const state = status.data?.state;
	useEffect(() => {
		if (state === "yours") void refresh();
	}, [state, refresh]);

	return (
		<Page title={INVITE.pageTitle}>
			{!wholeLink ? (
				<SectionCard>
					<Outcome status={NOT_FOUND} />
				</SectionCard>
			) : status.isPending ? (
				<Skeleton variant="rounded" height={360} sx={{ borderRadius: 2.5 }} />
			) : status.isError ? (
				<Banner
					tone="bad"
					action={
						<Button variant="outlined" onClick={() => void status.refetch()}>
							{INVITE.tryAgain}
						</Button>
					}
				>
					{errorWords(status.error, INVITE.loadFailed)}
				</Banner>
			) : (
				<SectionCard>
					<Outcome status={status.data} />
				</SectionCard>
			)}
		</Page>
	);
}

const goToAccounts = (
	<Button variant="contained" size="large" component={Link} to={ROUTES.shared}>
		{INVITE.goToAccounts}
	</Button>
);

const Outcome = ({ status }: { status: InviteStatus }) => {
	const inviter = status.inviterName?.trim() || INVITE.someone;
	const inviterShort = status.inviterName?.trim()
		? firstNameOf(status.inviterName)
		: INVITE.someoneLower;

	switch (status.state) {
		case "yours":
			return (
				<InviteState icon={<IconCheck />} title={INVITE.yours.title} actions={goToAccounts}>
					<Typography color="text.secondary">{INVITE.yours.body(inviter, status.myEmail)}</Typography>
				</InviteState>
			);
		case "other_email":
			return <OtherEmail status={status} inviter={inviter} inviterShort={inviterShort} />;
		case "expired":
			return (
				<InviteState tone="warn" icon={<IconClock />} title={INVITE.expired.title} actions={goToAccounts}>
					<Typography color="text.secondary">{INVITE.expired.body(inviterShort)}</Typography>
				</InviteState>
			);
		case "cancelled":
			return (
				<InviteState tone="warn" icon={<IconClose />} title={INVITE.cancelled.title} actions={goToAccounts}>
					<Typography color="text.secondary">{INVITE.cancelled.body(inviterShort)}</Typography>
				</InviteState>
			);
		case "accepted":
			return (
				<InviteState tone="warn" icon={<IconLock />} title={INVITE.accepted.title} actions={goToAccounts}>
					<Typography color="text.secondary">{INVITE.accepted.body(status.maskedEmail)}</Typography>
					<Typography variant="body2">{INVITE.accepted.notYou(inviterShort)}</Typography>
				</InviteState>
			);
		default:
			return (
				<InviteState tone="warn" icon={<IconHelp />} title={INVITE.notFound.title} actions={goToAccounts}>
					<Typography color="text.secondary">{INVITE.notFound.body}</Typography>
				</InviteState>
			);
	}
};

interface OtherEmailProps {
	status: InviteStatus;
	inviter: string;
	inviterShort: string;
}

/** Signed in with a different address than the invite was sent to. */
const OtherEmail = ({ status, inviter, inviterShort }: OtherEmailProps) => {
	const snack = useSnack();
	const [asking, setAsking] = useState(false);
	const [leaving, setLeaving] = useState(false);

	const copyEmail = async () => {
		try {
			await navigator.clipboard.writeText(status.myEmail);
			snack(INVITE.otherEmail.copied(status.myEmail));
		} catch {
			snack(INVITE.otherEmail.copyFailed);
		}
	};

	return (
		<InviteState
			tone="warn"
			icon={<IconMail />}
			title={INVITE.otherEmail.title}
			after={
				<Collapse in={asking} unmountOnExit>
					<Banner sx={{ textAlign: "left" }}>
						<b>{INVITE.otherEmail.askTitle(inviterShort)}</b>
						<Box sx={{ mt: 0.5 }}>
							{INVITE.otherEmail.askLead(inviterShort)}
							<b>{status.myEmail}</b>
							{INVITE.otherEmail.askTail}
						</Box>
						<Button
							variant="outlined"
							size="small"
							startIcon={<IconCopy />}
							onClick={() => void copyEmail()}
							sx={{ mt: 1.25 }}
						>
							{INVITE.otherEmail.copyEmail}
						</Button>
					</Banner>
				</Collapse>
			}
			actions={
				<>
					<Button
						variant="contained"
						size="large"
						startIcon={<IconSignOut />}
						disabled={leaving}
						onClick={() => {
							setLeaving(true);
							void signout();
						}}
					>
						{INVITE.otherEmail.signInOther}
					</Button>
					<Button
						variant="outlined"
						size="large"
						aria-expanded={asking}
						onClick={() => setAsking((open) => !open)}
						sx={{ whiteSpace: "normal", py: 1 }}
					>
						{INVITE.otherEmail.askToSendHere(inviterShort)}
					</Button>
				</>
			}
		>
			<Typography color="text.secondary">
				{INVITE.otherEmail.sentTo(inviter)}
				<Strong>{status.maskedEmail}</Strong>
				{INVITE.otherEmail.signedInAs}
				<Strong>{status.myEmail}</Strong>.
			</Typography>
			<Typography variant="body2">{INVITE.otherEmail.nothingShown}</Typography>
		</InviteState>
	);
};

const Strong = ({ children }: { children: ReactNode }) => (
	<Box component="b" sx={{ color: "text.primary" }}>
		{children}
	</Box>
);
