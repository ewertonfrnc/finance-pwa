# Finance PWA architecture

Last reviewed: 2026-08-25

## Scope

Finance PWA is one responsive, mobile-first web application. It does not share
runtime contracts or releases with the legacy Finance and Folga applications.
The public product name is still open, so `Finance PWA` and `Finance` are
temporary manifest labels only.

The first release uses Supabase for authentication and financial data. The
browser may cache the application shell, but financial reads and writes remain
online-only.

## Toolchain baseline

The bootstrap was checked against each project's current official
documentation and the npm `latest` dist-tag on 2026-08-24. Exact resolved
versions live in `bun.lock`; compatible ranges live in `package.json`.

| Area                        | Baseline                                 | Official reference                                                                                            |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Runtime and package manager | Bun 1.4.0                                | [Bun install and lockfile](https://bun.sh/docs/pm/lockfile)                                                   |
| UI                          | React 19.2.8                             | [React `createRoot`](https://react.dev/reference/react-dom/client/createRoot)                                 |
| Build                       | Vite 8.2.2 and React plugin 6.1.0        | [Vite React guide](https://vite.dev/guide/)                                                                   |
| Language                    | TypeScript 7.0.2 with bundler resolution | [TypeScript `moduleResolution`](https://www.typescriptlang.org/tsconfig/moduleResolution.html)                |
| Routes                      | TanStack Router 1.170.32                 | [Manual setup](https://tanstack.com/router/latest/docs/framework/react/installation/manual)                   |
| Remote state                | TanStack Query 5.102.3                   | [`QueryClientProvider`](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClientProvider) |
| Database client             | Supabase JS 2.112.4                      | [JavaScript client setup](https://supabase.com/docs/reference/javascript/installing)                          |
| Database tooling            | Supabase CLI 2.115.0                     | [Local development CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)               |
| Styling                     | Tailwind CSS 4.3.3                       | [Vite installation](https://tailwindcss.com/docs/installation/using-vite)                                     |
| PWA                         | Vite PWA 1.3.0 and Workbox Window 7.4.1  | [React integration](https://vite-pwa-org.netlify.app/frameworks/react.html)                                   |
| Static analysis             | Oxlint 1.80.0 and Prettier 3.9.6         | [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config)                                         |
| Unit and component tests    | Vitest 4.1.11 and Testing Library        | [Vitest configuration](https://vitest.dev/config/)                                                            |
| Browser tests               | Playwright 1.62.1                        | [Playwright configuration](https://playwright.dev/docs/test-configuration)                                    |
| Hosting                     | Netlify                                  | [Vite deployment](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)                     |

Oxlint uses its stable JSON configuration. Its JavaScript and TypeScript
configuration format is still documented as experimental, so it is not used.
The built-in TypeScript, React, hooks, refresh, accessibility, and Vitest rules
avoid an unsupported TypeScript 7 and `typescript-eslint` combination. No
deprecated ESLint configuration helper is present.

## Source boundaries

```text
src/
  app/          application composition, providers, router, PWA lifecycle
  components/   shared presentational components
  features/     business-facing pages, UI, services, schemas, and queries
  lib/          small framework-independent utilities
  routes/       thin TanStack Router route declarations
  styles/       Tailwind entrypoint and design tokens
supabase/
  migrations/   versioned database changes
  tests/database/ pgTAP authorization and finance-rule tests
tests/e2e/       browser-visible user paths
```

Route files only connect paths to feature-owned pages. Future Supabase calls
belong in small feature services, and TanStack Query owns their remote cache.
Shared client state will not be added until a concrete requirement exists.

## Data boundary

Versioned migrations own the PostgreSQL schema. `supabase db reset` applies
them to a clean local database and then loads deterministic development data
from `supabase/seed.sql`. Dashboard edits are not part of the development
workflow, and seed data is not pushed to production.

`starting_positions` stores one signed opening balance per user. It stays
separate from `transactions`, so an opening balance never inflates income.
`transactions` initially supports only one-time `income` and `expense` rows.
Money uses integer centavos and financial dates use PostgreSQL `date`.

RLS protects both tables. Authenticated users can read only rows whose
`user_id` matches `auth.uid()`, and anonymous roles receive no table access.
The idempotent `initialize_starting_position` function derives the owner from
the access token. Exact wire types, grants, and errors live in
[`finance-rules.md`](finance-rules.md).

## Application composition

`src/main.tsx` mounts React with `createRoot`. `AppProviders` supplies one
`QueryClient`, and TanStack Router renders the route tree generated from
`src/routes/`. The router Vite plugin runs before the React plugin and enables
automatic route code splitting.

Tailwind CSS v4 runs through its Vite plugin. Semantic CSS custom properties in
`src/styles/index.css` define the light and dark palettes, while components use
those tokens instead of embedding theme colors.

## Authentication boundary

`src/features/auth/auth-service.ts` is the only feature boundary that calls
`supabase.auth`. `AuthSessionProvider` owns the browser session and waits for
the initial Auth event before the router mounts. Recovery events remain
distinct from ordinary authenticated sessions, so a password-recovery link
cannot open `/app`.

The resolved Auth state reaches TanStack Router through `RouterContext`. The
pathless `_authenticated` route protects `/app` in `beforeLoad`; PostgreSQL
grants and RLS still authorize financial data. A logout or authenticated user
ID change clears the TanStack Query cache before the next identity renders.
Refreshes for the same user keep the cache.

## Installability and updates

Vite PWA generates the web app manifest and Workbox service worker during a
production build. The manifest supplies 192 px, 512 px, maskable, and Apple
touch icons with a standalone display mode.

The service worker precaches only the application shell and fingerprinted
static files. `runtimeCaching` is empty: Supabase, authentication, and financial
responses are never cached. The offline route explains that financial features
require a connection, and the network status component exposes the current
state to assistive technology.

Registration uses the React `useRegisterSW` hook with prompt behavior. When a
new worker is waiting, the app offers **Atualizar agora** and **Depois**. It
only asks the worker to activate and reload after explicit confirmation, which
protects future unsaved transaction forms.

## Environments and deployment

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` may reach the
browser. `.env.example` contains names, not credentials. A Supabase secret or
`service_role` key must never use a `VITE_` prefix.

`netlify.toml` builds with Bun 1.4.0, publishes `dist/`, serves `index.html` for
client routes, gives fingerprinted assets long-lived immutable caching, and
forces revalidation for the HTML, manifest, service worker, and Workbox files.
Its explicit Netlify Dev block prevents TanStack Router's package from being
misdetected as a full-stack framework and proxies the Vite server on port 5173.
Production tracks `main`. Netlify production builds use the
`finance-pwa-prod` Supabase project, while Deploy Previews and other hosted
non-production contexts use `finance-pwa-dev`. Netlify stores separate
contextual values for the public Supabase URL and publishable key; no Supabase
secret reaches a Vite build. Supabase Auth allows a preview wildcard only in
the development project and exact callback URLs only in production.

## Verification boundary

The local gate is:

```bash
bunx supabase start
bunx supabase db reset
bunx supabase test db
bun run db:types
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local
bun run build
```

Component tests cover the controlled service-worker update decision. Browser
tests cover the 360 px and desktop layouts, client-route navigation, recovery
from an unknown route, manifest, icons, and service-worker output. A local
browser proves the responsive shell, but it does not substitute for a Netlify
Deploy Preview or installation tests on a physical Android phone and iPhone.
