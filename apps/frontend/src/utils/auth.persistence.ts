const LAST_LOGIN_KEY = "last_login_info";

export interface LastLoginInfo {
	name: string;
	email: string;
	image?: string | null;
}

/**
 * Saves basic user info for display on the login page after logout.
 */
export const saveLastLogin = (user: LastLoginInfo) => {
	try {
		localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({
			name: user.name,
			email: user.email,
			image: user.image,
		}));
	} catch (error) {
		console.error("Failed to save last login info:", error);
	}
};

/**
 * Retrieves the last logged-in user's info.
 */
export const getLastLogin = (): LastLoginInfo | null => {
	try {
		const info = localStorage.getItem(LAST_LOGIN_KEY);
		if (!info) return null;
		return JSON.parse(info);
	} catch (error) {
		console.error("Failed to retrieve last login info:", error);
		return null;
	}
};
