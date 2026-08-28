# Finance PWA architecture

Last reviewed: 2026-08-27

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

`src/features/transactions/transaction-kind.tsx` is the single owner of
transaction-kind product presentation. It derives its ordered kind list from
the generated `Constants.public.Enums.transaction_kind` and maps every kind,
in one exhaustive `Record`, to its label, footnote, description placeholder,
sign, named color classes, and inline SVG mark. The form, the list, and the
delete dialog consume that record instead of repeating their own copy. The
generated enum stays the type and runtime source of truth, so adding a value
without product metadata fails type checking.

## Data boundary

Versioned migrations own the PostgreSQL schema. `supabase db reset` applies
them to a clean local database and then loads deterministic development data
from `supabase/seed.sql`. Dashboard edits are not part of the development
workflow, and seed data is not pushed to production.

`starting_positions` stores one signed opening balance per user. It stays
separate from `transactions`, so an opening balance never inflates income.
`transactions` supports one-time `income`, `expense`, `daily`, and `savings`
rows. Every amount is a positive magnitude and the kind carries the direction:
`income` adds to available balance and the other three subtract from it.
`daily` marks routine spending that feeds the projection delivered in
roadmap step 8, and `savings` reserves value without being reclassified as
an expense. A kind outside the enum fails while PostgreSQL casts the RPC
argument, as `22P02`. Money uses integer centavos and financial dates use
PostgreSQL `date`.

RLS protects both tables. Authenticated users can read only rows whose
`user_id` matches `auth.uid()`, and anonymous roles receive no table access.
The idempotent `initialize_starting_position` function derives the owner from
the access token. Exact wire types, grants, and errors live in
[`finance-rules.md`](finance-rules.md).

Transaction reads use direct table access with the existing owner-only RLS
policy. Monthly reads query `transaction_date >= monthStart` and
`< nextMonthStart`, order by `transaction_date desc, created_at desc, id desc`,
page 200 rows with `.range()`, pass `AbortSignal`, and are keyed as
`['transactions', userId, 'month', month]` and `['transactions', userId,
'detail', id]`. Direct `insert`, `update`, and `delete` privileges remain
revoked from `authenticated`; writes use three narrowly granted RPCs.

The transaction mutation RPCs use `security definer` because `security
invoker` would inherit the caller's intentionally read-only table privileges
and could not perform the write. Each function derives ownership from
`auth.uid()`, accepts no user ID, schema-qualifies database objects, sets an
empty `search_path`, and returns only a caller-owned row. Execute privileges are
revoked from `public` and `anon` and granted to `authenticated` and
`service_role`. Create uses its client-generated transaction ID for idempotent
retries; update and delete lock the owned row `for update` and compare its
exact `updated_at` before mutating it.

Writes are not optimistic. Mutations stay pending until focused invalidation
finishes: create invalidates the returned month, update invalidates the
original and returned months plus detail (`setQueryData` for the authoritative
detail row), delete removes the detail query and invalidates only the deleted
row's month with `refetchType: 'all'`. Buttons stay disabled while pending and
failures keep the form or dialog intact. Offline replaces reads with the
online-required state and disables submit while keeping a draft editable.

Routing keeps the financial workspace under `/app?month=YYYY-MM` and exposes
`/_authenticated.app_.transactions.new` and
`/_authenticated.app_.transactions.$transactionId.edit` as full-page sheets
that do not inherit `_authenticated.app` layout or its missing-month redirect.
The add and edit sheets confirm in the top chrome with the word `Lançar`; delete
lives inside the edit sheet's form `footer` slot, inside the same `min-h-svh`
scroll, and requires confirmation. Unsaved forms use `useBlocker` with a custom
dialog and `beforeunload`; a shared `unsaved-changes` context prevents
`updateServiceWorker(true)` while dirty. The document canvas owns the page
background via `html:has([data-page-canvas])` so a `min-h-svh` sheet does not
leave a white strip on standalone iOS.

## Application composition

