# PlanTopo — Architecture Plan

## Overview

Hiking trip planning and recording app with a web client and Android app.

## Architecture

- **TypeScript API server** (Express + tRPC) serves both the API and the web
  client as static files
- **React SPA** (Vite) for the web client — full planning features, interactive
  maps, custom projections
- **Native Kotlin Android app** for GPS recording — foreground service, battery
  optimization, offline storage
- **WebView** embedded in the Android app loads the web client for planning
  features
- Planning and recording are decoupled — they interact through the backend, not
  directly

## Repositories

Two repos:

- **TypeScript monorepo** — API, web client, and shared code as a pnpm/npm
  workspace
- **Android repo** — standalone Gradle project, opens cleanly in Android Studio

## TypeScript Workspace Layout

```
plantopo/
  packages/
    api/
    web/
    shared/          # shared types, pure utility functions
  package.json     # "workspaces": ["packages/*"]
  tsconfig.json
  eslint.config.ts
  vitest.config.ts
```

Package manager: npm. Workspace scope: `@pt`. Packages are never published —
local workspace dependencies.

## API Package Structure

Domain-based organization with role-based file naming (`{domain}.{role}.ts`):

```
api/src/
  server.ts              # Express + tRPC setup, static file serving
  migrate.ts             # Runs pending migrations
  router.ts              # Merges domain routers, exports AppRouter type
  context.ts             # Request context: db, pg-boss, auth session
  trpc.ts                # tRPC init, base procedures (public, authed)
  db.ts                  # Drizzle client

  lib/
    db.ts                # Transaction helpers, pagination
    geo.ts               # Pure coordinate math
    geo-db.ts            # PostGIS query builders

  auth/
    auth.ts              # Better Auth instance, plugin config
    auth.router.ts
    auth.schema.ts
    auth.service.ts

  trips/
    trips.router.ts
    trips.schema.ts
    trips.service.ts

  tracks/
    tracks.router.ts
    tracks.schema.ts
    tracks.service.ts
    tracks.jobs.ts
```

Roles: **router** (tRPC procedures), **service** (business logic + Zod input
schemas), **schema** (Drizzle tables), **jobs** (pg-boss handlers), **test**
(colocated).

Cross-domain imports are fine. External service clients live in the consuming
domain (`trips/strava.client.ts`) and move to `lib/` or their own domain if a
second consumer appears.

## Key Libraries

- **API framework:** Express + tRPC
- **Runtime:** Node (plain, no Bun)
- **Database:** PostgreSQL + Drizzle ORM
- **Background jobs:** pg-boss (Postgres-backed, runs in the API process)
- **Validation:** Zod (input schemas defined in service files, shared with
  router)
- **Authentication:** Better Auth (with bearer plugin)
- **Web client:** React SPA via Vite
- **Client state:** React Query (via `@trpc/react-query`) for server state;
  `PlanEditor` class for editor state
- **Testing:** Vitest + React Testing Library; Playwright for E2E if needed
- **Linting:** ESLint + Prettier

## Authentication

Better Auth handles authn/authz. Auth routes are mounted directly on Express
(`/api/v1/auth/*path`), separate from tRPC — there is no reason to wrap Better
Auth endpoints as tRPC procedures.

### Server Setup

```ts
// auth/auth.ts
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [bearer()],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

```ts
// server.ts — mount BEFORE express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));
```

### Local Dev

Register `http://localhost:3000/api/auth/callback/google` and
`http://localhost:3000/api/auth/callback/github` in separate dev OAuth apps
(Google Cloud Console and GitHub OAuth Apps). Put the credentials in
`.development.env` (gitignored).

For the test suite, a dev-only Express route signs in as a fixture user without
going through OAuth:

```ts
// Only mounted when NODE_ENV !== "production"
app.post("/api/dev/sign-in-as/:userId", async (req, res) => {
  const session = await auth.api.createSession({ userId: req.params.userId });
  // set cookie and return token so tests can use either
});
```

