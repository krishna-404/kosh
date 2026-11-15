import { ButtonBase } from "@connected-repo/ui-mui/form/ButtonBase";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";

/**
 * The tabs of a page: a real tab list (roles, arrow keys, Home and End), one
 * panel shown at a time. On a phone the strip scrolls sideways inside itself
 * — never the page — and brings the chosen tab into view.
 *
 * Local to the account page for now: `ui-mui` re-exports no Tabs the app
 * can import, though its theme already styles MUI's. When it does, this
 * should move to the kit (or give way to it) rather than gain a second user.
 */

export interface TabOption<T extends string> {
	value: T;
	label: string;
	/** Something small after the words — a count. */
	badge?: ReactNode;
	/** What a screen reader says when the badge needs words ("…, 3 questions waiting"). */
	ariaLabel?: string;
}

interface TabStripProps<T extends string> {
	tabs: readonly TabOption<T>[];
	value: T;
	onChange: (value: T) => void;
	/** Names the tab list. */
	ariaLabel: string;
	/** Ties each tab to its panel; give the same to <TabPanel>. */
	idBase: string;
}

const tabId = (idBase: string, value: string) => `${idBase}-tab-${value}`;
const panelId = (idBase: string, value: string) => `${idBase}-panel-${value}`;

export const TabStrip = <T extends string>({ tabs, value, onChange, ariaLabel, idBase }: TabStripProps<T>) => {
	const list = useRef<HTMLDivElement>(null);

	// Keep the chosen tab in sight when the strip is wider than the screen.
	// Scrolls the strip only — `scrollIntoView` would move the page as well.
	useEffect(() => {
		const strip = list.current;
		const chosen = document.getElementById(tabId(idBase, value));
		if (!strip || !chosen) return;
		const room = 24;
		const left = chosen.offsetLeft - room;
		const right = chosen.offsetLeft + chosen.offsetWidth + room;
		if (left < strip.scrollLeft) strip.scrollLeft = Math.max(0, left);
		else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth;
	}, [idBase, value]);

	// Arrow keys move between tabs; Enter or Space (a click) opens the one in focus.
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const buttons = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
		const at = buttons.indexOf(document.activeElement as HTMLElement);
		if (at < 0) return;
		const last = buttons.length - 1;
		const next: Record<string, number> = {
			ArrowRight: at === last ? 0 : at + 1,
			ArrowLeft: at === 0 ? last : at - 1,
			Home: 0,
			End: last,
		};
		const to = next[event.key];
		if (to === undefined) return;
		event.preventDefault();
		buttons[to]?.focus();
	};

	return (
		<Box
			ref={list}
			role="tablist"
			aria-label={ariaLabel}
			onKeyDown={onKeyDown}
			sx={(theme) => ({
				position: "relative",
				display: "flex",
				gap: 3,
				// On a phone the strip runs to the screen's edges and scrolls within them.
				mx: { xs: -2, md: 0 },
				px: { xs: 2, md: 0 },
				overflowX: "auto",
				overscrollBehaviorX: "contain",
				scrollbarWidth: "none",
				"&::-webkit-scrollbar": { display: "none" },
				borderBottom: `1px solid ${theme.vars.palette.kosh.line}`,
			})}
		>
			{tabs.map((tab) => {
				const selected = tab.value === value;
				return (
					<ButtonBase
						key={tab.value}
						role="tab"
						id={tabId(idBase, tab.value)}
						aria-selected={selected}
						aria-controls={panelId(idBase, tab.value)}
						aria-label={tab.ariaLabel}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(tab.value)}
						sx={(theme) => {
							const k = theme.vars.palette.kosh;
							return {
								...theme.typography.body1,
								flex: "none",
								minHeight: 46,
								px: 0.5,
								gap: 1,
								fontWeight: 650,
								whiteSpace: "nowrap",
								color: selected ? k.ink : k.ink2,
								// The line under the chosen tab — with `aria-selected`, not colour alone.
								borderBottom: "2.5px solid transparent",
								borderBottomColor: selected ? k.ink : "transparent",
								borderRadius: "8px 8px 0 0",
								transition: theme.transitions.create(["color", "border-color"], { duration: 200 }),
								"&:hover": { color: k.ink },
								"&:focus-visible": { boxShadow: `inset 0 0 0 2px ${k.accent}` },
							};
						}}
					>
						{tab.label}
						{tab.badge}
					</ButtonBase>
				);
			})}
		</Box>
	);
};

interface TabPanelProps {
	idBase: string;
	value: string;
	children: ReactNode;
}

/** The chosen tab's content, tied to its tab for screen readers. */
export const TabPanel = ({ idBase, value, children }: TabPanelProps) => (
	<Box
		role="tabpanel"
		id={panelId(idBase, value)}
		aria-labelledby={tabId(idBase, value)}
		sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.25 }, minWidth: 0 }}
	>
		{children}
	</Box>
);