`src/main.tsx` mounts React with `createRoot`. `AppProviders` supplies one
`QueryClient`, and TanStack Router renders the route tree generated from
`src/routes/`. The router Vite plugin runs before the React plugin and enables
automatic route code splitting.

Tailwind CSS v4 runs through its Vite plugin. Semantic CSS custom properties in
`src/styles/index.css` define the light and dark palettes, while components use
those tokens instead of embedding theme colors.

## Styling boundary

`src/styles/index.css` owns application color literals. Its `--finance-*`
custom properties map the shipped legacy palette to semantic roles and expose
those roles to Tailwind through `@theme inline`. Components consume classes
such as `bg-panel`, `text-ink`, and `text-expense-ink`; they do not repeat
palette values. Each transaction kind owns a dot, soft background, and ink
triple in both schemes, so `daily` and `savings` are named categories rather
than reused expense colors. The coral family maps the legacy red fill, soft
background, ink, and ring separately from the orange expense category. Derived states and
shadows use `color-mix()` from existing tokens instead of adding
component-specific colors. `index.html` and `vite.config.ts` duplicate the
canvas values required by manifest metadata, and `index.html` supplies the
Apple touch icon; the public SVG and PNG icon assets carry the fixed
light-scheme brand colors. The favicon still lives at `/favicon.svg` and is
excluded from the manifest-based icon assertion that covers the three PWA
icons and the Apple touch icon.

The application UI uses the platform system font. Monetary values alone use a
4,660-byte JetBrains Mono subset containing the currency punctuation, signs,
and digits that the product renders. Vite fingerprints the font because it
lives under `src/assets/`, and `index.html` preloads that same generated asset.

The authenticated workspace uses two small translucent capsules in a
zero-height sticky carrier. The month scope stays on the left and account and
add actions stay on the right while transaction rows scroll behind them. The
carrier remains in document flow so the network banner pushes the controls
down instead of colliding with them, and both surfaces consume the top
safe-area inset independently so the sticky header retains its inset after the
banner scrolls away; a banner at the very top leaves a 47 px double count that
is accepted until a scroll-aware handoff is measured. The page reserves top
and bottom space for the capsules, `.finance-safe-x` protects horizontal
controls, and fixed dialogs remain above the bottom safe area.

## Authentication boundary

`src/features/auth/auth-service.ts` is the only feature boundary that calls
`supabase.auth`. `AuthSessionProvider` owns the browser session and waits for
the initial Auth event before the router mounts. Recovery events remain
distinct from ordinary authenticated sessions. A non-sensitive user ID marker
retains recovery mode across reloads and clears on logout or identity change,
so a password-recovery session cannot open `/app`.

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
bunx supabase status
bunx supabase db reset
bunx supabase test db
bun run db:types
git diff --exit-code -- src/lib/supabase/database.types.ts
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local
bun run build
```

Observed on 2026-08-26 on `feat/transactions` `a6e442c`: `supabase db reset`
applied `20260825010000` and `20260825020000`, `71` pgTAP checks across `2`
files, `database.types.ts` reproducible (`git diff --exit-code` clean),
`0` `oxlint` warnings, `219` Vitest tests across `27` files, `34` Playwright
cases (`auth`, `bootstrap`, `transactions-read/create/edit/delete`) on
`mobile-chromium` and `desktop-chromium` against local Supabase, and a
production build with `38` precached entries and `workbox.runtimeCaching: []`
(`vite.config.ts:58`) so financial responses are never cached. Build logs
contain no access token, `service_role` key, or financial payload.

Component tests cover the controlled service-worker update decision and the
transaction `R$ 50` create → reload → edit → move → delete path with conflict
and failure recovery. Browser tests cover the `360 px` and desktop layouts,
client-route navigation, recovery from an unknown route, manifest, icons, and
service-worker output, with Auth and Data API against real local Supabase and
RLS isolation between two users. A local browser proves the responsive shell,
but it does not substitute for a Netlify Deploy Preview or installation tests
on a physical Android phone and iPhone, which remain explicit pre-beta checks.
