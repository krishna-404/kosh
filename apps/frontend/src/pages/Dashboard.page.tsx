import { Avatar } from "@connected-repo/ui-mui/data-display/Avatar";
import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Fade } from "@connected-repo/ui-mui/feedback/Fade";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Card } from "@connected-repo/ui-mui/layout/Card";
import { Container } from "@connected-repo/ui-mui/layout/Container";
import { Stack } from "@connected-repo/ui-mui/layout/Stack";
import { NotificationBanner } from "@frontend/components/notifications/NotificationBanner";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";

// Placeholder shell for the Kosh portfolio dashboard. The real thing —
// account/group selector, date range, metric tiles (XIRR/TWR/Sharpe),
// and the shadow-portfolio benchmark chart — lands in roadmap M3
// (docs/kosh/05-roadmap.md). Until then this page anchors navigation.
const DashboardPage = () => {
	const { user } = useSessionInfo();

	return (
		<Box
			sx={{
				minHeight: "100vh",
				bgcolor: "background.default",
				py: { xs: 3, md: 4 },
			}}
		>
			<Container maxWidth="lg">
				<Fade in timeout={400}>
					<Stack spacing={4}>
						<NotificationBanner />

						{/* Welcome Header */}
						<Card
							sx={{
								p: { xs: 3, md: 4 },
								background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								borderRadius: 2,
								boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3)",
							}}
						>
							<Stack
								direction={{ xs: "column", sm: "row" }}
								spacing={3}
								alignItems={{ xs: "center", sm: "flex-start" }}
							>
								{user?.image && (
									<Avatar
										src={user.image}
										alt={user.name || undefined}
										sx={{
											width: 80,
											height: 80,
											border: "4px solid rgba(255,255,255,0.3)",
											boxShadow: 3,
										}}
									/>
								)}
								<Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
									<Typography variant="h4" fontWeight={600} gutterBottom>
										Welcome back, {user?.name || "User"}!
									</Typography>
									<Typography variant="body1" sx={{ opacity: 0.9 }}>
										{user?.email}
									</Typography>
								</Box>
							</Stack>
						</Card>

						{/* Portfolio placeholder */}
						<Card
							sx={{
								p: { xs: 4, md: 6 },
								borderRadius: 2,
								border: "1px dashed",
								borderColor: "divider",
								textAlign: "center",
							}}
						>
							<AccountBalanceIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />
							<Typography variant="h5" fontWeight={600} gutterBottom>
								Your family portfolio lives here soon
							</Typography>
							<Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mx: "auto" }}>
								Connect your family's broker accounts by uploading statements, and Kosh will show
								true fund-flow returns — XIRR, TWR, Sharpe — for any member or group, benchmarked
								against the index and gold.
							</Typography>
						</Card>
					</Stack>
				</Fade>
			</Container>
		</Box>
	);
};

export default DashboardPage;
