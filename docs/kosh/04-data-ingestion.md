# Kosh — Data Ingestion Specification

Two pipelines: **broker files** (user-uploaded, per family) and **reference data** (system-wide feeds). Both write Layer 1 verbatim, pass the validation gate, and emit Layer-2 events. Nothing else writes the ledger.

## 0. As built (November 2026)

The sections below are the design. This is what the code does today; where they differ, this section is right.

**Statements** (`apps/backend/src/modules/imports`, readers in `packages/broker-parsers`)
- One endpoint pair: `imports.preview` (changes nothing) and `imports.apply` (all of the file or none), then `imports.undo`. The file's kind is detected from its columns; nobody picks a type. CSV and XLSX. The file is stored byte for byte in `import_files` next to its batch.
- Readers: **Zerodha** tradebook, ledger and holdings statement; and **Kosh's own layout** for an account at any other broker — two plain tables (`date, type, symbol, isin, quantity, price` and `date, description, money in, money out, balance`, with an optional `what`), handed out by `imports.layouts`. Both produce the same row shapes, so duplicates, questions and undo are one code path.
- A ledger must reproduce its own running balance to the paisa or nothing is applied. Duplicates are skipped line by line (two identical lines on one day are two lines).
- Not built: Groww and Dhan readers, CAS, Zerodha's dividend statement — each needs a real sample file first. The Zerodha holdings reader is written from the published layout and has not been checked against a real export.

**Questions** (`modules/questions`) — what Kosh could not work out: an unrecognised ledger line, a trade with no ISIN, an opening balance nobody has explained, money that left one account and arrived in another, a split or bonus it was not sure of, a holdings statement that disagrees with its working. Every answer is an event and can be undone.

**Reference data** (`modules/market-data`)
| Feed | Source | Notes |
|---|---|---|
| NSE closes | bhavcopy zip per trading day, from `nsearchives.nseindia.com` (old layout to 5 Jul 2024, UDiFF after) | matched by ISIN; a face-value split's new ISIN is followed |
| Fund NAVs | AMFI `NAVAll.txt` for the scheme list; `api.mfapi.in` for a scheme's history | |
| "Same money in NIFTY 50" | NAV of UTI Nifty 50 Index Fund (regular, growth) | what an investor could really have earned, dividends included — not the TRI |
| Gold | NAV of Nippon India Gold Savings Fund | |
| Splits, bonuses, dividends | NSE `corporates-corporateActions` per symbol held | |
Every download is stored verbatim in `provider_payloads` and parsed from there. Closes are kept only for instruments someone holds, plus the benchmarks. The sync is leased, bounded per run and resumable; it runs after an upload and on a daily cron, and is off in tests (`MARKET_DATA_SYNC`). BSE, the NIFTY TRI site, IBJA and FX are not fetched.

**Splits and bonuses** (`modules/corporate-actions`) — an announcement is read part by part; one read with certainty is applied to each account that held the share on the ex-date, the rest become questions; applied ones can be undone. Mergers and demergers are not applied automatically.

**Dividends** (`modules/dividends`) — worked out from the announcement × the shares held going into the ex-date, counted from the ex-date (the feed has no pay date) as money earned and paid out to the holder's bank; confirmed, corrected or struck out by a person.

**Fund-manager fees** (`modules/fees`) — set per account by an owner (percentage of assets, fixed, profit share above a hurdle, or invoiced payments); counted as money the holder also paid, so every return is after fees with the before-fees figure beside it.

## 1. Broker file imports (v1 connectivity — owner decision)

### 1.1 Pipeline

```
upload → import_batches(status=parsing)
  → parse (per-broker adapter → normalized rows)
  → validate (schema → referential → plausibility; §1.4)
  → DRY-RUN PREVIEW to user: per-row status = new | duplicate | error | needs-mapping
  → user confirms → apply ATOMICALLY (Layer-1 rows + Layer-2 events in one txn) → status=applied
  → enqueue derived replay + reconciliation
rejects → import_quarantine(reason codes) → fix & resubmit
retract batch → retraction event supersedes everything the batch produced → replay
```

- API shape: Ghostfolio-style `dryRun` — same endpoint, preview vs commit ([prior-art](../research/prior-art.md) §2).
- Pipeline shape and per-row status grid: Portfolio Performance's extractor→checks→preview→insert ([prior-art](../research/prior-art.md) §3).

### 1.2 Per-broker adapters

One adapter per (broker, export kind), implementing:

```ts
interface StatementAdapter {
  detect(file): Confidence            // sniff header/shape → route file automatically
  parse(file): NormalizedRow[]        // no state mutation, pure
  fixtures: AnonymizedSample[]        // MANDATORY regression fixtures per format version
}
```

