import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { QUESTIONS } from "@frontend/copy/statements.copy";
import { type ReactNode, useId } from "react";

/** How a card sits among the others: what its primary button says, and whether it can be put off. */
export interface QuestionFlow {
	/** Put this one off — to the end of the list, or on to the next on a phone. Absent when it is the only one. */
	onSkip?: () => void;
	/** On a phone, questions are answered one after another. */
	stepping: boolean;
}

interface QuestionMarkProps {
	children: ReactNode;
}

/** The small square beside a question: an icon, "₹", or a ratio like "1:1". */
export const QuestionMark = ({ children }: QuestionMarkProps) => (
	<Box
		aria-hidden
		sx={(theme) => ({
			width: 32,
			height: 32,
			flex: "none",
			display: "grid",
			placeItems: "center",
			borderRadius: "10px",
			border: `1px solid ${theme.vars.palette.kosh.line}`,
			bgcolor: theme.vars.palette.kosh.surface2,
			color: theme.vars.palette.kosh.ink2,
			fontFamily: theme.typography.h1.fontFamily,
			fontSize: "0.75rem",
			fontWeight: 800,
			lineHeight: 1,
			"& svg": { fontSize: 18 },
		})}
	>
		{children}
	</Box>
);

interface QuestionCardProps {
	mark: ReactNode;
	title: string;
	/** The facts of the question, under its title. */
	detail?: ReactNode;
	/** At the right of the heading: what it is counted as now. */
	tag?: ReactNode;
	/** Above the heading on a phone: "Question 1 of 3". */
	eyebrow?: ReactNode;
	/** Chips, fields, the explanation of what an answer changes. */
	children?: ReactNode;
	/** The buttons; a question the person cannot answer has `note` instead. */
	actions?: ReactNode;
	note?: ReactNode;
	flow?: QuestionFlow;
}

/** One question: what Kosh is unsure of, the possible answers, and what an answer changes. */
export const QuestionCard = ({ mark, title, detail, tag, eyebrow, children, actions, note, flow }: QuestionCardProps) => {
	const titleId = useId();
	return (
		<Box
			component="article"
			aria-labelledby={titleId}
			sx={(theme) => ({
				display: "flex",
				flexDirection: "column",
				gap: 1.5,
				p: "16px 18px",
				border: `1px solid ${theme.vars.palette.kosh.line}`,
				borderRadius: "16px",
				bgcolor: theme.vars.palette.kosh.surface,
			})}
		>
			{eyebrow}
			<Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 1.5 }}>
				<QuestionMark>{mark}</QuestionMark>
				<Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
					<Typography id={titleId} variant="subtitle2" component="h3">
						{title}
					</Typography>
					{detail && (
						<Typography variant="body2" component="div" sx={{ overflowWrap: "anywhere" }}>
							{detail}
						</Typography>
					)}
				</Box>
				{tag}
			</Box>
			{children}
			{note && (
				<Typography variant="caption" component="p" sx={{ m: 0 }}>
					{note}
				</Typography>
			)}
			{actions && (
				<Box
					sx={{
						display: "flex",
						flexDirection: { xs: "column-reverse", sm: "row" },
						flexWrap: "wrap",
						justifyContent: "flex-end",
						gap: 1,
					}}
				>
					{flow?.onSkip && (
						<Button variant="text" onClick={flow.onSkip} sx={{ mr: { sm: "auto" } }}>
							{QUESTIONS.skip}
						</Button>
					)}
					{actions}
				</Box>
			)}
			{/* A question that cannot be answered here can still be stepped past on a phone. */}
			{!actions && flow?.stepping && flow.onSkip && (
				<Button variant="outlined" onClick={flow.onSkip}>
					{QUESTIONS.next}
				</Button>
			)}
		</Box>
	);
};

/** A figure inside a sentence, in the ledger's own type. */
export const Num = ({ children, strong = false }: { children: ReactNode; strong?: boolean }) => (
	<Typography
		component={strong ? "b" : "span"}
		variant="numeric"
		sx={{ fontSize: "inherit", color: strong ? "text.primary" : "inherit", fontWeight: strong ? 700 : "inherit" }}
	>
		{children}
	</Typography>
);
