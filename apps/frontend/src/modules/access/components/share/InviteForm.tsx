import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { FormControl, FormLabel } from "@connected-repo/ui-mui/form/FormControl";
import { InputAdornment } from "@connected-repo/ui-mui/form/InputAdornment";
import { TextField } from "@connected-repo/ui-mui/form/TextField";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconAlert, IconCheck, IconMail } from "@connected-repo/ui-mui/kosh/icons";
import { LEVEL_LABEL } from "@connected-repo/ui-mui/kosh/LevelBadge";
import { Segmented } from "@connected-repo/ui-mui/kosh/Segmented";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link } from "@connected-repo/ui-mui/navigation/Link";
import type { AccessLevel } from "@connected-repo/zod-schemas/enums.zod";
import { LEVEL_SUMMARY } from "@frontend/copy/levels.copy";
import { SHARING } from "@frontend/copy/sharing.copy";
import { possessive } from "@frontend/modules/access/people.utils";
import type { FormEvent, ReactNode, RefObject } from "react";
import { ChoiceRows } from "../ChoiceRows";
import { LEVELS, levelIcon } from "../levels";
import type { EmailProblem } from "./share.utils";

interface InviteFormProps {
	/** Phone: its own step, with each level explained. Desktop: above the people list. */
	phone: boolean;
	formId: string;
	inputRef: RefObject<HTMLInputElement | null>;
	email: string;
	onEmail: (email: string) => void;
	level: AccessLevel;
	onLevel: (level: AccessLevel) => void;
	problem: EmailProblem | null;
	/** "Use gmail.com" */
	onUseSuggestion: () => void;
	/** "Keep gmial.com" */
	onKeepTyped: () => void;
	/** "Change on Anil" — present when the holder's access is theirs to change. */
	onChangeOnHolder?: () => void;
	holderFirstName: string;
	/** What "this" is for someone who already has it: "this", or "all of Anil's accounts". */
	whatHere: string;
	/** The "Next" button sits in the form (desktop); on a phone it is in the sheet's footer. */
	showNext: boolean;
	onNext: () => void;
}

const LEVEL_OPTIONS = LEVELS.map((value) => ({
	value,
	label: LEVEL_LABEL[value],
	icon: levelIcon(value, "small"),
}));

/** Who to invite and what they may do. Nothing is sent from here — "Next" goes to the check. */
export const InviteForm = ({
	phone,
	formId,
	inputRef,
	email,
	onEmail,
	level,
	onLevel,
	problem,
	onUseSuggestion,
	onKeepTyped,
	onChangeOnHolder,
	holderFirstName,
	whatHere,
	showNext,
	onNext,
}: InviteFormProps) => {
	const submit = (event: FormEvent) => {
		event.preventDefault();
		onNext();
	};

	let fieldHelp: ReactNode = phone ? SHARING.inviteHelp : undefined;
	if (problem?.kind === "invalid") fieldHelp = SHARING.notEmail;
	if (problem?.kind === "self") fieldHelp = SHARING.thatsYou;
	if (problem?.kind === "refused") fieldHelp = problem.message;
	if (problem?.kind === "typo")
		fieldHelp = (
			<Box component="span" sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
				<IconAlert sx={{ fontSize: 16, mt: "1px", flex: "none" }} aria-hidden />
				<span>
					{SHARING.typo(problem.typedDomain)}
					<Box component="b" sx={{ overflowWrap: "anywhere" }}>
						{problem.suggestion}
					</Box>
					?
				</span>
			</Box>
		);
	const fieldError =
		problem !== null && ["invalid", "self", "refused", "typo"].includes(problem.kind);

	return (
		<Box
			component="form"
			id={formId}
			noValidate
			onSubmit={submit}
			sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}
		>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
				<TextField
					inputRef={inputRef}
					type="email"
					label={phone ? SHARING.inviteLabelPhone : SHARING.inviteLabel}
					placeholder={SHARING.invitePlaceholder}
					value={email}
					onChange={(event) => onEmail(event.target.value)}
					error={fieldError}
					helperText={fieldHelp}
					fullWidth
					autoComplete="off"
					slotProps={{
						htmlInput: {
							inputMode: "email",
							autoCapitalize: "none",
							spellCheck: false,
							maxLength: 320,
						},
						input: {
							startAdornment: (
								<InputAdornment position="start">
									<IconMail aria-hidden />
								</InputAdornment>
							),
						},
						formHelperText: { role: fieldError ? "alert" : undefined },
					}}
				/>

				{problem?.kind === "typo" && (
					<>
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
							<Button variant="outlined" startIcon={<IconCheck />} onClick={onUseSuggestion}>
								{SHARING.acceptDomain(problem.suggestedDomain)}
							</Button>
							<Button variant="text" onClick={onKeepTyped}>
								{SHARING.keepDomain(problem.typedDomain)}
							</Button>
						</Box>
						<Typography variant="caption">{SHARING.typoMatters}</Typography>
					</>
				)}

				{problem?.kind === "covered" && (
					<Banner>
						{SHARING.covered(problem.name, level, problem.got, possessive(holderFirstName))}
						{onChangeOnHolder && (
							<>
								{" "}
								<Link component="button" type="button" onClick={onChangeOnHolder}>
									{SHARING.changeOn(holderFirstName)}
								</Link>
							</>
						)}
					</Banner>
				)}
				{problem?.kind === "same" && (
					<Banner>{SHARING.alreadyHas(problem.name, level, whatHere)}</Banner>
				)}
			</Box>

			{phone ? (
				<ChoiceRows<AccessLevel>
					label={SHARING.levelLabelPhone}
					name="invite-level"
					value={level}
					onChange={onLevel}
					options={LEVELS.map((value) => ({
						value,
						title: LEVEL_LABEL[value],
						icon: levelIcon(value),
						hint: LEVEL_SUMMARY[value],
					}))}
				/>
			) : (
				<FormControl component="fieldset" sx={{ minWidth: 0 }}>
					<FormLabel component="legend" sx={{ mb: 0.75, p: 0 }}>
						{SHARING.levelLabel}
					</FormLabel>
					<Segmented<AccessLevel>
						ariaLabel={SHARING.levelLabel}
						fullWidth
						value={level}
						onChange={onLevel}
						options={LEVEL_OPTIONS}
					/>
					<Typography variant="caption" aria-live="polite" sx={{ mt: 0.75 }}>
						{LEVEL_SUMMARY[level]}
					</Typography>
				</FormControl>
			)}

			{showNext && (
				<Button type="submit" variant="contained" sx={{ alignSelf: "flex-end" }}>
					{SHARING.next}
				</Button>
			)}
		</Box>
	);
};
