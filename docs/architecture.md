# Finance PWA architecture

Last reviewed: 2026-08-24

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
  migrations/   versioned database changes, introduced in step 2
  tests/database/ pgTAP authorization and finance-rule tests
tests/e2e/       browser-visible user paths
```

Route files only connect paths to feature-owned pages. Future Supabase calls
belong in small feature services, and TanStack Query owns their remote cache.
Shared client state will not be added until a concrete requirement exists.

## Application composition

`src/main.tsx` mounts React with `createRoot`. `AppProviders` supplies one
`QueryClient`, and TanStack Router renders the route tree generated from
`src/routes/`. The router Vite plugin runs before the React plugin and enables
automatic route code splitting.

Tailwind CSS v4 runs through its Vite plugin. Semantic CSS custom properties in
`src/styles/index.css` define the light and dark palettes, while components use
those tokens instead of embedding theme colors.

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
Production is expected to track `main`; pull requests are expected to use
Netlify Deploy Previews with a non-production Supabase environment whenever a
future preview can mutate data.

## Verification boundary

The local gate is:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e
bun run build
```

Component tests cover the controlled service-worker update decision. Browser
tests cover the 360 px and desktop layouts, client-route navigation, manifest,
icons, and service-worker output. A local browser proves the responsive shell,
but it does not substitute for a Netlify Deploy Preview or installation tests
on a physical Android phone and iPhone.
