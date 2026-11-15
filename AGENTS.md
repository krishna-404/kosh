# Monorepo Agent Guidelines (AGENTS.md)

## 1. Blueprint
**Intent**: Kosh — a family portfolio tracker. Full-stack TS monorepo with E2E type safety. **Online-only**: every figure is computed on the server; the client keeps no local database.
**Core Stack**: 
- **Repo**: Turborepo + Yarn
- **Backend**: oRPC + Orchid ORM + PostgreSQL + pg-tbus + Better Auth
- **Frontend**: React 19 + Vite + TanStack Query over oRPC (installable PWA shell + push; no offline data layer)
- **Packages**: Shared Zod schemas, UI components (MUI)
- **Tooling**: Biome (Tabs, 100 chars, double quotes)

**Architecture Patterns**:
- **Bimodal Docs**: `README.md` (Human) vs `AGENTS.md` (Agent)
- **Access**: the broker account is the unit. `access_grants` gives a user `view` / `edit` / `owner` on one account, or on a holder (all that holder's accounts, including future ones). `rpcPortfolioProcedure` loads the caller's access into AsyncLocalStorage; every account-scoped table filters on it, and writes call `requireAccountLevel`. No teams, no tenant column, no `x-team-id` header.
- **Online-only**: no Dexie/IndexedDB, no web workers, no sync protocol. Reads and writes are oRPC calls.
- **Strict TS**: NO `any`, NO `as unknown`, NO `ts-ignore`.

---

## Layer 2: Active Task
- **Objective**: Build Kosh end to end, phase by phase — `docs/kosh/06-build-plan.md`.
- **Status**: In progress. The plan's table ("Where each stands") is kept current; read it before starting work.
- **Context**: Foundation (online-only, access per account), the design system and shell, and people/accounts/sharing are complete. The server side of statements, prices and returns, splits and bonuses, dividends, fees and any-broker uploads is complete; their screens are being built. Foreign shares and crypto are not started (price sources undecided).

## Layer 3: Decision Records

| ID | Title | Status | Description |
|---|---|---|---|
| [ADR-001] | Pivot to Kosh | Accepted | Repo repurposed as Kosh, the family portfolio tracker (see project.md and docs/kosh/). OneQ journaling removed. |
| [ADR-002] | Snake Case Columns in Raw SQL | Accepted | Always use snake_case in raw SQL Orchid ORM migrations. |
| [ADR-003] | Hybrid Auth (Cookies + Bearer) | Accepted | Support both web and mobile auth via Better Auth bearer plugin. |
| [ADR-004] | Smart CSRF Exception | Accepted | Exclude Bearer-token requests from CSRF checks for mobile compatibility. |
| [ADR-005] | OPFS Storage Persistence | Superseded by ADR-015 | Move binary blobs from IndexedDB to OPFS to prevent browser eviction and improve performance. |
| [ADR-006] | Direct Imports | Accepted | NO barrel exports to ensure optimal tree-shaking. |
| [ADR-007] | Files Metadata Idempotency | Accepted | Use .merge() for files creation to capture asynchronous metadata enrichment. |
| [ADR-008] | Sync Recovery (Lost Files) | Superseded by ADR-015 | Flag `isMainFileLost` allows metadata sync even if binary data is purged from storage. |
| [ADR-009] | Virtual Media Provider | Superseded by ADR-015 | Serve OPFS media via Service Worker fetch interception to avoid avoid `URL.createObjectURL` overhead. |
| [ADR-010] | Token Bucket Rate Limiting | Accepted | Use an optimistic locking Token Bucket in Postgres to prevent table bloat and eliminate background cleanup cron jobs. |
| [ADR-011] | Pull Bundles Renaming | Superseded by ADR-015 | Rename sync table procedures from `pullDelta` to `pullBundles`. |
| [ADR-012] | Backend Security Hardening | Accepted | Implementing strict SSRF guards, dummy hashes for timing attacks, and strict access scoping (now per account, see ADR-016). |
| [ADR-013] | Novu Push Notifications | Accepted | Implemented FCM token synchronization and notification dispatch using Novu with optimistic DB-first tracking. |
| [ADR-014] | Silent Sync Trigger | Superseded by ADR-015 | Implemented FCM silent pushes to wake up the app for background sync, bypassing OS notifications. |
| [ADR-015] | Online-Only Client | Accepted | Kosh has no offline data layer: no Dexie/IndexedDB, workers, OPFS, sync protocol or silent-sync push. Portfolio figures are server-computed over the full ledger, so a local copy could only be stale. The service worker stays for install, update prompt and push. |
| [ADR-016] | Access Per Account | Accepted | No teams and no tenant column. The broker account is the unit of access: `access_grants` gives a user view/edit/owner on an account or on a holder (= all that holder's accounts, present and future). Family members, fund managers and friends are all just people with grants; "family" is a saved group. Only owners share; fees are owner-only. Grants are never updated or deleted (revoke = `revoked_at`), so the table is its own history. `teams_api` (external API keys) is unrelated and unchanged. |
| [ADR-017] | No setOnCreate Beside A Runtime Default | Accepted | orchid-orm 1.73 swaps the values of a `setOnCreate` column and a runtime-default column (our ULID `id`) on insert — the old tenant column was written into `id` this way and every portfolio insert failed. No table combines the two now; keep it that way (see `ulidWithDefault` in `db/base_table.ts`). |

## Quick Reference
- **Dev**: `yarn dev`
- **Build**: `yarn build`
- **Check**: `yarn lint`, `yarn format`, `yarn check-types`
- **DB**: `yarn db g <name>`, `yarn db up`, `yarn db seed`

## Module Deep Dives
- [apps/backend/AGENTS.md](apps/backend/AGENTS.md)
- [apps/frontend/AGENTS.md](apps/frontend/AGENTS.md)
- [packages/AGENTS.md](packages/AGENTS.md)
- [packages/ui-mui/AGENTS.md](packages/ui-mui/AGENTS.md)
- [packages/zod-schemas/AGENTS.md](packages/zod-schemas/AGENTS.md)
