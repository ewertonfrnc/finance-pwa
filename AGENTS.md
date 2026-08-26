# Finance PWA

## Purpose

This repository contains a new personal-finance product built independently
from the legacy Finance and Folga applications. Its current technical name is
`finance-pwa`; the public product name remains undecided.

The first product goal is an installable, mobile-first web application that
helps a user record transactions, understand the current month, and see the
effect of future and recurring transactions before spending.

## Product boundaries

- Build one responsive web application. Do not create separate `web` and
  `mobile` applications.
- Treat the existing repositories under `../legacy/`, `../folga/`, and
  `../folga-api/` as behavioral references only. Do not modify them as part of
  this project unless the user explicitly requests it.
- Do not preserve compatibility with legacy HTTP contracts by default. This
  product, database, and release cycle are independent.
- Do not migrate legacy users or financial data in the initial release.
- Keep the public name open. Do not introduce `folga` into domain names,
  database objects, routes, components, or source identifiers.

## Architecture decisions

- Use Vite, React, and TypeScript.
- Use TanStack Router for routing and TanStack Query for remote state.
- Use Tailwind CSS v4 with CSS custom properties for design tokens and
  light/dark themes.
- Prefer the canonical Tailwind class over an arbitrary value that resolves to
  the same declaration. Write `tracking-tight`, not `tracking-[-0.025em]`, and
  `shadow-(--finance-shadow)`, not `shadow-[var(--finance-shadow)]`. Reserve
  bracket syntax for values the scale genuinely does not express.
- Only the root element's background reaches the document canvas. A full-screen
  surface must not paint its own page background: installed on iOS, `100svh`
  falls short of the screen by the top safe-area inset, so the uncovered strip
  above the home indicator exposes the canvas. Declare `data-page-canvas` and
  let the `html:has(...)` rule in `src/styles/index.css` follow it.
- Add Zustand only after a concrete shared client-state requirement appears.
  Do not use it for Supabase data or duplicate TanStack Query caches.
- Organize code by feature. Keep route files thin and place business-facing UI,
  schemas, queries, and services in the owning feature.
- Keep Supabase access behind small feature services. Components must not
  scatter `supabase.from(...)` or `supabase.rpc(...)` calls throughout the UI.
- Do not introduce generic repositories, dependency injection, or compatibility
  layers without a demonstrated need.

Use this target structure:

```text
src/
  app/
  components/
  features/
  lib/
  routes/
  styles/
supabase/
  migrations/
  tests/database/
docs/
```

## PWA behavior

- The application is a PWA from the first production deployment.
- Cache the app shell and fingerprinted static assets only.
- Do not cache Supabase responses, authentication responses, or financial data
  in the service worker.
- Do not support offline financial writes in the initial release.
- Show a clear offline state when a feature requires the network.
- Prompt the user before activating a new service worker version. Never reload
  while a transaction form may contain unsaved data.
- Verify installation and updates on a real Android device and a real iPhone
  before calling PWA work complete.

## Backend and data

- Use Supabase Auth and Supabase PostgreSQL.
- Enable RLS on every table that stores user-owned data.
- Derive the authenticated user with `auth.uid()` on the server. Never trust a
  user ID supplied by the client.
- Prefer `security invoker` for database functions. Use `security definer` only
  for a documented authorization need, with an explicit `search_path` and
  focused tests.
- Revoke broad function execution and grant it only to the roles that require
  it.
- Use direct table access with RLS for simple reads and simple CRUD. Use RPCs
  for financial calculations and atomic operations across multiple rows or
  tables.
- Keep financial rules in PostgreSQL functions, constraints, and policies.
  Frontend validation exists for feedback, not authority.
- Store money as integer centavos. Never use floating point for persisted or
  transported monetary values.
- Use PostgreSQL `date` and `YYYY-MM-DD` for calendar dates. Do not introduce
  timezone conversion into date-only financial events.
- Keep schema changes in versioned SQL migrations. The Supabase dashboard is
  not the source of truth.
- Never edit a migration that has reached `main`. Correct it with a new
  forward migration.
- Do not add a monthly balance cache until query measurements demonstrate a
  need.

## Authentication and security

- Never expose a Supabase secret key or `service_role` credential to the
  browser. The frontend may contain only the project URL and publishable key.
- Keep production and preview environment variables separate.
- A Netlify Deploy Preview must never perform writes against the production
  Supabase project.
- Validate authorization, amount bounds, enum values, date ranges, and payload
  shapes on the server.
- Do not log access tokens, refresh tokens, passwords, reset links, or
  financial payloads.
- Add a restrictive Content Security Policy before inviting external users.

## Hosting and environments

- Use Netlify for the Vite frontend.
- Build with `bun run build` and publish `dist/`.
- Keep SPA redirects, PWA cache headers, and security headers in
  `netlify.toml` so deployment configuration remains versioned.
- Map `main` to the production site.
- Use Netlify Deploy Previews for pull requests.
- Use Supabase locally during development. A separate cloud development
  project or Supabase Preview Branch may be introduced when a remote preview
  needs end-to-end financial mutations.

## Git workflow

- `main` contains only production-ready code and is the Netlify production
  branch.
- Do not create a long-lived `develop` branch.
- Create short-lived branches from an updated `main`.
- Use `chore/<name>`, `feat/<name>`, and `fix/<name>` branch names.
- A feature branch should deliver a vertical user-visible result. Keep its SQL
  migration, database tests, frontend service, UI, and behavior tests together.
- Merge through a pull request after required checks pass. Prefer squash merge
  and delete the branch afterward.
- Do not push directly to `main`.
- Do not commit, push, merge, create external projects, or deploy unless the
  user explicitly requests that action.

## Testing and validation

- Test what the user can observe: rendered output, navigation, submitted
  intent, persisted results, authorization, and cache invalidation.
- Use accessible names and visible text in UI tests. Avoid selectors based on
  CSS classes or component names.
- Mock Supabase at the service boundary in focused frontend tests.
- Use pgTAP database tests for RLS, constraints, RPC authorization, recurrence,
  and financial calculations.
- Give every new feature at least one user-path test and every new RLS policy an
  allowed-user and denied-user test.
- Once the scripts exist, the normal validation gate is:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e
bun run build
bunx supabase db reset
bunx supabase test db
```

- Run the smallest relevant subset while developing, then the complete gate
  before merging to `main`.
- Report only commands and runtime behavior that were actually observed.
- The gate does not lint Tailwind classes. `oxlint` and `prettier` know nothing
  about them, so a green `bun run check` is not evidence that new markup is
  clean. Tailwind's own diagnostics surface only in the editor. After changing
  markup, grep the diff for bracket-syntax classes and replace any that have a
  canonical form.

## Planning

- [`docs/implementation-plan.md`](docs/implementation-plan.md) is the living
  implementation plan.
- Keep detailed plans for multi-commit roadmap steps in `docs/plans/` and link
  them from the living plan.
- Retain completed detailed plans as decision and verification records. Mark
  their final status and move unobserved release-only checks to the later gate
  that owns them instead of deleting the plan or claiming they passed.
- Mark a step complete in the same pull request when its runtime checks finish
  before merge. If a hosted check finishes later, close the status in an
  immediate documentation follow-up and preserve which checks were observed or
  deferred.
- Keep every plan step small enough for one focused, reviewable commit with an
  observable acceptance criterion.