Tests call this endpoint in setup to get a session, avoiding any OAuth
round-trip.

### tRPC Context

Every tRPC request resolves the session once via `auth.api.getSession`. This
handles both cookies (web) and `Authorization: Bearer` headers (mobile)
transparently:

```ts
// context.ts
export async function createContext({ req, res }: CreateExpressContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return { session, db };
}
```

### tRPC Middleware

An `authedProcedure` narrows the context type so downstream procedures can
assume a valid session:

```ts
// trpc.ts
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({
    ctx: { session: ctx.session.session, user: ctx.session.user },
  });
});
```

### Web Client Auth

Same-origin — the browser sends cookies automatically. The tRPC client needs no
special headers config.

### Android Client Auth

On login, store the session token (SharedPreferences or encrypted storage).
Include it on tRPC calls as `Authorization: Bearer $token`. The bearer plugin
means `getSession` resolves it the same way as a cookie.

### Avoiding the Auth Flash

No SSR. Instead, Express middleware intercepts `index.html` serving, reads the
session cookie via `auth.api.getSession`, and injects
`<script>window.__USER__ = { id, name, email }</script>` into the HTML.

The frontend treats this as an optimistic hint:

- If `__USER__` is present: render a loading shell immediately and fire off tRPC
  data requests in parallel (no `/auth/me` round-trip needed).
- If absent: render the logged-out view immediately.
- If any tRPC request returns 401: fall back to logged-out state.

This keeps `index.html` cheap (small, stable injected payload — just id, name,
maybe avatar URL), avoids the sequential latency of load → auth check → data
fetch, and degrades naturally for offline/service worker scenarios where the
cached shell won't have the injection.

### Cookie Caching

Better Auth supports cookie caching (signed short-lived cookie to skip DB
lookups). Skipped for now — easy to enable later as a one-line config change
once optimizing. The staleness window it introduces (cached session data lags
behind DB changes for `maxAge` duration) is acceptable for PlanTopo's use case
but not worth the tradeoff during early development.

## Database & Migrations

- Drizzle schema files (`*.schema.ts`) are the source of truth
- `drizzle-kit generate` diffs schema against previous migrations, produces
  numbered `.sql` files
- Always review generated SQL before committing
- Migrations run automatically in the container entrypoint before the server
  starts
- Avoid `drizzle-kit push` once there is real data

## Deployment

Single Docker container per deploy. Multi-stage build:

1. Install dependencies
2. Build web client (Vite)
3. Compile API (tsc)
4. Slim Node image runs: `node migrate.js && node server.js`

Express serves tRPC routes and static Vite output. Managed via Podman quadlet on
a single Hetzner server alongside other personal projects. Caddy in front.

## Dev Environment

Vite used as middleware inside express using createServer api.

### Pre-commit Hooks

Husky + lint-staged at the workspace root:

- **lint-staged:** ESLint + Prettier on staged files (lint-staged stashes
  unstaged changes, ensuring checks match the actual commit)
- **tsc --noEmit:** incremental type check across the full workspace (catches
  cross-package breakage)

Target: under 2 seconds in the normal case.

### Build

- **Dev:** `tsx` (API), Vite dev server (web)
- **Production:** `tsc` (API), `vite build` (web)
- **Shared package:** raw TypeScript, no build step — consumers compile it
- **Testing:** Vitest everywhere

## Testing Strategy

Minimal tests for high coverage of key flows:

- **Unit tests** for rare, complex pure functions
- **Integration tests** for stateful components using React Testing Library with
  a real backend (not mocked) — components make real tRPC calls against a
  running dev server
- **pg-boss worker disabled in test mode** — jobs enqueue but don't run,
  eliminating side effects
- **Job handlers tested as plain functions** directly, no server needed
- **Seeds:** run once via Vitest `globalSetup`, using domain service functions
  for realistic data and direct inserts for edge cases
