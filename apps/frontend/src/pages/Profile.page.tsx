import { Avatar } from "@connected-repo/ui-mui/data-display/Avatar";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Card } from "@connected-repo/ui-mui/layout/Card";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Stack } from "@connected-repo/ui-mui/layout/Stack";
import { AppVersionLabel } from "@frontend/components/AppVersionLabel";
import { NotificationSettings } from "@frontend/components/notifications/NotificationSettings";
import { useSessionInfo } from "@frontend/contexts/UserContext";

export default function ProfilePage() {
	const { user } = useSessionInfo();

	if (!user) return null;

	return (
		<Container maxWidth="md" sx={{ py: 4 }}>
			<Stack spacing={4}>
				<Box>
					<Typography variant="h3" sx={{ fontWeight: 800 }}>
						Profile & Settings
					</Typography>
					<Typography variant="body1" color="text.secondary">
						Manage your account and notifications.
					</Typography>
				</Box>

				<Card sx={{ p: 3, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
					<Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
						<Avatar
							src={user.image || undefined}
							alt={user.name}
							sx={{ width: 80, height: 80, bgcolor: "primary.main" }}
						>
							{!user.image && (user.name?.charAt(0) || "?")}
						</Avatar>
						<Box sx={{ flexGrow: 1 }}>
							<Typography variant="h5" sx={{ fontWeight: 700 }}>
								{user.name}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{user.email}
							</Typography>
							{user.phoneNumber && (
								<Typography variant="body2" color="text.secondary">
									{user.phoneNumber}
								</Typography>
							)}
							<Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
								Timezone: {user.timezone}
							</Typography>
						</Box>
					</Stack>
				</Card>

				<NotificationSettings />

				<AppVersionLabel prefix="Kosh · " />
			</Stack>
		</Container>
	);
}
