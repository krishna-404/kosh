import {
	IconAccounts,
	IconActivity,
	IconGrid,
	IconGroup,
	IconInbox,
	IconOverview,
	IconTrend,
} from "@connected-repo/ui-mui/kosh/icons";
import { NAV, ROUTES } from "@frontend/copy/nav.copy";
import type { ReactElement } from "react";

export interface NavItem {
	label: string;
	/** Shorter label for the phone tab bar, where space is tight. */
	shortLabel?: string;
	path: string;
	icon: ReactElement;
	/** Shown in the phone's bottom tab bar (four at most). */
	tab?: boolean;
}

export interface NavSection {
	title: string;
	items: NavItem[];
}

/** The app's destinations, in the order and grouping of the design. */
export const navSections: NavSection[] = [
	{
		title: NAV.sectionMoney,
		items: [
			{ label: NAV.overview, path: ROUTES.overview, icon: <IconOverview />, tab: true },
			{ label: NAV.holdings, path: ROUTES.holdings, icon: <IconTrend />, tab: true },
			{ label: NAV.groups, path: ROUTES.groups, icon: <IconGroup />, tab: true },
		],
	},
	{
		title: NAV.sectionPeople,
		items: [
			{
				label: NAV.accounts,
				shortLabel: NAV.accountsShort,
				path: ROUTES.accounts,
				icon: <IconAccounts />,
				tab: true,
			},
			{ label: NAV.shared, path: ROUTES.shared, icon: <IconInbox /> },
			{ label: NAV.access, path: ROUTES.access, icon: <IconGrid /> },
			{ label: NAV.activity, path: ROUTES.activity, icon: <IconActivity /> },
		],
	},
];

export const navItems: NavItem[] = navSections.flatMap((section) => section.items);
export const tabItems: NavItem[] = navItems.filter((item) => item.tab);
/** Destinations a phone reaches from the menu rather than a tab. */
export const menuItems: NavItem[] = navItems.filter((item) => !item.tab);
