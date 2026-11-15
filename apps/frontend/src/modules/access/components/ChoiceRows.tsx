import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { FormControl, FormLabel } from "@connected-repo/ui-mui/form/FormControl";
import { Radio, RadioGroup } from "@connected-repo/ui-mui/form/Radio";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import type { ReactNode } from "react";

interface ChoiceOption<V extends string> {
	value: V;
	title: ReactNode;
	/** One quiet line: what choosing this means. */
	hint?: ReactNode;
	icon?: ReactNode;
}

interface ChoiceRowsProps<V extends string> {
	/** The question, shown above the rows. */
	label: string;
	name: string;
	value: V;
	onChange: (value: V) => void;
	options: readonly ChoiceOption<V>[];
}

/**
 * One choice from a few, each explained in a line — "Who is this?", "What can
 * they do?". Real radio buttons, so arrow keys and screen readers work; the
 * whole row is the target.
 */
export const ChoiceRows = <V extends string>({
	label,
	name,
	value,
	onChange,
	options,
}: ChoiceRowsProps<V>) => (
	<FormControl component="fieldset" sx={{ display: "flex", minWidth: 0 }}>
		<FormLabel component="legend" sx={{ mb: 0.75, p: 0 }}>
			{label}
		</FormLabel>
		<RadioGroup
			name={name}
			value={value}
			onChange={(_event, next) => onChange(next as V)}
			sx={(theme) => ({
				border: `1.5px solid ${theme.vars.palette.kosh.line2}`,
				borderRadius: "14px",
				overflow: "hidden",
				flexWrap: "nowrap",
				"& > * + *": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
			})}
		>
			{options.map((option) => {
				const on = option.value === value;
				return (
					<Box
						key={option.value}
						component="label"
						sx={(theme) => ({
							display: "flex",
							alignItems: "flex-start",
							gap: 1.5,
							minHeight: 56,
							px: 1.5,
							py: 1.25,
							cursor: "pointer",
							bgcolor: on ? theme.vars.palette.kosh.surface2 : "transparent",
							transition: theme.transitions.create("background-color", { duration: 200 }),
							"&:hover": { bgcolor: theme.vars.palette.kosh.surface2 },
						})}
					>
						<Radio value={option.value} sx={{ p: 0, mt: "1px" }} />
						<Box sx={{ flex: 1, minWidth: 0 }}>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 0.75,
									fontWeight: 700,
									lineHeight: 1.4,
									"& svg": { fontSize: 17 },
								}}
							>
								{option.icon}
								{option.title}
							</Box>
							{option.hint && (
								<Typography variant="caption" component="div">
									{option.hint}
								</Typography>
							)}
						</Box>
					</Box>
				);
			})}
		</RadioGroup>
	</FormControl>
);