- Tests should be tolerant of extra data ("my thing exists" not "exactly N
  things")

## Client State Management

### React Query (via tRPC)

`@trpc/react-query` is used for all standard server-state: trip lists, track
history, user settings, trip detail views. Provides caching, background
refetching, loading/error states, optimistic updates, and
`refetchOnWindowFocus`.

### Plan Editor

The plan editor is the most complex client component and the exception to React
Query. It owns its state entirely during an editing session.

#### Why not React Query for the editor?

The editor has 60fps drag interactions, an undo stack, and a debounced sync
model. Forcing this through React Query's cache would create constant
reconciliation between React Query's server-state view and the editor's local
state, and invalidation would clobber in-flight edits.

#### Boundary

React Query fetches the trip and hands it to `PlanEditor` on mount (can use
`trpc.useUtils().client` for imperative calls outside React's render cycle).
From that point, `PlanEditor` owns all writes. When the user navigates away,
React Query invalidates the trip query so the list view picks up the latest
saved state.

#### Three state layers

1. **Map-layer state** — point positions during drag, tentative lines. Lives in
   the map library, updates at 60fps. React is not in this loop.
2. **Editor state** — canonical points, segments, snap status, metadata. Owned
   by a `PlanEditor` class. Immutable-style updates on a single `state` object.
3. **React state** — sidebar, labels, toggles. Derived from editor state via
   selectors, connected through `useSyncExternalStore`.

#### PlanEditor class

- Holds a single `state: PlanState` object
- Methods correspond to user actions (`addPoint`, `movePoint`, `setLabel`)
- Each method mutates state immutably, then calls `commit()` (which triggers
  `debouncedSave()` + `notify()`)
- Selectors (e.g. `getLabelledPoints`) are memoized with shallow equality —
  during a drag, React calls the selector 60x/sec but skips re-render if the
  result is referentially equal
- Methods and selectors exposed as arrow function properties for stable identity
  with `useSyncExternalStore`

#### Undo

State snapshots pushed before mutations. Undo pops and restores. Simple and
reliable.

#### Sync

Debounced full-state save to the server via plain tRPC mutation. No WebSockets,
no operational transform, no live collaboration for now — just enough that work
on laptop is available on phone.

For cross-device freshness without manual refresh, `refetchOnWindowFocus` or
short polling on the trip query is sufficient.

If push notifications are ever needed (e.g. "your track finished processing"),
SSE is a simpler middle ground than WebSockets and can be added as a lightweight
Express endpoint without changing the tRPC setup.

#### File structure

```
plan/
  PlanEditor.ts          # Orchestration — thin, wires collaborators
  plan.selectors.ts      # Pure queries on PlanState
  plan.types.ts          # PlanState, Point, Segment
  PlanSync.ts            # Debounced save via tRPC mutation
  SegmentSnapper.ts      # Snap-to-trail requests with debouncing
  UndoStack.ts           # Generic, maybe in lib/
```

## Android App

- Native Kotlin with Jetpack Compose for recording UI (trip list, recording
  controls, sync status)
- Foreground service with `FusedLocationProviderClient` for background location
- Offline by nature — writes to local storage, syncs when connectivity returns
- WebView loads the web client for full planning features
- Consumes tRPC endpoints as plain HTTP (`POST /api/trpc/tracks.sync` with
  JSON), authenticating via `Authorization: Bearer` header
- Small API surface: sync + auth. Kotlin data classes matching tRPC input/output
  shapes.

## Offline Support

- **Recording (native):** inherently offline, syncs later
- **Web/WebView:** progressive offline via service workers, implemented
  screen-by-screen
  - Phase 1: online-only
  - Phase 2: cache app shell so WebView loads without connectivity (the
    `__USER__` injection degrades naturally — cached shell has no injection,
    frontend handles absent user)
  - Phase 3: cache planned trip data in IndexedDB for offline viewing
  - Full offline planning is lowest priority (users typically plan before
    heading out)

## API Versioning

Not needed between web client and API (deployed as a single artifact, always in
sync). For the Android app, handle with a `/v1/` prefix or client version header
when breaking changes arise. Not needed at launch.

## Logging