- **Fixture discipline is non-negotiable** — it is what keeps Portfolio Performance's ~130 parsers alive. Every adapter lands with anonymized real samples (from the [sample-exports task](https://github.com/krishna-404/family-portfolio-tracker/issues/14)) and a golden-output test. Broker format changes ⇒ new fixture + adapter version, old fixtures stay green.
- v1 adapters: Zerodha Console (tradebook CSV/XLSX, ledger, holdings, P&L), Groww (statements), Dhan (statements), **CAS via casparser subprocess** (`casparser -o json`; output treated as one more raw payload). Exact column maps come from the [broker-exports research ticket](https://github.com/krishna-404/family-portfolio-tracker/issues/8) once samples exist.
- Contract notes (PDF) are a later adapter; tradebook+ledger suffice for v1 math.

### 1.3 Normalization targets

- Tradebook rows → `raw_trades` (with per-trade `charges` where the export itemizes them; else charges arrive via ledger lines and attach at the contract-note/day level).
- Ledger rows → `raw_ledger_lines`, then **classification** into `cash_flows`:
  - Rule engine on narration patterns per broker ("NEFT", "UPI", "payout", "quarterly settlement", "DP charges", "AMC"…), each rule versioned and confidence-scored.
  - High confidence → auto-classified (event recorded, retractable). Low confidence → prompt ("Is this ₹2,00,000 credit on 2023-04-12 a deposit?").
  - **Fund-flow correctness gate**: Σ(classified flows + trades + charges) must reproduce the statement's running balance; imbalance ⇒ batch fails plausibility, goes to quarantine. This test is what makes "true returns" true.
- Holdings exports → `raw_holdings_snapshots` → reconciliation diffs → prompts.

### 1.4 Validation gate (applies to every input, incl. feeds & manual entries)

1. **Schema**: parses, required columns, sane dates, numeric fields numeric.
2. **Referential**: instrument resolves (ISIN → alias → prompt for mapping); account exists; dates within account life.
3. **Plausibility**: duplicate keys (broker_trade_id, else normalized content hash); price within band of that day's bar (when bars exist); ledger balance reproduction; qty integrality for equities; overlap analysis vs previously applied batches (re-upload of same period ⇒ rows marked duplicate, batch still importable for the novel remainder).

### 1.5 Backfill onboarding (full-history — owner decision)

Wizard per account: broker → guided list of which exports to pull (with screenshots) → multi-file upload (chunked by FY, as brokers export) → **gap detection** (missing months in ledger continuity; balance discontinuities) → progress checklist until account shows "history complete from <inception>". Metrics render with a "history incomplete" badge until then.

## 2. Reference-data ingestion (system jobs, pg-tbus cron)

| Feed | Source (canonical) | Cadence | Notes |
|---|---|---|---|
| NSE EOD bars | **bhavcopy** bulk files | daily ~18:30 IST | stable primitive; per-symbol NSE API only for backfill; cloud-IP blocks documented in prior-art §4 |
| BSE EOD bars | BSE bhavcopy | daily | for BSE-only listings |
| MF NAVs | **AMFI NAVAll.txt** (direct) | daily | no bot protection; historical endpoint for backfill |
| NIFTY indices incl. **TRI** | `niftyindices.com getTotalReturnIndexString` | daily + one-time backfill | ~30-line client; cache aggressively |
| Gold | IBJA daily rates (small HTML scrape) | daily | matches official SGB valuation basis |
| FX (USDINR first) | RBI/FBIL reference rate (⚠ confirm in grilling #15) | daily | store direct pairs in `fx_rates` |
| Corporate actions | NSE `corporates-corporateActions` + BSE equivalent (cross-check) | daily | see §3 |
| Crypto & foreign equity bars | ⚠ grilling #15 | daily | 24/7 markets need a defined EOD cutoff (proposal: 00:00 UTC) |

Every pull lands verbatim in `provider_payloads` first (immutable, hash-keyed) and is parsed from there — feeds are re-parseable forever, and a poisoned feed pull is retractable like any batch.

## 3. Corporate-action feed & the purpose-string parser

The hard, unowned problem (no OSS solution — prior-art §4): NSE/BSE feeds give ex/record dates plus a **free-text purpose** ("Bonus 1:1", "Face Value Split From Rs.10/- To Re.1/-", "Dividend - Rs 8 Per Share", "Amalgamation…").

- Grammar-based parser (not one regex): typed extractors per action family, each emitting `{action_type, ratio_old, ratio_new | amount, confidence}` + the raw text retained on the event.
- **Confidence routing**: high → `active` event, auto-application per account where holdings exist on record date (with before/after `effect` recorded); low/unparseable → `quarantined` → actions-inbox prompt with the raw text and a structured input form.
- Cross-source reconciliation: NSE vs BSE rows matched on (ISIN, ex-date, family); disagreements ⇒ prompt, never guess.
- Application preview always shown for prompts ("500 → 5,000 shares @ ₹48 — apply?"); every application revocable from the applied-actions history (retraction event + replay).
- Bonus/split ratio math test set: WIPRO 1:1 (2017 bonus + 1:5 split same record date — the classic trap), ICICI 1:10, odd ratios (32:21), reverse splits. kite_pnl's bug list (prior-art §1) is the regression suite seed.
- **Detection net**: independent of feeds, `reconciliation_diffs` (expected vs broker-reported holdings) catches any action the feeds missed and raises "unexplained holding" prompts — feeds are an optimization, reconciliation is the guarantee.

## 4. Dividend pipeline (owner decision, ticket #3)

1. Feed yields `dividend` corporate-action events (amount/share, ex/record/pay dates).
2. For each account holding the instrument on record date (from Layer 3 positions): create `dividend_expectations` (expected = qty × amount/share).
3. Actions-inbox lists expectations past pay date: user confirms receipt (date + txn id + actual amount) / marks not-received / waives.
4. Metrics consume per [03-metrics-spec.md](./03-metrics-spec.md) §4. Bulk-confirm UX ("mark all matched" against a bank-statement upload) is a later enhancement — flagged as fog on the map.

## 5. Timezone & resolution discipline (owner decision)

- All bar timestamps stored UTC; each instrument carries an `exchange_calendar` (tz + trading days + close time). "EOD for date d" = the close of d in the exchange's own calendar, mapped to UTC — so NSE (IST), NYSE (ET), and crypto (24/7, cutoff 00:00 UTC proposal) coexist without ambiguity.
- Schema is resolution-keyed (`1s/1m/1h/1d`); v1 writes `1d` only. Finer data later = new rows, zero migrations.
