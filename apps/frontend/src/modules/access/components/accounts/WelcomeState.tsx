import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { EmptyState } from "@connected-repo/ui-mui/kosh/EmptyState";
import { IconAdd, IconAddPerson, IconInbox, IconPeople } from "@connected-repo/ui-mui/kosh/icons";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { WELCOME } from "@frontend/copy/accounts.copy";

interface WelcomeStateProps {
	firstName: string;
	/** The address the signed-in person uses — the one others must share with. */
	email: string;
	onAddYourself: () => void;
	onAddSomeoneElse: () => void;
}

/** First sign-in, nothing here yet: start with one person — probably you. */
export const WelcomeState = ({
	firstName,
	email,
	onAddYourself,
	onAddSomeoneElse,
}: WelcomeStateProps) => (
	<SectionCard>
		<EmptyState
			icon={<IconPeople />}
			title={WELCOME.title(firstName)}
			actions={
				<>
					<Button
						variant="contained"
						size="large"
						startIcon={<IconAdd />}
						onClick={onAddYourself}
						sx={{ flex: { xs: "1 1 100%", sm: "none" } }}
					>
						{WELCOME.addYourself}
					</Button>
					<Button
						variant="outlined"
						size="large"
						startIcon={<IconAddPerson />}
						onClick={onAddSomeoneElse}
						sx={{ flex: { xs: "1 1 100%", sm: "none" } }}
					>
						{WELCOME.addSomeoneElse}
					</Button>
				</>
			}
			sx={{ pb: { xs: 2, md: 3 } }}
		>
			{WELCOME.body}
		</EmptyState>
		<Box sx={{ maxWidth: 560, mx: "auto", pb: { xs: 1, md: 3 } }}>
			<Banner icon={<IconInbox fontSize="inherit" />}>
				{WELCOME.expectingLead}
				<Box component="b" sx={{ overflowWrap: "anywhere" }}>
					{email}
				</Box>
				.
			</Banner>
		</Box>
	</SectionCard>
);
