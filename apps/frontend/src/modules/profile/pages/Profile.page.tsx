import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { AppVersionLabel } from "@frontend/components/AppVersionLabel";
import { Page } from "@frontend/components/layout/Page";
import { NotificationSettings } from "@frontend/components/notifications/NotificationSettings";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import { NAV } from "@frontend/copy/nav.copy";
import { PROFILE } from "@frontend/copy/profile.copy";
import { FeedsCard } from "@frontend/modules/profile/components/FeedsCard";

export default function ProfilePage() {
	const { user } = useSessionInfo();
	if (!user) return null;

	return (
		<Page title={NAV.profile} subtitle={PROFILE.subtitle}>
			<SectionCard>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					<HolderAvatar name={user.name || user.email || "You"} colorKey={user.id} size="lg" />
					<Box sx={{ minWidth: 0 }}>
						<Typography variant="h2" component="div" noWrap>
							{user.name}
						</Typography>
						<Typography color="text.secondary" noWrap>
							{user.email}
						</Typography>
						<Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
							Times are shown in {user.timezone}. People share accounts with you using{" "}
							{user.email}.
						</Typography>
					</Box>
				</Box>
			</SectionCard>

			<NotificationSettings />

			<FeedsCard />

			<AppVersionLabel prefix="Kosh · " />
		</Page>
	);
}
