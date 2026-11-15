# Backend Agent Guidelines (AGENTS.md)

## 1. Blueprint
**Intent**: Robust, event-driven oRPC backend with strict schema enforcement and zero-downtime compatibility.
**Core Stack**: oRPC, Orchid ORM, pg-tbus, Better Auth, Novu.

**Key Architectures**:
- **Event-Driven**: `pg-tbus` for async tasks (notifications, usage tracking) and events.
- **Online-only API**: plain request/response oRPC. There is no sync protocol, no pull-bundle endpoints and no silent-push cron.
- **Backward Compatibility**: N-1 frontend support; additive-only migrations; two-step deletions.
- **Family Tenancy**: every portfolio table carries `family_id` (→ `families`). `rpcFamilyProcedure` resolves the caller's family from `users.family_id` and runs the handler inside an AsyncLocalStorage scope; `t.koshFamilyId()` stamps it on insert and each table's default scope filters on it. Handlers never pass or check `familyId`. There are no teams, roles or `x-team-id` header.
- **External API keys**: `teams_api` (key-authenticated OpenAPI consumers) is a separate, unrelated tenancy.

---

## 2. Active Task
**Context**: Foundation simplification — sync protocol and teams module removed; `families` is the tenant.
**Current Status**: Completed. The import pipeline is covered by DB-level tests (`modules/imports/zerodha_import.test.ts`) and tenancy by `modules/portfolio/portfolio.test.ts`.
**Intent**: Ready for the first usable slice (accounts + import UI, fund-flow XIRR).

---

## 3. Decision Records
| ID | Title | Status | Description |
|---|---|---|---|
| [ADR-B01] | Additive Migrations | Accepted | Never rename/drop in one deployment to avoid downtime. |
| [ADR-B02] | Mutex Cron | Accepted | Prevent concurrent cron runs via a Postgres advisory lock (`pg_try_advisory_xact_lock`), safe across replicas. |
| [ADR-B03] | Soft Delete | Superseded | Was mandatory for sync tombstones. Kosh ledger tables never delete: retraction is a superseding event (docs/kosh/01-architecture.md §3). |
| [ADR-B04] | Files Merge On Create | Accepted | Use .merge() on create to capture asynchronous metadata. |
| [ADR-B05] | Backend Hardening | Accepted | Strict SSRF guards on webhooks, dummy hashes for API keys, and server-owned `familyId` scoping. |
| [ADR-B06] | Tenant Column Is A Runtime Default | Accepted | Never put a `setOnCreate` column on a table whose `id` uses `ulidWithDefault()` — orchid-orm 1.73 swaps the two values on insert. `koshFamilyId` uses a runtime default instead (see `db/base_table.ts`). |

## Technical Guidelines

### Module Structure
```
src/
├── modules/<module>/
│   ├── tables/
│   ├── routers/
│   └── events/
├── procedures/ (public, protected, sensitive, open_api)
├── db/ (db.ts, base_table.ts)
└── events/ (tbus setup)
```

### Database & Migrations
- **Auto-Gen**: `yarn db g <name>` is MANDATORY.
- **Descriptive IDs**: `userId`, `familyId` (PascalCase class, snake_case columns).
- **Family-scoped tables**: add `familyId: t.koshFamilyId()` and the `scopes.default` familyId filter (copy `persons.table.ts`).

### oRPC Endpoints
```typescript
// Portfolio data: rpcFamilyProcedure — family is stamped and filtered for you.
export const create = rpcFamilyProcedure
  .input(schema)
  .handler(({ input }) => db.persons.create(input));

// Session only, no portfolio data: rpcProtectedProcedure.
```

### Event Bus (pg-tbus)
- **Emit**: `tbus.emit(eventDef, payload)`.
- **Tasks**: `tbus.registerTask(taskDef, handler)` with exponential backoff.

### Security
- **Auth**: Better Auth for sessions; `api-key-auth` for external.
- **Procedures**: Use `rpcSensitiveProcedure` for data-destructive actions.

### Testing
- **Vitest**: Test all CRUD operations against the real test database. `defaultContext` (from `test/setup.ts`) is a signed-in user with their own family; `createUserAndLogin()` makes another. Call services directly inside `requestContext.run({ familyId, userId }, ...)`.

## Quick Reference
- **DB**: `yarn db g <name>`, `yarn db up`, `yarn db seed`
- **OpenAPI**: `yarn gen:openapi`
