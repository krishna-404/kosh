import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconCheck, IconMail } from "@connected-repo/ui-mui/kosh/icons";
import { KoshWordmark } from "@connected-repo/ui-mui/kosh/KoshMark";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { WRONG_PERSON } from "@frontend/copy/invite.copy";
import { invitePath } from "@frontend/copy/nav.copy";
import { InviteState } from "@frontend/modules/invite/components/InviteState";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

/** How long an invite link's token can be — anything else was cut short by a mail app. */
const TOKEN_MIN = 20;
const TOKEN_MAX = 64;

/**
 * "This reached the wrong person" — the link under an invite email, for
 * someone who has no account and should not need one. Outside the app shell.
 *
 * Nothing happens when the page loads: mail scanners and link previews open
 * links too. Only the button stops the invite.
 */
export default function WrongPersonPage() {
	const { token = "" } = useParams();
	const report = useMutation(orpc.access.reportWrong.mutationOptions());
	const wholeLink = token.length >= TOKEN_MIN && token.length <= TOKEN_MAX;
	const [incomplete, setIncomplete] = useState(false);

	useEffect(() => {
		document.title = `${WRONG_PERSON.pageTitle} · Kosh`;
	}, []);

	return (
		<Box
			component="main"
			sx={{
				minHeight: "100dvh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: { xs: 3, md: 4 },
				px: 2,
				py: { xs: 3, md: 7 },
			}}
		>
			<KoshWordmark />
			<SectionCard component="div" sx={{ width: "100%", maxWidth: 560 }}>
				{report.isSuccess ? (
					<InviteState headingLevel="h1" icon={<IconCheck />} title={WRONG_PERSON.doneTitle}>
						<Typography color="text.secondary" role="status">
							{WRONG_PERSON.doneBody}
						</Typography>
					</InviteState>
				) : (
					<InviteState
						headingLevel="h1"
						tone="warn"
						icon={<IconMail />}
						title={WRONG_PERSON.title}
						actions={
							<>
								<Button
									variant="contained"
									size="large"
									disabled={report.isPending}
									onClick={() => (wholeLink ? report.mutate({ token }) : setIncomplete(true))}
								>
									{report.isPending ? WRONG_PERSON.stopping : WRONG_PERSON.stop}
								</Button>
								<Button variant="text" component={Link} to={invitePath(token)}>
									{WRONG_PERSON.meantForMe}
								</Button>
							</>
						}
					>
						<Typography color="text.secondary">{WRONG_PERSON.body}</Typography>
						{(incomplete || report.isError) && (
							<Banner tone="bad" sx={{ textAlign: "left" }}>
								{incomplete ? WRONG_PERSON.incomplete : WRONG_PERSON.failed}
							</Banner>
						)}
					</InviteState>
				)}
			</SectionCard>
		</Box>
	);
}
