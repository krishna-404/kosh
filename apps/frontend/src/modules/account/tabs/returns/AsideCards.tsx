import { Typography } from "@connected-repo/ui-mui/data-display/Typography";
import { Skeleton } from "@connected-repo/ui-mui/feedback/Skeleton";
import { Button } from "@connected-repo/ui-mui/form/Button";
import { Banner } from "@connected-repo/ui-mui/kosh/Banner";
import { IconClock, IconHolderWide } from "@connected-repo/ui-mui/kosh/icons";
import { Percent } from "@connected-repo/ui-mui/kosh/Money";
import { SectionCard } from "@connected-repo/ui-mui/kosh/SectionCard";
import { Box } from "@connected-repo/ui-mui/layout/Box";
import { Link as TextLink } from "@connected-repo/ui-mui/navigation/Link";
import { useMediaQuery, useTheme } from "@connected-repo/ui-mui/theme/useTheme";
import { ACCOUNT } from "@frontend/copy/account.copy";
import { MONEY } from "@frontend/copy/money.copy";
import { errorWords, firstNameOf, possessive } from "@frontend/modules/access/people.utils";
import { useHoldings } from "@frontend/modules/money/money.queries";
import { type ReactNode, useMemo } from "react";
import { Link } from "react-router";
import type { AccountInfo } from "../../account.types";
import { lastStatementWords } from "../../account.utils";
import { useTabLink } from "../../components/useTabLink";

/**
 * Questions still open on this account. Someone who can answer gets the way
 * to answer; someone who can only view is told who will, and that the
 * figures may move — never a button they cannot use.
 */
export const QuestionsCard = ({ info, count }: { info: AccountInfo; count: number }) => {
	const theme = useTheme();
	const phone = useMediaQuery(theme.breakpoints.down("md"));
	const { linkTo } = useTabLink();

	const title = info.canEdit ? ACCOUNT.questions.needAnswer(count) : ACCOUNT.questions.beingChecked(count);
	const body = info.canEdit ? ACCOUNT.questions.bestGuess : ACCOUNT.questions.willConfirm(count);
	const answer = info.canEdit && (
		<Button variant="outlined" component={Link} to={linkTo("statements")}>
			{ACCOUNT.questions.answerThem}
		</Button>
	);

	if (phone)
		return (
			<Banner tone="warn" icon={<IconClock fontSize="inherit" />}>
				<b>{title}.</b> {body}
				{answer && <Box sx={{ mt: 1.25 }}>{answer}</Box>}
			</Banner>
		);
	return (
		<SectionCard>
			<Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
				<Typography variant="subtitle2" component="h2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<IconClock
						fontSize="small"
						aria-hidden
						sx={(t) => ({ color: t.vars.palette.kosh.sunText, flex: "none" })}
					/>
					{title}
				</Typography>
				<Typography variant="body2">{body}</Typography>
				{answer}
			</Box>
		</SectionCard>
	);
};

const asideRow = {
	display: "flex",
	alignItems: "center",
	gap: 1.5,
	minHeight: 48,
	px: 2.25,
	py: 1,
} as const;

/** The four holdings that make up most of the account, by share of what is held. */
export const BiggestHoldings = ({ accountId }: { accountId: string }) => {
	const scope = useMemo(() => ({ kind: "account" as const, id: accountId }), [accountId]);
	const holdings = useHoldings(scope);
	const { linkTo } = useTabLink();

	const all = holdings.data?.holdings ?? [];
	const biggest = [...all].sort((a, b) => b.weight - a.weight).slice(0, 4);

	return (
		<SectionCard title={ACCOUNT.biggestHoldings} padding="none">
			{holdings.isPending ? (
				<Box sx={{ px: 2.25, pb: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
					<Skeleton variant="rounded" height={22} />
					<Skeleton variant="rounded" height={22} />
					<Skeleton variant="rounded" height={22} />
				</Box>
			) : holdings.isError ? (
				<Box sx={{ px: 2.25, pb: 2 }}>
					<Typography variant="body2">{errorWords(holdings.error, ACCOUNT.holdingsFailed)}</Typography>
					<Button variant="text" onClick={() => void holdings.refetch()} sx={{ ml: -1.5, mt: 0.5 }}>
						{MONEY.retry}
					</Button>
				</Box>
			) : biggest.length === 0 ? (
				<Typography variant="body2" sx={{ px: 2.25, pb: 2.25 }}>
					{ACCOUNT.noHoldingsNow}
				</Typography>
			) : (
				<Box
					component="ul"
					sx={(theme) => ({
						listStyle: "none",
						m: 0,
						p: 0,
						"& > li + li": { borderTop: `1px solid ${theme.vars.palette.kosh.line}` },
					})}
				>
					{biggest.map((holding) => (
						<Box component="li" key={holding.instrumentId} sx={asideRow}>
							<Typography component="span" noWrap sx={{ flex: 1, minWidth: 0 }}>
								{holding.name}
							</Typography>
							<Typography component="span" variant="body2">
								<Percent value={holding.weight} decimals={0} />
							</Typography>
						</Box>
					))}
					<li>
						{/* The whole row is the link, so it is easy to hit with a thumb. */}
						<TextLink component={Link} to={linkTo("holdings")} sx={asideRow}>
							{ACCOUNT.allHoldings(all.length)}
						</TextLink>
					</li>
				</Box>
			)}
		</SectionCard>
	);
};

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
	<Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
		<Typography component="dt" variant="body2">
			{label}
		</Typography>
		<Typography
			component="dd"
			variant="body2"
			sx={{ m: 0, fontWeight: 700, color: "text.primary", textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}
		>
			{children}
		</Typography>
	</Box>
);

/** Who holds it, where, when a statement last came in, and how the reader came to see it. */
export const AboutAccount = ({ info }: { info: AccountInfo }) => {
	const { account, holder } = info;
	return (
		<SectionCard title={ACCOUNT.about}>
			<Box component="dl" sx={{ m: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
				<Fact label={ACCOUNT.heldBy}>{holder.displayName}</Fact>
				<Fact label={ACCOUNT.broker}>{info.broker}</Fact>
				<Fact label={ACCOUNT.lastStatement}>{lastStatementWords(account.updated)}</Fact>
				{account.sharedBy && <Fact label={ACCOUNT.sharedWithYouBy}>{firstNameOf(account.sharedBy.name)}</Fact>}
				{/* Said only when one is set, or when the reader is the one who could set it. */}
				{(account.fee || account.myLevel === "owner") && (
					<Fact label={ACCOUNT.managerFee}>
						<TextLink component={Link} to={{ search: "?tab=worked-out", hash: "#manager-fee" }}>
							{account.fee ? ACCOUNT.managerFeeSee : ACCOUNT.managerFeeSet}
						</TextLink>
					</Fact>
				)}
			</Box>
			{account.sharedBy && account.via === "holder" && (
				<Typography variant="caption" component="p" sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5, mb: 0 }}>
					<IconHolderWide aria-hidden sx={{ fontSize: 16, flex: "none" }} />
					{ACCOUNT.holderWide[account.myLevel](possessive(firstNameOf(holder.displayName)))}
				</Typography>
			)}
		</SectionCard>
	);
};
