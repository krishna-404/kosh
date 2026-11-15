import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { CompareBar, DivergingBar, ProgressTrack } from "@connected-repo/ui-mui/kosh/Bars";
import { BrokerMark } from "@connected-repo/ui-mui/kosh/BrokerMark";
import { EmptyState, SpotIcon } from "@connected-repo/ui-mui/kosh/EmptyState";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { AvatarStack, HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import {
	IconAdd,
	IconAddPerson,
	IconAlert,
	IconClock,
	IconGroup,
	IconInbox,
	IconMail,
	IconMore,
	IconOwner,
	IconUpload,
} from "@connected-repo/ui-mui/kosh/icons";
import { KoshWordmark } from "@connected-repo/ui-mui/kosh/KoshMark";
import { LevelBadge } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Money, Percent } from "@connected-repo/ui-mui/kosh/Money";
import { PageHeader } from "@connected-repo/ui-mui/kosh/PageHeader";
import { ConfirmDialog, ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { RowItem, RowList } from "@connected-repo/ui-mui/kosh/RowItem";
import { HeroCard, SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { useSnack } from "@connected-repo/ui-mui/kosh/SnackProvider";
import { Stat } from "@connected-repo/ui-mui/kosh/Stat";
import { Tag } from "@connected-repo/ui-mui/kosh/Tag";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { IconButton } from "@connected-repo/ui-mui/navigation/IconButton";
import { type ThemeMode, useThemeMode } from "@connected-repo/ui-mui/theme/ThemeProvider";
import { useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { type ReactNode, useState } from "react";

/**
 * The component gallery: every shared component, in the theme on screen.
 * Development and test builds only. It is the reference for "does a kit
 * component already do this?" and the page Playwright screenshots to catch
 * a shared component changing by accident.
 */

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
	<SectionCard title={title} component="section">
		<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>{children}</Box>
	</SectionCard>
);

const Swatches = () => {
	const theme = useTheme();
	const names = Object.keys(theme.palette.kosh).filter((name) => !name.startsWith("shadow"));
	return (
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))",
				gap: 1.5,
				width: "100%",
			}}
		>
			{names.map((name) => (
				<Box key={name}>
					<Box
						sx={(t) => ({
							height: 44,
							borderRadius: 1,
							border: `1px solid ${t.vars.palette.kosh.line}`,
							bgcolor: t.vars.palette.kosh[name as keyof typeof t.vars.palette.kosh],
						})}
					/>
					<Typography variant="caption">{name}</Typography>
				</Box>
			))}
		</Box>
	);
};

const PEOPLE = [
	{ id: "p1", name: "Anil Mehta" },
	{ id: "p2", name: "Sunita Mehta" },
	{ id: "p3", name: "Riya Mehta" },
	{ id: "p4", name: "Ramesh Iyer" },
	{ id: "p5", name: "Priya Nair" },
	{ id: "p6", name: "Vikram Sethi" },
];

