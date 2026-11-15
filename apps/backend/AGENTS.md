# Backend Agent Guidelines (AGENTS.md)

## 1. Blueprint
**Intent**: Robust, event-driven oRPC backend with strict schema enforcement and zero-downtime compatibility.
**Core Stack**: oRPC, Orchid ORM, pg-tbus, Better Auth, Novu.

**Key Architectures**:
- **Event-Driven**: `pg-tbus` for async tasks (notifications, usage tracking) and events.
- **Online-only API**: plain request/response oRPC. There is no sync protocol, no pull-bundle endpoints and no silent-push cron.
- **Backward Compatibility**: N-1 frontend support; additive-only migrations; two-step deletions.
- **Access Per Account**: the broker account is the unit of access. `access_grants` holds every permission: a user gets `view` / `edit` / `owner` on one account, or on a holder (`persons`), which covers all that holder's accounts including future ones. `rpcPortfolioProcedure` loads the caller's access once per request into AsyncLocalStorage (`lib/request-context.ts`); every account-scoped table's default scope filters on it, and anything that changes data calls `requireAccountLevel` / `requirePersonLevel` (`modules/portfolio/services/access.portfolio.service.ts`). An account the caller cannot see is `NOT_FOUND`, never `FORBIDDEN`. There are no teams, no tenant column and no `x-team-id` header.
- **External API keys**: `teams_api` (key-authenticated OpenAPI consumers) is a separate, unrelated tenancy.

---

## 2. Active Task
**Context**: Building Kosh phase by phase per `docs/kosh/06-build-plan.md` (its table says where each phase stands).
**Current Status**: Server side of phases 2–7 is in: sharing, statements and questions, market data, returns, splits and bonuses, dividends, fees, and Kosh's own statement layout for any broker.
**Where things live** (`src/modules/`):
- `portfolio` — people, accounts, groups, access (`access.portfolio.service.ts` is the only place levels are decided), the directory, activity.
- `imports` — preview / apply / undo of statements; `questions` — what Kosh could not work out, and the answers.
- `market-data` — downloads (stored verbatim in `provider_payloads`), closes, the sync.
- `metrics` — the per-account day-by-day series (in memory, keyed by `ledgerVersion:pricesVersion:today`) and everything computed from it: returns, holdings, groups compared, what-if.
- `corporate-actions`, `dividends`, `fees` — each registers itself with the series (`setQuantityFactorSource`, `setDividendSource`, `setFeeSource`) rather than being imported by it.
- Anything that changes an account's ledger calls `onLedgerChanged(accountId)`; anything that changes what the figures mean calls `bumpLedger(accountId)`.
**Tests**: each module has a `*.test.ts` that drives the real routers as different people against Postgres. Contracts are zod schemas in `packages/zod-schemas/src/kosh/*` and every endpoint declares its `.output()`.

---

## 3. Decision Records
| ID | Title | Status | Description |
|---|---|---|---|
| [ADR-B01] | Additive Migrations | Accepted | Never rename/drop in one deployment to avoid downtime. |
| [ADR-B02] | Mutex Cron | Accepted | Prevent concurrent cron runs via a Postgres advisory lock (`pg_try_advisory_xact_lock`), safe across replicas. |
| [ADR-B03] | Soft Delete | Superseded | Was mandatory for sync tombstones. Kosh ledger tables never delete: retraction is a superseding event (docs/kosh/01-architecture.md §3). |
| [ADR-B04] | Files Merge On Create | Accepted | Use .merge() on create to capture asynchronous metadata. |
| [ADR-B05] | Backend Hardening | Accepted | Strict SSRF guards on webhooks, dummy hashes for API keys, and server-side access scoping (per account). |
| [ADR-B06] | No setOnCreate Beside A Runtime Default | Accepted | Never put a `setOnCreate` column on a table whose `id` uses `ulidWithDefault()` — orchid-orm 1.73 swaps the two values on insert. |

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
- **Descriptive IDs**: `userId`, `accountId` (PascalCase class, snake_case columns).
- **Account-scoped tables**: carry `accountId` and the `scopes.default` filter on `ctx.accountIds` (copy `cash_flows.table.ts`). A table without an `accountId` is not protected by the safety net.

### oRPC Endpoints
```typescript
// Portfolio data: rpcPortfolioProcedure — reads are already limited to the
// caller's accounts; a write states the level it needs.
export const apply = rpcPortfolioProcedure
  .input(schema)
  .handler(({ input }) => {
    requireAccountLevel(input.accountId, "edit"); // 404 if unseen, 403 if view-only
    return doTheWrite(input);
  });

// Session only, no portfolio data: rpcProtectedProcedure.
```

### Event Bus (pg-tbus)
- **Emit**: `tbus.emit(eventDef, payload)`.
- **Tasks**: `tbus.registerTask(taskDef, handler)` with exponential backoff.

### Security
- **Auth**: Better Auth for sessions; `api-key-auth` for external.
- **Procedures**: Use `rpcSensitiveProcedure` for data-destructive actions.

### Testing
- **Vitest**: Test all CRUD operations against the real test database. `defaultContext` (from `test/setup.ts`) is a signed-in user; `createUserAndLogin()` makes another. Drive routers with `createRouterClient(router, { context })`, or call services inside `requestContext.run(await loadAccess(user), ...)`. Any new endpoint that touches an account needs a test for each level (see `access.test.ts`).

## Quick Reference
- **DB**: `yarn db g <name>`, `yarn db up`, `yarn db seed`
- **OpenAPI**: `yarn gen:openapi`
