/**
 * A made-up family for looking at Kosh with: three holders, three Zerodha
 * accounts, a few years of trades and money in and out.
 *
 *   yarn workspace @connected-repo/backend seed:demo -- --email you@example.com
 *
 * The statements are SYNTHETIC — nobody's real account — but they are built
 * on real history: every trade is priced at that day's actual NSE close, so
 * the values and returns the app then shows are what such a family would
 * really have seen. They go in through the same import pipeline as a real
 * upload (recognised, checked, applied), and prices are then fetched from
 * NSE and AMFI exactly as in normal running.
 *
 * `--email` is the login that will own the family; it must have signed in
 * once. Refuses to run for a login that already has accounts unless `--force`.
 */
import { db } from "@backend/db/db";
import { requestContext } from "@backend/lib/request-context";
import { applyStatement } from "@backend/modules/imports/services/import.service";
import { bhavcopyUrls, parseBhavcopy } from "@backend/modules/market-data/lib/bhavcopy.market";
import { fetchMarketFile } from "@backend/modules/market-data/services/fetcher.market";
import { syncMarketData } from "@backend/modules/market-data/services/sync.market.service";
import { loadAccess } from "@backend/modules/portfolio/services/access.portfolio.service";

const arg = (name: string): string | undefined => {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? undefined : process.argv[i + 1];
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

// ── What the family did ─────────────────────────────────────────────────

const ISIN = {
	RELIANCE: "INE002A01018",
	HDFCBANK: "INE040A01034",
	INFY: "INE009A01021",
	WIPRO: "INE075A01022",
	ITC: "INE154A01025",
	TCS: "INE467B01029",
	SBIN: "INE062A01020",
	LT: "INE018A01030",
	BHARTIARTL: "INE397D01024",
	ICICIBANK: "INE090A01021",
	MARUTI: "INE585B01010",
	NIFTYBEES: "INF204KB14I2",
	GOLDBEES: "INF204KB17I5",
} as const;
type Symbol = keyof typeof ISIN;

type Step =
	| { on: string; do: "deposit"; amount: number }
	| { on: string; do: "withdraw"; amount: number }
	/** `spend`: buy about this many rupees' worth. `sell`: this fraction of what is held. */
	| { on: string; do: "buy"; symbol: Symbol; spend: number }
	| { on: string; do: "sell"; symbol: Symbol; fraction: number };

interface Plan {
	holder: { name: string | null; kind: "login" | "no_login" | "huf"; isMe: boolean };
	account: string;
	steps: Step[];
}

const PLANS: Plan[] = [
	{
		holder: { name: null, kind: "login", isMe: true },
		account: "Zerodha",
		steps: [
			{ on: "2023-04-03", do: "deposit", amount: 700_000 },
			{ on: "2023-04-05", do: "buy", symbol: "RELIANCE", spend: 120_000 },
			{ on: "2023-04-05", do: "buy", symbol: "HDFCBANK", spend: 120_000 },
			{ on: "2023-04-06", do: "buy", symbol: "INFY", spend: 100_000 },
			{ on: "2023-04-06", do: "buy", symbol: "WIPRO", spend: 80_000 },
			{ on: "2023-10-03", do: "deposit", amount: 200_000 },
			{ on: "2023-10-05", do: "buy", symbol: "ITC", spend: 100_000 },
			{ on: "2023-10-05", do: "buy", symbol: "NIFTYBEES", spend: 150_000 },
			// Money for Kabir's account: it leaves here on a Friday and arrives there on Monday.
			{ on: "2024-01-05", do: "withdraw", amount: 200_000 },
			{ on: "2024-06-10", do: "sell", symbol: "INFY", fraction: 0.5 },
			{ on: "2024-07-01", do: "deposit", amount: 300_000 },
			{ on: "2024-07-03", do: "buy", symbol: "TCS", spend: 150_000 },
			{ on: "2024-07-03", do: "buy", symbol: "GOLDBEES", spend: 150_000 },
			{ on: "2025-03-10", do: "withdraw", amount: 50_000 },
			{ on: "2025-08-11", do: "deposit", amount: 150_000 },
			{ on: "2025-08-12", do: "buy", symbol: "SBIN", spend: 140_000 },
		],
	},
	{
		holder: { name: "Kabir Mehta", kind: "no_login", isMe: false },
		account: "Zerodha",
		steps: [
			{ on: "2024-01-08", do: "deposit", amount: 200_000 },
			{ on: "2024-01-10", do: "buy", symbol: "NIFTYBEES", spend: 120_000 },
			{ on: "2024-01-10", do: "buy", symbol: "GOLDBEES", spend: 70_000 },
			{ on: "2025-01-06", do: "deposit", amount: 50_000 },
			{ on: "2025-01-08", do: "buy", symbol: "NIFTYBEES", spend: 50_000 },
		],
	},
	{
		holder: { name: "Mehta HUF", kind: "huf", isMe: false },
		account: "Zerodha",
		steps: [
			{ on: "2023-06-01", do: "deposit", amount: 1_000_000 },
			{ on: "2023-06-05", do: "buy", symbol: "LT", spend: 250_000 },
			{ on: "2023-06-05", do: "buy", symbol: "BHARTIARTL", spend: 250_000 },
			{ on: "2023-06-06", do: "buy", symbol: "ICICIBANK", spend: 250_000 },
			{ on: "2023-06-06", do: "buy", symbol: "MARUTI", spend: 200_000 },
			{ on: "2024-09-16", do: "sell", symbol: "MARUTI", fraction: 1 },
			{ on: "2024-09-19", do: "buy", symbol: "RELIANCE", spend: 200_000 },
			{ on: "2025-06-02", do: "withdraw", amount: 75_000 },
		],
	},
];

// ── Real closes for the days the family traded ──────────────────────────

const closesByDay = new Map<string, Map<string, number>>();

async function closesOn(date: string): Promise<Map<string, number> | null> {
	const cached = closesByDay.get(date);
	if (cached) return cached;
	for (const url of bhavcopyUrls(date)) {
		const file = await fetchMarketFile(url);
		if (file.status !== 200) continue;
		const closes = new Map(parseBhavcopy(file.bytes).map((row) => [row.isin, Number(row.close)]));
		closesByDay.set(date, closes);
		return closes;
	}
	return null;
}

const DAY_MS = 86_400_000;
const addDays = (date: string, days: number): string =>
	new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const isWeekend = (date: string): boolean => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

/** The first market day on or after `date`. */
async function marketDay(date: string): Promise<string> {
	for (let d = date, tries = 0; tries < 10; d = addDays(d, 1), tries++)
		if (!isWeekend(d) && (await closesOn(d))) return d;
	throw new Error(`No market day found near ${date}`);
}

// ── Writing the statements ──────────────────────────────────────────────

const TRADE_COST = 0.0012; // brokerage, taxes and charges, as a share of the trade
const six = (n: number): string => n.toFixed(6);

interface Statements {
	tradebook: string;
	ledger: string;
}

async function writeStatements(plan: Plan, seedNo: number): Promise<Statements> {
	const trades: string[] = [
		"symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time",
	];
	// Ledger entries, dated; sorted and given running balances at the end.
	const entries: { date: string; text: string; voucher: string; debit: number; credit: number }[] = [];
	const held = new Map<Symbol, number>();
	let tradeNo = 1;
	let settlementNo = 2_023_000 + seedNo * 1000;
	const settled = new Map<string, number>(); // settlement day → net debit

	for (const step of plan.steps) {
		if (step.do === "deposit") {
			entries.push({
				date: step.on,
				text: `Funds added using UPI with transaction ID DEMO${seedNo}${entries.length}`,
				voucher: "Bank Receipts",
				debit: 0,
				credit: step.amount,
			});
			continue;
		}
		if (step.do === "withdraw") {
			entries.push({
				date: step.on,
				text: `"Instant Payout of ${step.amount}.0/- to DEMO BANK LTD, 0000111122 A/C number as per withdrawal request made on ${step.on} with reference number demo${seedNo}${entries.length}"`,
				voucher: "Bank Payments",
				debit: step.amount,
				credit: 0,
			});
			continue;
		}

		const day = await marketDay(step.on);
		const price = (await closesOn(day))?.get(ISIN[step.symbol]);
		if (!price) throw new Error(`${step.symbol} has no close on ${day}`);
		const have = held.get(step.symbol) ?? 0;
		const quantity = step.do === "buy" ? Math.floor(step.spend / price) : Math.round(have * step.fraction);
		if (quantity <= 0) continue;
		held.set(step.symbol, step.do === "buy" ? have + quantity : have - quantity);
		const id = `D${seedNo}${String(tradeNo++).padStart(5, "0")}`;
		trades.push(
			[
				step.symbol,
				ISIN[step.symbol],
				day,
				"NSE",
				"EQ",
				"EQ",
				step.do,
				"false",
				six(quantity),
				six(price),
				id,
				`O${id}`,
				`${day}T10:15:00`,
			].join(","),
		);

		const value = quantity * price;
		const cost = Math.round(value * TRADE_COST * 100) / 100;
		const settleOn = await marketDay(addDays(day, 1));
		const net = step.do === "buy" ? value + cost : -(value - cost);
		settled.set(settleOn, (settled.get(settleOn) ?? 0) + net);
		if (step.do === "sell") {
			const [yyyy, mm, dd] = day.split("-");
			entries.push({
				date: settleOn,
				text: `DP Charges for Sale of ${step.symbol} on ${dd}/${mm}/${yyyy}`,
				voucher: "Journal Entry",
				debit: 15.34,
				credit: 0,
			});
		}
	}

	for (const [date, net] of settled)
		entries.push({
			date,
			text: `Net settlement for Equity with settlement number: ${settlementNo++}`,
			voucher: "Book Voucher",
			debit: net > 0 ? Math.round(net * 100) / 100 : 0,
			credit: net < 0 ? Math.round(-net * 100) / 100 : 0,
		});

	// The demat account's yearly charge, and one line Kosh will not recognise.
	const first = plan.steps[0]?.on ?? "2023-04-03";
	for (let year = Number(first.slice(0, 4)) + 1; year <= new Date().getUTCFullYear(); year++) {
		const on = `${year}-04-15`;
		if (on <= new Date().toISOString().slice(0, 10))
			entries.push({
				date: on,
				text: `AMC for Demat Account for 01-04-${year} to 31-03-${year + 1}`,
				voucher: "Journal Entry",
				debit: 88.5,
				credit: 0,
			});
	}
	entries.push({
		date: addDays(first, 60),
		text: "Reversal of excess charges collected",
		voucher: "Journal Entry",
		debit: 0,
		credit: 23.6,
	});

	entries.sort((a, b) => a.date.localeCompare(b.date));
	const lines = ["particulars,posting_date,cost_center,voucher_type,debit,credit,net_balance", "Opening Balance,,,,,,0.000000"];
	let balance = 0;
	for (const e of entries) {
		balance = Math.round((balance + e.credit - e.debit) * 100) / 100;
		lines.push([e.text, e.date, "NSE-EQ - Z", e.voucher, six(e.debit), six(e.credit), six(balance)].join(","));
	}
	lines.push(`Closing Balance,,,,,,${six(balance)}`);
	if (balance < 0) throw new Error(`The plan for ${plan.holder.name ?? "the owner"} overdraws the account`);
	return { tradebook: trades.join("\n"), ledger: lines.join("\n") };
}

// ── Putting it in ───────────────────────────────────────────────────────

async function main(): Promise<void> {
	const email = arg("email");
	if (!email) throw new Error("Say whose family this is: --email you@example.com");
	const user = await db.users.whereSql`lower("email") = ${email.toLowerCase()}`.takeOptional();
	if (!user) throw new Error(`No login with ${email}. Sign in to Kosh once with it, then run this again.`);

	const already = await db.accessGrants.where({ userId: user.id, revokedAt: null }).count();
	if (already > 0 && !flag("force"))
		throw new Error(`${email} already has accounts in Kosh. Use --force to add the demo family anyway.`);

	const firstName = (user.name ?? "Demo").split(/\s+/)[0] ?? "Demo";
	console.info(`Building a demo family for ${user.name} (${email}) …`);

	// Every statement is written (and checked) before anything is saved, so a
	// plan that does not add up leaves nothing half-made behind.
	const written: Statements[] = [];
	for (const [i, plan] of PLANS.entries()) written.push(await writeStatements(plan, i + 1));

	for (const [i, plan] of PLANS.entries()) {
		const displayName = plan.holder.name ?? user.name ?? "Demo Owner";
		const holder = await db.persons.create({
			displayName,
			kind: plan.holder.kind,
			linkedUserId: plan.holder.isMe ? user.id : null,
		});
		await db.accessGrants.create({
			personId: holder.id,
			userId: user.id,
			level: "owner",
			grantedByUserId: user.id,
			seenAt: Date.now(),
		});
		const short = plan.holder.kind === "huf" ? "HUF" : (plan.holder.name?.split(/\s+/)[0] ?? firstName);
		const account = await db.brokerAccounts.create({
			personId: holder.id,
			broker: "zerodha",
			label: `${short} · ${plan.account}`,
			createdByUserId: user.id,
		});

		const statements = written[i] as Statements;
		// Through the same door as a real upload, as the family's owner.
		const access = await loadAccess({ id: user.id, email: user.email });
		for (const [fileName, text] of [
			[`demo-ledger-${short.toLowerCase()}.csv`, statements.ledger],
			[`demo-tradebook-${short.toLowerCase()}.csv`, statements.tradebook],
		] as const) {
			const result = await requestContext.run(access, () =>
				applyStatement({
					accountId: account.id,
					fileName,
					contentBase64: Buffer.from(text).toString("base64"),
				}),
			);
			console.info(`  ${account.label}: ${fileName} — ${result.added} lines, ${result.questions} to ask about`);
		}
	}

	console.info("Fetching prices from NSE and AMFI (a few minutes the first time) …");
	for (let round = 1; round <= 100; round++) {
		const report = await syncMarketData({ maxDays: 150 });
		console.info(
			`  round ${round}: ${report.daysFetched} days fetched, ${report.barsWritten} prices added, ${report.daysRemaining} days to go`,
		);
		if (report.problems.length > 0) {
			console.warn(`  stopped: ${report.problems.join("; ")}`);
			break;
		}
		if (report.daysRemaining === 0) break;
	}
	console.info("Done. Open Kosh and look at Overview.");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
