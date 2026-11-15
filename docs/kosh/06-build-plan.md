# Kosh — Build Plan (whole app, in shippable phases)

Status: **the working plan** (2026-11-15). It turns the milestones in [05-roadmap.md](./05-roadmap.md) into nine phases that each end with something a family can use, and fixes the architecture every phase builds on. The design it implements is the Claude Design canvas "Kosh — accounts, people and sharing" (27 boards: identity, wording, rules, money screens, people-and-access screens, states).

## 0. Where we start

Already built and tested (draft PR [krishna-404/kosh#21](https://github.com/krishna-404/kosh/pull/21)):

| Piece | State |
|---|---|
| Online-only app shell, Better Auth logins, Novu, pg-tbus jobs | working |
| Access model: grants per account or per holder, `view`/`edit`/`owner`, enforced in two layers | working, 15 tests |
| Zerodha tradebook + ledger import: preview, atomic apply, undo | backend only, 7 tests |
| `finance-math` (XIRR, TWR, risk), `corporate-actions` (purpose parser, apply, replay, reconcile), `broker-parsers` (Zerodha) | libraries, 138 tests, not yet wired to a screen |
| Screens | login, a placeholder dashboard, profile |

Data feeds, checked from the build machine on 2026-11-15:

| Need | Source | Result |
|---|---|---|
| Daily share prices | NSE bhavcopy archive (old format 2012 → Jul 2024, UDiFF format since) | works, both formats carry ISIN |
| Splits, bonuses, dividends | NSE corporate-actions API on `www.nseindia.in`, by date range and by symbol, back to at least 2017 | works |
| Fund NAVs | AMFI `NAVAll.txt` (today, ISIN → scheme code) and `api.mfapi.in` (full history per scheme) | works |
| NIFTY 50 with dividends | NIFTY TRI endpoint | **closed** (redirects to a login) → use the NAV of a NIFTY 50 index fund instead |
| Gold | — | use the NAV of a gold fund |
| BSE prices and actions | BSE API | **closed** (403) → BSE-only shares are valued from the holdings statement, flagged |

## 1. Rules that hold in every phase

1. **A phase ships.** It ends with build, type-check, unit and backend tests and Playwright green, screenshots checked against the design boards, docs updated in the same commits, and a push. Nothing half-wired is left visible: a screen whose data comes in a later phase shows an honest empty state, never a made-up number.
2. **The server decides and computes.** Access is checked on the server for every call (table scopes + explicit level checks); every figure is computed on the server from the ledger. The client only renders, and hides actions the level does not allow.
3. **Every new endpoint gets an access test**: an account the caller cannot see answers *not found*; a viewer cannot change anything; fees and sharing are owner-only.
4. **Contracts first.** Each endpoint's input and output is a zod schema in `packages/zod-schemas/src/kosh/`; the backend returns it, the frontend reads its type. Money and quantities cross the wire as decimal strings.
5. **Layer discipline** (unchanged from [01-architecture.md](./01-architecture.md) §3): raw rows are never edited, every interpretation is an event that can be undone, derived tables are rebuilt and never hand-written.
6. **Fixtures.** Parsers land with fixtures. Real statements never enter the repo (it is public); fixtures are anonymized or synthetic and say which.
7. **Words.** UI text follows the design's wording board ("Can view", "Can edit", "Owner", "person", "remove" — never role, tenant, grant, revoke, user). Level labels and shared phrases live in one copy module.

## 2. Design system architecture

Four layers, each allowed to know only the one below it.

```
packages/ui-mui/src/
  theme/
    tokens.ts        1. TOKENS — the only file with hex values. Light and dark sets:
                        surfaces, lines, ink, accent, sun/mint/coral/sky/lilac (+ soft),
                        pos/neg, benchmark series colours, hero, shadows, radii, font stacks.
    palette.ts       2. THEME — tokens → MUI `colorSchemes` (light + dark, CSS variables),
    typography.ts       custom palette slots (sun, mint, coral, sky, lilac, hero, series),
    components.ts       typography (Sora headings, Figtree body, Inter tabular numbers),
    theme.ts            component overrides (pill buttons 44/52, cards r20, dialogs r26,
    theme.types.ts      inputs 48 r14, chips, toggles, menus, snackbars, alerts→banners).
    ThemeProvider.tsx   System / light / dark, remembered per device.
  kosh/              3. KIT — presentational components. No data fetching, no routing.
    LevelBadge  HolderAvatar  BrokerMark  Money  Percent  Delta  Tag  Banner
    SectionCard  HeroCard  Stat  RowItem  EmptyState  SpotIcon  PageHeader
    FilterChips  Segmented  ResponsiveDialog (dialog on desktop, sheet on phone)
    ConfirmDialog  ProgressTrack  DivergingBar  CompareBar  LineCompareChart  KoshMark
  format/            money (Indian grouping, lakh/crore), percent, dates — unit tested.
apps/frontend/src/
  components/layout/ 4. APP — AppShell: sidebar (252px) on desktop, bottom tabs on phone.
  modules/<area>/       Pages compose kit components and call oRPC. Nothing else.
  copy/                 The wording board as code.
```

Guards so it stays that way:
- `yarn lint:design` (blocking in CI) fails on a hex colour, an `rgb()` or a font family anywhere outside `theme/tokens.ts`, and on a direct `@mui/*` import in `apps/frontend` (the app reaches MUI only through `ui-mui`). Scheme-dependent colours are read from the theme (`theme.vars.palette.kosh.*`); fixed measures (radii, sizes, avatar pastels) may be imported from `tokens.ts` inside `ui-mui`.
- A `/kit` route (dev and test builds only) renders every kit component. An e2e test opens it in both themes, fails on any console error, and attaches a full-page picture of each to the test report — the reference for reviewing a change to a shared component. (No pixel comparison: font rendering differs between machines and would make it flaky.)
- Fonts are self-hosted (`@fontsource-variable/*`), not fetched from Google, so the installed app and strict CSPs work.
- Charts: one line chart built on `@mui/x-charts` and themed from the tokens; bars and tracks are plain styled boxes.

## 3. Backend architecture additions

**Modules** (as mapped in [01-architecture.md](./01-architecture.md) §2): `portfolio` (exists) · `imports` (exists, grows an adapter registry) · `questions` · `activity` · `market-data` · `instruments` · `metrics` · `corporate-actions` · `dividends` · `fees`.

**Derived data.** One table carries the weight: `account_daily (account_id, date, securities_value, cash_value, total, missing_prices)`. `rebuildAccount(accountId)` replays that account's live trades and applied corporate actions into positions and FIFO lots, values them at each day's close (forward-filled, and counted when it had to be), and adds the ledger cash balance. Each account has a `ledger_version` bumped by any import, undo, answer or corporate action; a rebuild is queued on pg-tbus when it changes and run lazily if a read finds it stale. Every metric for any selection — one account, a holder, a group, everything — is then a sum over `account_daily` plus that selection's external cash flows, which is what makes ten years × ten accounts answer in well under a second.

**One selection rule.** Every money endpoint takes a selection (`everything` | group | holder | account) and resolves it against the accounts the caller can see. Transfers between two accounts inside the selection cancel; a transfer with one leg outside is external for that selection ([03-metrics-spec.md](./03-metrics-spec.md) §1).

**Reference data.** Every feed pull is stored verbatim (`provider_payloads`) and parsed from there, so prices can be re-derived without downloading again. `price_bars` holds daily closes for *tracked* instruments only — anything held by any account, plus the benchmarks; tracking a new instrument backfills it from the stored payloads. Jobs: bhavcopy and AMFI daily after market close, corporate actions daily, a backfill job per newly tracked instrument, all rate-limited.

**Uploaded statements** are stored verbatim in Postgres next to their batch (not S3), so every row stays traceable to its file with no extra infrastructure.

## 4. The phases

Sizes are relative (S/M/L/XL), not dates.

### Phase 1 — Kosh design system and app shell · M
*Ships: the app looks and moves like the design, in light and dark, on phone and desktop.*
- Tokens, theme, fonts, component overrides; the kit (§2); `/kit` gallery; `lint:design`.
- AppShell: sidebar ("Your money": Overview, Holdings, Groups · "People and access": Accounts and people, Shared with me, Who can see what, Activity), phone bottom tabs (Overview · Holdings · Groups · Accounts), user card, theme switch.
- Every destination routed with its real page header and an empty state; sign-in restyled.
- **Done when:** `/kit` matches the identity board in both themes; shell passes keyboard and 44px-target checks; e2e covers navigation and theme switch; no hex outside `tokens.ts`.

### Phase 2 — People, accounts and sharing · L  *(roadmap M8's sharing screens, pulled forward)*
*Ships: a family sets up its people and accounts, invites each other and a fund manager, and can always see who can see what.*
- Backend: holder kind (person with a login / no login / HUF) and optional "this is me" link; group kind; invite expiry (14 days), send again, cancel; people names and counts for owners only ("Shared by X" for everyone else); who-can-see-what; shared-with-me; leave an account; new-arrival and lost-access notices; activity feed for access changes (owners, plus your own); invite email and in-app notice through Novu (never an amount in it).
- Screens: Accounts and people · Add a person · Add an account · Share (account and holder, with "Check before you send") · Who can see what (grid on desktop, lists on phone) · Shared with me · Groups (create, edit, kinds) · Activity · the arrival page ("3 accounts were just shared with you" → save as a group) · states (welcome, pending invite, last owner, access removed while open, mistyped address).
- Adopted from the design's suggestions: editors undo only their own uploads; owner invites need a second confirm; the person who loses access is told once. Not adopted without a decision: the per-account "Not this one" exception and one-step "Hand over".
- **Done when:** a two-login e2e runs invite → appears for the other login at the right level → level change → remove; every rule on the Rules board has a backend test.

### Phase 3 — Statements in, ledger out · L  *(roadmap M1)*
*Ships: drop a broker file on an account, check what it will do, apply it, undo it, answer what Kosh could not work out.*
- Backend: adapter registry with auto-detect (the user never picks a file type); CSV and XLSX; verbatim file storage; fix ledger re-upload detection; Zerodha holdings and dividend-statement adapters; charges worked out from the ledger; **questions** (unclassified ledger line, share with no ISIN, likely transfer between two accounts, opening balance with no history) with answer and undo-answer; gap detection and the "history complete from …" checklist; uploads, undos and answers in Activity.
- Screens: account page with its tabs (Cash flows · Statements and questions live now; Returns · Holdings · How it's worked out arrive in Phase 4), upload → preview with per-row status → apply → Undo, uploads list, question cards, viewer and editor variants, phone layout.
- **Done when:** a multi-year synthetic Zerodha history imports to "history complete"; re-uploading any file adds nothing; undo then re-import gives identical ledger rows; every raw row traces to its file.

### Phase 4 — Prices, valuations and true returns · XL  *(roadmap M2 + M3 — the first "wow")*
*Ships: Overview, Holdings and Groups show real money: value today, your return, the same money in NIFTY 50 and in gold, and what moved it.*
- Backend: instrument master from bhavcopy and AMFI; `provider_payloads`, `price_bars`, daily jobs and backfill; benchmarks as index-fund and gold-fund NAV series; `account_daily` rebuild (§3); metrics for any selection and window — XIRR, TWR, same-money shadow value and return per benchmark, "how the money moved" (put in, taken out, price gains, dividends, fees, value today), risk figures, and the trail behind each number; per-share attribution (return, versus NIFTY on the same money, ₹ effect, share of the gain); groups compared, year by year, and "what if this money had followed another group".
- Screens: Overview (scope picker, period, hero, waterfall, ahead/behind lists, groups compared) · Holdings (asset-class bar, filters, table, one-share page) · Groups compared · account Returns, Holdings and "How it's worked out" tabs · the comparison chart.
- A demo family (`yarn seed:demo`): synthetic statements over real historical prices, for development, e2e and screenshots.
- **Done when:** XIRR matches the spreadsheet fixtures to 1e-6; the Dad → Son transfer case reads correctly per account and per group; every headline number opens to its working; warm queries stay under a second for 10 accounts × 10 years; days valued on a stale price say so.

### Phase 5 — Corporate actions and reconciliation · L  *(roadmap M4)*
*Ships: splits and bonuses apply themselves with a before/after, anything unsure becomes a question, and the holdings statement is the cross-check.*
- Backend: NSE feed ingestion → purpose parser → confident ones applied per account, unsure ones become questions with a form; ISIN changes followed by symbol continuity in bhavcopy; mergers and demergers by question; applied-actions history with undo (replay heals everything derived); expected holdings versus the uploaded holdings statement → "unexplained holding" questions; an "unreconciled" mark on figures while questions are open.
- Screens: corporate-action questions with effect preview, applied history with Undo, reconciliation card on the account page.
- **Done when:** the WIPRO 2017 bonus + split case passes end to end; apply wrong ratio → undo → apply right ratio leaves derived data identical to applying it right the first time; an unexplained holding raises a question in one cycle.

### Phase 6 — Dividends and fees · M  *(roadmap M5)*
*Ships: dividends count in the return on the day they arrived; a fund manager's cost is visible as gross versus net.*
- Backend: expected dividends from feed × holdings on the record date; confirm one, confirm all as expected, or import Zerodha's dividend statement; dated by receipt, by pay date with an "unconfirmed" mark until then; fee arrangements (percent of assets a year, fixed, share of profit above a hurdle, invoiced) set by owners only; outside fee payments; every metric computed gross and net.
- Screens: dividend questions and list, fee setup on an account or group (owners), the gross/net switch everywhere a return appears, fee impact in Groups compared.
- **Done when:** a dividend-heavy account's return moves by the dividends with the right dates; gross − net equals fees in a hand-checked case.

### Phase 7 — More brokers, mutual funds, CAS · L  *(roadmap M6)*
*Ships: every family account can be brought in, whichever broker it is with.*
- A column-mapping importer for any broker's CSV/XLSX (map once, remembered per account); Groww and Dhan adapters on their published layouts, falling back to mapping when a file does not match; mutual funds end to end (units, NAV history, Zerodha Coin); CAS through `casparser`; manual accounts (hand-entered trades, flows and valuations for assets with no feed); the same trade arriving through two exports recognised once.
- **Done when:** a CAS file yields fund holdings and transactions through the same gate; a holder with accounts at three brokers rolls up correctly. *Groww and Dhan stay marked "unverified" until real sample exports are checked against them.*

### Phase 8 — Foreign shares and crypto · L  *(roadmap M7)*
*Ships: USD and crypto holdings sit in the same picture, in rupees, with the currency effect shown separately.*
- Account and instrument currency; daily FX rates; price sources for foreign shares and crypto; return split into "in its own currency" and "from the rupee"; benchmarks for those sleeves; a day-end cut-off for markets that never close.
- **Done when:** the USD holding scenario (including the remittance cost) reads correctly; "everything" includes these sleeves. *Sources and cut-off are my defaults until grilling #15 decides them.*

### Phase 9 — Hardening · M  *(rest of roadmap M8)*
- Notifications for questions and sharing (in-app, push, email); installable-app polish and the missing icons; metric cache if measurements ask for it; a security review and an accessibility pass over the whole app; feed-health view; docs; removal of template surface Kosh does not use, once decided.

## 5. How phases ship

All work goes to branch `claude/charming-bell-2jt0fa`. While PR #21 is open, each phase lands on it as its own commits and its description gains that phase's section, so it can be merged at any phase boundary; once it is merged, the next phase opens a fresh PR from `main`. Each phase's report says plainly what runs on real data, what is flagged, and what is waiting on a decision.

## 6. Decisions taken as defaults (say the word to change any)

| # | Decision | Default taken |
|---|---|---|
| 1 | Benchmark for "the same money in NIFTY" | NAV of UTI Nifty 50 Index Fund (regular plan for depth of history), i.e. what an investor could really have earned, dividends included |
| 2 | Gold | NAV of Nippon India Gold Savings Fund |
| 3 | Where uploaded statements are kept | Postgres, next to the batch |
| 4 | Design's suggested rules | adopt: editors undo only their own uploads, second confirm for owner invites, tell the person who lost access · hold: "Not this one", "Hand over" |
| 5 | Fee shapes (grilling #5) | percent of assets a year, fixed, profit share above a hurdle per financial year, invoiced |
| 6 | Risk-free rate for Sharpe | a constant 6.5% until a T-bill series is chosen |

## 7. Needed from the owner (none of it blocks Phases 1–5)

- An email provider connected in Novu, for invite emails to leave the building (until then an invite waits and the inviter can copy the link).
- Real sample exports: Zerodha holdings, Groww, Dhan, one CAS — to certify those adapters (Phase 7).
- The open grillings: fee shapes (#5), foreign and crypto sources (#15).
- Whether to delete the unused template surface (API keys / subscriptions, S3 files and CDN endpoints).
- Whether the production server can reach NSE (some cloud ranges are blocked); if not, the daily price job needs a small relay in India.
