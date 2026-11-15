import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Paper } from "@connected-repo/ui-mui/layout/Paper";
import { AppBar } from "@connected-repo/ui-mui/navigation/AppBar";
import { BottomNavigation } from "@connected-repo/ui-mui/navigation/BottomNavigation";
import { BottomNavigationAction } from "@connected-repo/ui-mui/navigation/BottomNavigationAction";
import { Toolbar } from "@connected-repo/ui-mui/navigation/Toolbar";
import { UserProfileMenu } from "@frontend/components/layout/UserProfileMenu";
import { NovuInbox } from "@frontend/components/notifications/NovuInbox";
import { navItems } from "@frontend/configs/nav.config";
import { useLocation, useNavigate } from "react-router";

export const MobileNavbar = () => {
	const navigate = useNavigate();
	const location = useLocation();


	const getBottomNavValue = () => {
		const navIndex = navItems.findIndex(
			(item) => item.path === location.pathname,
		);
		if (navIndex !== -1) return navIndex;
		if (location.pathname === "/profile") return navItems.length;
		return 0;
	};

	const handleBottomNavChange = (
		_event: React.SyntheticEvent,
		newValue: number,
	) => {
		if (newValue === navItems.length) {
			navigate("/profile");
			return;
		}
		const item = navItems[newValue];
		if (item) navigate(item.path);
	};

	return (
		<>
			<AppBar
				position="sticky"
				elevation={0}
				sx={{
					bgcolor: "background.paper",
					borderBottom: "1px solid",
					borderColor: "divider",
				}}
			>
				<Toolbar
					sx={{
						minHeight: 56,
						px: 2,
						justifyContent: "space-between",
					}}
				>
					<Box
						onClick={() => navigate("/dashboard")}
						sx={{
							display: "flex",
							alignItems: "center",
							cursor: "pointer",
							gap: 1,
						}}
					>
						<Typography
							variant="h6"
							component="div"
							sx={{
								fontWeight: 700,
								color: "primary.main",
								letterSpacing: -0.5,
							}}
						>
							Kosh
						</Typography>
					</Box>

					<NovuInbox />
					<UserProfileMenu />
				</Toolbar>
			</AppBar>

			<Paper
				sx={{
					position: "fixed",
					bottom: 0,
					left: 0,
					right: 0,
					zIndex: 1000,
					borderTop: "1px solid",
					borderColor: "divider",
				}}
				elevation={3}
			>
				<BottomNavigation
					value={getBottomNavValue()}
					onChange={handleBottomNavChange}
					showLabels
					sx={{
						height: 64,
						"& .MuiBottomNavigationAction-root": {
							minWidth: 60,
							px: 0,
							transition: "all 0.2s ease-in-out",
							"&.Mui-selected": {
								color: "primary.main",
								"& .MuiSvgIcon-root": { transform: "scale(1.1)" },
							},
							"&:active": { transform: "scale(0.95)" },
						},
					}}
				>
					{navItems.map((item) => (
						<BottomNavigationAction
							key={item.path}
							label={item.label}
							icon={item.mobileIcon || item.desktopIcon}
							sx={{ "&:hover": { bgcolor: "action.hover" } }}
						/>
					))}
				</BottomNavigation>
			</Paper>
		</>
	);
};
