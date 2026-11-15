# Frontend Agent Guidelines (AGENTS.md)

## 1. Blueprint
**Intent**: Online-only web client for Kosh. Every read and write is an oRPC call;
the browser keeps no application data.
**Core Stack**: React 19, Vite 7, React Router 7, TanStack Query + oRPC, MUI,
Better Auth, Sentry.

**Key Architectures**:
- **Server is the source of truth**: portfolio figures are computed on the backend
  over the full ledger. There is no local database, no web worker, no sync
  protocol and no offline write queue. Do not add one.
- **Session**: `authLoader` (`src/utils/auth.loader.ts`) fetches the Better Auth
  session for every authenticated route and redirects to `/auth` when there is
  none. Pages read it with `useSessionInfo()`.
- **Access is decided on the server**: every list the client gets is already
  limited to accounts the signed-in person can see, each with their level
  (`view` / `edit` / `owner`). The client sends no team or tenant id; it only
  hides actions the level does not allow.
- **PWA shell**: the service worker (see `src/sw/AGENTS.md`) exists for install,
  the update prompt and push notifications only.

---

## 2. Decision Records
| ID | Title | Status | Description |
|---|---|---|---|
| [ADR-F07] | Online-only client | Accepted | No Dexie/IndexedDB, Comlink workers, OPFS or sync engine. Supersedes ADR-F01–F06 (worker proxies, per-user Dexie DB, pull-delta sync, wave-1 anchor, active-team header, OPFS uploads). |
| [ADR-F08] | Server state via TanStack Query | Accepted | Use `orpc.<router>.<proc>.queryOptions()` / `mutationOptions()`; invalidate the affected queries on mutation success. No hand-rolled caches. |

---

## 3. Technical Guidelines

### Module Structure
```
src/
├── modules/<module>/
│   ├── pages/
│   ├── components/
│   └── <module>.router.tsx
├── components/                 # app shell (layout/), notifications, PWA
├── copy/                       # the wording board as code: nav, empty states
├── configs/nav.config.tsx      # the destinations, once
├── sw/                         # service worker (see src/sw/AGENTS.md)
└── utils/
    ├── auth.loader.ts          # session gate for authenticated routes
    ├── orpc.client.ts          # RPC link (cookies, CSRF header)
    └── orpc.tanstack.client.ts # TanStack Query bindings
```

### Data Access
```tsx
import { orpc } from "@frontend/utils/orpc.tanstack.client";

const { data } = useQuery(orpc.portfolio.listAccounts.queryOptions());
const create = useMutation(orpc.portfolio.createPerson.mutationOptions());
```

### Offline Behaviour
`OfflineBanner` tells the user the app needs a connection. Nothing is queued:
a request made while offline simply fails and the user retries.

### Design system (read before building any screen)
The look of Kosh lives in `packages/ui-mui`, in four layers (see
`packages/ui-mui/AGENTS.md` and `docs/kosh/06-build-plan.md` §2):

1. **Tokens** — `theme/tokens.ts`, the only file with colours, shadows, fonts.
2. **Theme** — MUI theme with light + dark as CSS variables; component overrides.
3. **Kit** — `kosh/*`: `LevelBadge`, `HolderAvatar`, `BrokerMark`, `Money`,
   `Percent`, `Tag`, `Banner`, `SectionCard`, `HeroCard`, `Stat`, `RowItem`,
   `EmptyState`, `FilterChips`, `Segmented`, `ResponsiveDialog`, `ConfirmDialog`,
   bars, `useSnack`, icons by meaning (`IconOwner`, not "a key").
4. **App** — pages compose kit components and call oRPC. Nothing else.

Rules, enforced by `yarn lint:design` (blocking in CI):
- No colour literal, `rgb()` or font family in `apps/frontend`. Use
  `theme.vars.palette.kosh.*` in `sx` callbacks, or a kit component.
- No direct `@mui/*` import in `apps/frontend`; import through
  `@connected-repo/ui-mui/...`. Add a re-export there if one is missing.
- Need something the kit lacks? Add it to the kit and to the `/kit` gallery
  (`src/modules/kit`), then use it. Do not restyle MUI in a page.
- Every routed screen is a `<Page title=…>` (`components/layout/Page.tsx`): it
  sets the h1 on desktop, the app-bar title on a phone, and the tab title.
- Amounts and rates go through `<Money>` / `<Percent>`; never format by hand.
- Say what happened with `useSnack()` (or `notify()` outside React).
- Words come from `src/copy/*` — "Can view", "Can edit", "Owner", "person",
  "remove"; never role, tenant, grant, revoke, user.

### UI Standards
- **Motion**: 200–300ms transitions; honours reduced-motion (handled by the theme).
- **Imports**: Direct imports only (NO barrel exports).
- **Responsive**: `xs` for phone, `md`+ for desktop. Touch targets min 44px.
- **Shell**: sidebar on desktop, app bar + four bottom tabs on a phone
  (`components/layout/AppShell.tsx`); destinations are declared once in
  `configs/nav.config.tsx`.

### Testing
- **E2E**: Playwright tests are state-dependent. Use conditional logic.
- **Unit**: vitest (`src/**/*.test.ts`) for pure logic.
