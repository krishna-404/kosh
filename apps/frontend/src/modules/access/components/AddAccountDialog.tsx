import { Button } from "@connected-repo/ui-mui/form/Button";
import { FormControl, FormLabel } from "@connected-repo/ui-mui/form/FormControl";
import { MenuItem } from "@connected-repo/ui-mui/form/MenuItem";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { FilterChips } from "@connected-repo/ui-mui/kosh/FilterChips";
import { HolderAvatar } from "@connected-repo/ui-mui/kosh/HolderAvatar";
import { IconPeople } from "@connected-repo/ui-mui/kosh/icons";
import { ResponsiveDialog } from "@connected-repo/ui-mui/kosh/ResponsiveDialog";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import type { Broker } from "@connected-repo/zod-schemas/enums.zod";
import type { DirectoryHolder } from "@connected-repo/zod-schemas/kosh/people.zod";
import { ADD_ACCOUNT } from "@frontend/copy/accounts.copy";
import { BROKER_LABEL } from "@frontend/copy/levels.copy";
import { useRefreshPeople } from "@frontend/modules/access/people.queries";
import {
	defaultAccountLabel,
	errorWords,
	firstNameOf,
	possessive,
} from "@frontend/modules/access/people.utils";
import { orpc } from "@frontend/utils/orpc.tanstack.client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";

interface AddAccountDialogProps {
	open: boolean;
	onClose: () => void;
	/** The holders the signed-in person owns — the only ones they can add an account to. */
	holders: readonly DirectoryHolder[];
	/** Start on this holder (opened from their card). */
	initialHolderId?: string | null;
	onAdded: (account: { id: string; label: string }) => void;
	/** "Change" in the who-else-will-see note: open sharing for that holder. */
	onChangeAccess: (personId: string) => void;
}

const BROKERS: readonly Broker[] = ["zerodha", "groww", "dhan", "manual"];

const HolderOption = ({ holder }: { holder: DirectoryHolder }) => (
	<Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
		<HolderAvatar name={holder.displayName} colorKey={holder.id} kind={holder.kind} size="xs" />
		<Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
			{holder.displayName}
		</Box>
	</Box>
);

/**
 * Add a broker account for someone you own. Before the button is pressed it
 * says who else will see the new account — people with access to all of that
 * person's accounts get new ones too.
 */
