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
- **Tenancy**: every portfolio row carries `family_id` (→ `families`). `rpcFamilyProcedure` puts the caller's family in AsyncLocalStorage; tables stamp and filter on it. No teams, no workspace switching, no `x-team-id` header.
- **Online-only**: no Dexie/IndexedDB, no web workers, no sync protocol. Reads and writes are oRPC calls.
- **Strict TS**: NO `any`, NO `as unknown`, NO `ts-ignore`.

---

## Layer 2: Active Task
- **Objective**: Foundation simplification — online-only, families instead of teams.
- **Status**: Completed.
- **Context**: Offline-first layer (workers, Dexie, OPFS, sync protocol) and the teams module removed; `families` + `users.family_id` is the tenant. Import pipeline has DB-level tests again. Next: the first usable slice — accounts + import UI and fund-flow XIRR (docs/kosh/05-roadmap.md).

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
| [ADR-012] | Backend Security Hardening | Accepted | Implementing strict SSRF guards, dummy hashes for timing attacks, and strict tenant scoping (now `familyId`, see ADR-016). |
| [ADR-013] | Novu Push Notifications | Accepted | Implemented FCM token synchronization and notification dispatch using Novu with optimistic DB-first tracking. |
| [ADR-014] | Silent Sync Trigger | Superseded by ADR-015 | Implemented FCM silent pushes to wake up the app for background sync, bypassing OS notifications. |
| [ADR-015] | Online-Only Client | Accepted | Kosh has no offline data layer: no Dexie/IndexedDB, workers, OPFS, sync protocol or silent-sync push. Portfolio figures are server-computed over the full ledger, so a local copy could only be stale. The service worker stays for install, update prompt and push. |
| [ADR-016] | Families, Not Teams | Accepted | A login belongs to exactly one household. `families` + `users.family_id` replaces teams_app/team_members; `rpcFamilyProcedure` scopes every request. No multi-team membership, roles, switching or `x-team-id`. `teams_api` (external API keys) is unrelated and unchanged. |
| [ADR-017] | Tenant Column Is A Runtime Default | Accepted | `koshFamilyId` fills `family_id` via a runtime default, never `setOnCreate`: orchid-orm 1.73 swaps the values of a setOnCreate column and a runtime-default column (`id`) on insert. See `db/base_table.ts`. |

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