export default function KitPage() {
	const { mode, setThemeMode } = useThemeMode();
	const snack = useSnack();
	const [period, setPeriod] = useState<"1y" | "3y" | "all">("3y");
	const [kind, setKind] = useState<"family" | "manager" | "personal" | "friends">("family");
	const [dialog, setDialog] = useState(false);
	const [confirm, setConfirm] = useState(false);

	return (
		<Box
			sx={{
				maxWidth: 1100,
				mx: "auto",
				p: { xs: 2, md: 4 },
				display: "flex",
				flexDirection: "column",
				gap: 2.5,
			}}
		>
			<PageHeader
				titleInAppBarOnPhone={false}
				eyebrow="Kosh design system"
				title="Component gallery"
				subtitle="Every shared component, drawn from the theme. If a screen needs something that is not here, it is added here first."
				actions={
					<Segmented<ThemeMode>
						ariaLabel="Colour theme"
						value={mode}
						onChange={setThemeMode}
						options={[
							{ value: "system", label: "Device" },
							{ value: "light", label: "Light" },
							{ value: "dark", label: "Dark" },
						]}
					/>
				}
			/>

			<Section title="Brand">
				<KoshWordmark />
			</Section>

			<Section title="Colour tokens">
				<Swatches />
			</Section>

			<Section title="Type">
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
					<Typography variant="h1">Accounts and people</Typography>
					<Typography variant="h2">Keep this family together</Typography>
					<Typography variant="h3">People with access</Typography>
					<Typography>Body — every deposit and withdrawal counted, on the day it happened.</Typography>
					<Typography variant="body2">Small — Sunita will see this account too.</Typography>
					<Typography variant="caption">Tiny — sent yesterday 21:10 · works until 30 Nov</Typography>
					<Typography variant="eyebrow">Eyebrow — Your money</Typography>
					<Typography variant="figure">₹2,06,22,000</Typography>
				</Box>
			</Section>

			<Section title="Buttons">
				<Button variant="contained" startIcon={<IconAdd />}>
					Add a person
				</Button>
				<Button variant="outlined" startIcon={<IconAddPerson />}>
					Share
				</Button>
				<Button variant="text">Not now</Button>
				<Button variant="contained" color="error">
					Remove now
				</Button>
				<Button variant="text" color="error">
					Cancel invite
				</Button>
				<Button variant="contained" size="large">
					Send invite · Can edit
				</Button>
				<Button variant="contained" disabled>
					Disabled
				</Button>
				<IconButton aria-label="More">
					<IconMore />
				</IconButton>
			</Section>

			<Section title="Levels">
				<LevelBadge level="view" />
				<LevelBadge level="edit" />
				<LevelBadge level="owner" />
				<LevelBadge level="view" size="lg" />
				<LevelBadge level="edit" size="lg" />
				<LevelBadge level="owner" size="lg" />
				<LevelBadge level="owner" label="1" />
				<LevelBadge level="view" label="3" />
			</Section>

			<Section title="Tags">
				<Tag>Fund manager</Tag>
				<Tag tone="pending" icon={<IconClock />}>
					Invited
				</Tag>
				<Tag tone="new">New</Tag>
				<Tag tone="bad">No longer shared</Tag>
			</Section>

			<Section title="People and brokers">
				<HolderAvatar name="Anil Mehta" colorKey="p1" size="lg" />
				<HolderAvatar name="Sunita Mehta" colorKey="p2" />
				<HolderAvatar name="Riya Mehta" colorKey="p3" size="sm" />
				<HolderAvatar name="Kabir Mehta" kind="no_login" />
				<HolderAvatar name="Anil Mehta HUF" colorKey="p7" kind="huf" />
				<HolderAvatar name="Invite" size="sm">
					<IconMail />
				</HolderAvatar>
				<AvatarStack people={PEOPLE} max={4} />
				<BrokerMark broker="Zerodha" />
				<BrokerMark broker="Groww" />
				<BrokerMark broker="Dhan" />
			</Section>

			<SectionCard title="Rows" padding="none">
				<RowList>
					<RowItem
						leading={<BrokerMark broker="Zerodha" />}
						primary="Anil · Zerodha"
						secondary="3 questions waiting"
						trailing={
							<>
								<Money value="8420000" />
								<LevelBadge level="owner" />
							</>
						}
						onClick={() => undefined}
					/>
					<RowItem
						leading={<HolderAvatar name="Priya Nair" colorKey="p5" size="sm" />}
						primary="Priya Nair"
						secondary="Only this account"
						trailing={<LevelBadge level="view" />}
					/>
					<RowItem
						leading={
							<HolderAvatar name="Invite" size="sm">
								<IconMail />
							</HolderAvatar>
						}
						primary="vikram.sethi@gmail.com"
						secondary="Sent yesterday 21:10 · not signed in yet"
						trailing={
							<Tag tone="pending" icon={<IconClock />}>
								Invited
							</Tag>
						}
					/>
				</RowList>
			</SectionCard>

			<Section title="Inputs">
				<TextField label="Their email" placeholder="name@example.com" sx={{ width: 280 }} />
				<TextField
					label="Their email"
					defaultValue="vikram.sethi@gmial.com"
					error
					helperText="“gmial.com” looks like a typo."
					sx={{ width: 280 }}
				/>
			</Section>

			<Section title="Choices">
				<Segmented
					ariaLabel="Period"
					value={period}
					onChange={setPeriod}
					options={[
						{ value: "1y", label: "1 year" },
						{ value: "3y", label: "3 years" },
						{ value: "all", label: "Since the start" },
					]}
				/>
				<FilterChips
					ariaLabel="Kind of group"
					showCheck
					value={kind}
					onChange={setKind}
					options={[
						{ value: "family", label: "Family" },
						{ value: "manager", label: "Fund manager" },
						{ value: "personal", label: "Personal" },
						{ value: "friends", label: "Friends" },
					]}
				/>
			</Section>

			<SectionCard title="Banners">
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					<Banner icon={<IconInbox fontSize="inherit" />}>
						Expecting someone to share with you? It appears here as soon as they do.
					</Banner>
					<Banner tone="warn">Owners can share this account with others and remove you.</Banner>
					<Banner
						tone="bad"
						action={
							<Button variant="contained" color="error">
								Remove now
							</Button>
						}
					>
						<b>Someone signed in with this address 2 hours ago</b> and can view Anil · Groww.
					</Banner>
					<Banner tone="good">
						<b>Nobody has signed in with it.</b> Cancel now and the link stops working straight away.
					</Banner>
				</Box>
			</SectionCard>

			<HeroCard>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr 1fr" },
						gap: 3,
					}}
				>
					<Stat
						size="lg"
						label="Value today"
						value={<Money value="20622000" figure />}
						hint="Everything you can see"
					/>
					<Stat
						label="Your return"
						value={<Percent value={0.139} tone="pos" />}
						hint="a year, timing included"
					/>
					<Stat
						label="Same money in NIFTY 50"
						value={<Percent value={0.128} />}
						hint={
							<>
								<Money value="762000" tone="pos" /> ahead
							</>
						}
					/>
				</Box>
			</HeroCard>

			<SectionCard title="Figures and bars">
				<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
					<Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
						<Money value="13595000" />
						<Money value="13595000" notation="compact" />
						<Money value="6810000" sign="always" spacedSign tone="auto" />
						<Money value="-130000" sign="always" spacedSign tone="auto" />
						<Percent value={0.024} sign="always" suffix=" pts" tone="auto" />
						<Percent value={-0.089} sign="always" suffix=" pts" tone="auto" />
						<Money value={null} />
					</Box>
					<CompareBar label="Sunita’s own" value={1} figure={<Money value="14800000" notation="compact" />} color="alt" />
					<CompareBar label="Ramesh" value={0.95} figure={<Money value="14100000" notation="compact" />} emphasis />
					<CompareBar label="NIFTY 50" value={0.92} figure={<Money value="13700000" notation="compact" />} color="nifty" />
					<CompareBar label="Gold" value={0.8} figure={<Money value="11900000" notation="compact" />} color="gold" />
					<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
						<DivergingBar value={2.4} max={9} />
						<DivergingBar value={-8.9} max={9} />
						<ProgressTrack value={0.6} ariaLabel="History complete" sx={{ width: 200 }} />
					</Box>
				</Box>
			</SectionCard>

			<Section title="Overlays">
				<Button variant="outlined" onClick={() => setDialog(true)}>
					Open dialog / sheet
				</Button>
				<Button variant="outlined" onClick={() => setConfirm(true)}>
					Open confirm
				</Button>
				<Button
					variant="outlined"
					startIcon={<IconUpload />}
					onClick={() =>
						snack({
							message: "Tradebook Oct 2026.csv added — 214 lines",
							actionLabel: "Undo",
							onAction: () => snack("Upload undone"),
						})
					}
				>
					Show snackbar
				</Button>
				<SpotIcon size="sm">
					<IconGroup />
				</SpotIcon>
				<SpotIcon>
					<IconOwner />
				</SpotIcon>
				<SpotIcon tone="warn">
					<IconAlert />
				</SpotIcon>
			</Section>

			<SectionCard>
				<EmptyState
					icon={<IconInbox />}
					title="Nothing is shared with you yet"
					actions={<Button variant="contained">Add yourself</Button>}
				>
					When someone shares an account with you, it appears here with what you can do with it.
				</EmptyState>
			</SectionCard>

			<ResponsiveDialog
				open={dialog}
				onClose={() => setDialog(false)}
				title="Invite to Anil · Groww"
				subtitle="They sign in with this address to see it."
				actions={
					<>
						<Button variant="text" onClick={() => setDialog(false)}>
							Cancel
						</Button>
						<Button variant="contained" onClick={() => setDialog(false)}>
							Check what they’ll see
						</Button>
					</>
				}
			>
				<TextField label="Their email" placeholder="name@example.com" fullWidth />
			</ResponsiveDialog>

			<ConfirmDialog
				open={confirm}
				icon={<IconOwner />}
				title="Riya · Dhan needs an owner"
				confirmLabel="Choose a new owner"
				cancelLabel="Keep me as owner"
				onConfirm={() => setConfirm(false)}
				onCancel={() => setConfirm(false)}
			>
				You’re its only owner. Make someone else an owner first, so someone can still decide who
				sees it.
			</ConfirmDialog>
		</Box>
	);
}