export const AddAccountDialog = ({
	open,
	onClose,
	holders,
	initialHolderId,
	onAdded,
	onChangeAccess,
}: AddAccountDialogProps) => {
	const formId = useId();
	const refresh = useRefreshPeople();
	const create = useMutation(orpc.portfolio.createAccount.mutationOptions());

	const [personId, setPersonId] = useState("");
	const [broker, setBroker] = useState<Broker>("zerodha");
	const [brokerName, setBrokerName] = useState("");
	/** Null until the person types a name of their own; until then it follows holder and broker. */
	const [ownLabel, setOwnLabel] = useState<string | null>(null);
	const [missing, setMissing] = useState<"brokerName" | "label" | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	// Each opening starts clean, on the holder it was opened for.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on opening only, not while the list refreshes behind the dialog
	useEffect(() => {
		if (!open) return;
		const start = holders.find((h) => h.id === initialHolderId) ?? holders[0];
		setPersonId(start?.id ?? "");
		setBroker("zerodha");
		setBrokerName("");
		setOwnLabel(null);
		setMissing(null);
		setFailure(null);
	}, [open, initialHolderId]);

	const holder = holders.find((h) => h.id === personId);
	const brokerWords =
		broker === "manual" ? brokerName.trim() || BROKER_LABEL.manual : BROKER_LABEL[broker];
	const label = ownLabel ?? (holder ? defaultAccountLabel(holder.displayName, brokerWords) : "");

	// Who has all of this holder's accounts — they get the new one as well.
	const access = useQuery(
		orpc.access.list.queryOptions({
			input: { personId },
			enabled: open && personId !== "",
		}),
	);
	const others = (access.data?.holderWide ?? []).filter((entry) => !entry.isMe && !entry.expired);
	const sameLevel = others.every((entry) => entry.level === others[0]?.level);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!holder) return;
		if (broker === "manual" && !brokerName.trim()) return setMissing("brokerName");
		if (!label.trim()) return setMissing("label");
		setFailure(null);
		try {
			const { id } = await create.mutateAsync({
				personId: holder.id,
				broker,
				brokerName: broker === "manual" ? brokerName.trim() : undefined,
				label: label.trim(),
			});
			await refresh();
			onAdded({ id, label: label.trim() });
			onClose();
		} catch (error) {
			setFailure(errorWords(error, ADD_ACCOUNT.failed));
		}
	};

	return (
		<ResponsiveDialog
			open={open}
			onClose={onClose}
			title={ADD_ACCOUNT.title}
			maxWidth="xs"
			actions={
				<>
					<Button variant="text" onClick={onClose} disabled={create.isPending}>
						{ADD_ACCOUNT.cancel}
					</Button>
					<Button
						type="submit"
						form={formId}
						variant="contained"
						size="large"
						disabled={create.isPending || !holder}
					>
						{ADD_ACCOUNT.submit}
					</Button>
				</>
			}
		>
			<Box
				component="form"
				id={formId}
				noValidate
				onSubmit={submit}
				sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}
			>
				<TextField
					select
					label={ADD_ACCOUNT.whose}
					value={holder ? personId : ""}
					onChange={(event) => setPersonId(event.target.value)}
					fullWidth
					slotProps={{
						select: {
							renderValue: () => (holder ? <HolderOption holder={holder} /> : null),
						},
					}}
				>
					{holders.map((h) => (
						<MenuItem key={h.id} value={h.id}>
							<HolderOption holder={h} />
						</MenuItem>
					))}
				</TextField>

				<FormControl component="fieldset" sx={{ minWidth: 0 }}>
					<FormLabel component="legend" sx={{ mb: 0.75, p: 0 }}>
						{ADD_ACCOUNT.broker}
					</FormLabel>
					<FilterChips<Broker>
						ariaLabel={ADD_ACCOUNT.broker}
						showCheck
						value={broker}
						onChange={(next) => {
							setBroker(next);
							setMissing(null);
						}}
						options={BROKERS.map((value) => ({ value, label: BROKER_LABEL[value] }))}
					/>
				</FormControl>

				{broker === "manual" && (
					<TextField
						label={ADD_ACCOUNT.brokerName}
						placeholder={ADD_ACCOUNT.brokerNamePlaceholder}
						value={brokerName}
						onChange={(event) => {
							setBrokerName(event.target.value);
							setMissing(null);
						}}
						error={missing === "brokerName"}
						helperText={missing === "brokerName" ? ADD_ACCOUNT.brokerNameMissing : undefined}
						autoFocus
						fullWidth
						autoComplete="off"
						slotProps={{ htmlInput: { maxLength: 60 } }}
					/>
				)}

				<TextField
					label={ADD_ACCOUNT.label}
					value={label}
					onChange={(event) => {
						setOwnLabel(event.target.value);
						setMissing(null);
					}}
					error={missing === "label"}
					helperText={missing === "label" ? ADD_ACCOUNT.labelMissing : undefined}
					fullWidth
					autoComplete="off"
					slotProps={{ htmlInput: { maxLength: 120 } }}
				/>

				{holder && others.length > 0 && (
					<Banner tone="warn" icon={<IconPeople fontSize="inherit" />}>
						<b>
							{ADD_ACCOUNT.willSee(
								others.map((entry) => (entry.name ? firstNameOf(entry.name) : entry.email)),
							)}
						</b>{" "}
						{ADD_ACCOUNT.willSeeWhy(
							sameLevel && others[0] ? others[0].level : "mixed",
							possessive(firstNameOf(holder.displayName)),
						)}{" "}
						<Link
							component="button"
							type="button"
							color="inherit"
							underline="always"
							onClick={() => {
								onClose();
								onChangeAccess(holder.id);
							}}
						>
							{ADD_ACCOUNT.change}
						</Link>
					</Banner>
				)}
				{failure && <Banner tone="bad">{failure}</Banner>}
			</Box>
		</ResponsiveDialog>
	);
};
