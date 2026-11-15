import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import {
	IconDark,
	IconDevice,
	IconLight,
	IconSettings,
	IconSignOut,
} from "@connected-repo/ui-mui/kosh/icons";
import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Divider } from "@connected-repo/ui-mui/layout/Divider";
import { Menu } from "@connected-repo/ui-mui/navigation/Menu";
import { type ThemeMode, useThemeMode } from "@connected-repo/ui-mui/theme/ThemeProvider";
import { menuItems } from "@frontend/configs/nav.config";
import { useSessionInfo } from "@frontend/contexts/UserContext";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import { signout } from "@frontend/utils/signout.utils";
import { useNavigate } from "react-router";

const THEME_OPTIONS = [
	{ value: "system", label: "Device", icon: <IconDevice /> },
	{ value: "light", label: "Light", icon: <IconLight /> },
	{ value: "dark", label: "Dark", icon: <IconDark /> },
] as const;

interface UserMenuProps {
	anchorEl: HTMLElement | null;
	onClose: () => void;
	/** On a phone the menu also lists the pages that have no tab. */
	withDestinations?: boolean;
	placement?: "above" | "below";
}

/** Theme, the pages a phone has no tab for, profile and sign out. */
export const UserMenu = ({
	anchorEl,
	onClose,
	withDestinations = false,
	placement = "below",
}: UserMenuProps) => {
	const navigate = useNavigate();
	const { user } = useSessionInfo();
	const { mode, setThemeMode } = useThemeMode();

	const go = (path: string) => {
		onClose();
		navigate(path);
	};

	return (
		<Menu
			anchorEl={anchorEl}
			open={Boolean(anchorEl)}
			onClose={onClose}
			anchorOrigin={{ horizontal: "right", vertical: placement === "above" ? "top" : "bottom" }}
			transformOrigin={{
				horizontal: "right",
				vertical: placement === "above" ? "bottom" : "top",
			}}
			slotProps={{ paper: { sx: { width: 300, mt: placement === "above" ? -1 : 1 } } }}
		>
			{user && (
				<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1 }}>
					<HolderAvatar name={user.name || user.email || "You"} colorKey={user.id} />
					<Box sx={{ minWidth: 0 }}>
						<Typography variant="subtitle2" noWrap>
							{user.name}
						</Typography>
						<Typography variant="caption" component="div" noWrap>
							{user.email}
						</Typography>
					</Box>
				</Box>
			)}
			<Box sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
				<Segmented<ThemeMode>
					ariaLabel="Colour theme"
					fullWidth
					size="sm"
					options={THEME_OPTIONS}
					value={mode}
					onChange={setThemeMode}
				/>
			</Box>
			<Divider sx={{ my: 0.5 }} />
			{withDestinations &&
				menuItems.map((item) => (
					<MenuItem key={item.path} onClick={() => go(item.path)}>
						{item.icon}
						{item.label}
					</MenuItem>
				))}
			{withDestinations && <Divider sx={{ my: 0.5 }} />}
			<MenuItem onClick={() => go(ROUTES.profile)}>
				<IconSettings />
				{NAV.profile}
			</MenuItem>
			<MenuItem
				onClick={() => {
					onClose();
					void signout();
				}}
			>
				<IconSignOut />
				{NAV.signOut}
			</MenuItem>
		</Menu>
	);
};
