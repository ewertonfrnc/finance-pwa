# Design system and iOS shell implementation plan

Status: complete, with the 2026-08-27 shell follow-up implemented on
`fix/design-system-shell`

Last reviewed: 2026-08-27

Roadmap step: 5

Planning branch: `chore/plan-design-system`

Delivery branch: `feat/transactions`

## Outcome

Replace the marketing-derived visual layer of `finance-pwa` with the color,
typography, and chrome vocabulary of the legacy `finance-app`, expressed in a
way that reads as an iOS application rather than a website.

This step changes how the product looks and how its chrome behaves. It does not
add a financial capability, a route, a table, or an RPC. Every screen that
exists before this branch exists after it, with the same accessible names and
the same behavior.

## Why this comes before the ledger

The Saldos screen the product is aiming at is a daily-balance ledger: one row
per calendar day, including days without movement, with an end-of-day balance
cell colored by tier. That screen is delivered in roadmap step 8. It is built
directly on the tokens, the numeral font, and the floating chrome defined here.

Building the ledger first would mean choosing those values inside a feature
branch and revisiting every screen afterwards. Building them first means the
ledger consumes a settled system.

## Starting point

The following exists on the delivery branch and must be preserved:

- `src/styles/index.css` owns every semantic token through `@theme inline` and
  two `--finance-*` blocks, one for light and one under
  `@media (prefers-color-scheme: dark)`;
- sixteen source files consume those tokens through Tailwind utilities and none
  of them contains a color literal;
- `index.html` declares PWA metadata, an apple touch icon, and a
  `width=device-width, initial-scale=1.0` viewport;
- `src/app/authenticated-app-page.tsx` renders a sticky translucent header
  containing the brand link, the account email, a logout button, and
  `MonthSelector`;
- `src/features/transactions/transactions-page.tsx` renders the monthly
  transaction list with loading, empty, offline, and error states;
- `src/components/brand-mark.tsx` renders the one-color Trajeto symbol;
- Vitest component tests cover the authenticated page, the month selector, and
  the transactions page; Playwright covers the real Auth and read paths.

## Scope

Include:

- the color token layer, replaced wholesale;
- the typography layer: system UI font plus one subsetted monospace face for
  monetary numerals;
- viewport, safe-area, and scroll behavior appropriate to a standalone iOS PWA;
- floating capsule chrome on the authenticated workspace, replacing the sticky
  header;
- updated component tests for any accessible name or structure that moves.

Exclude:

- the week strip, the tier dots, and the "Hoje" pill, which need the daily
  balance data delivered in roadmap step 8;
- inset grouped list primitives and the sheet chrome, which land with the
  transaction form in roadmap step 4;
- the `daily` and `savings` category tokens, which land with the enum migration
  in roadmap step 6;
- balance tier tokens, which land with the ledger in roadmap step 8;
- swipe-to-delete, context menus, and View Transitions;
- any change to routing, data fetching, RPCs, RLS, or the service worker;
- a design system package, a component library dependency, or a token build
  step.

## Decisions

### The color system comes from `legacy/finance-app`, not from the doc

`legacy/finance-app/docs/desing-system/Design System.html` documents Diários as
amber (hue 80) and Economia as blue (hue 235). The shipped
`legacy/finance-app/src/lib/designTokens.ts` uses magenta `#a623cd` for Diário
and olive `#7cab2d` for Economia, and that is what the running application
shows. The shipped values win. The HTML document is a stale artifact and is not
a source of truth for this migration.

### Token names stay; token values change

`--finance-canvas`, `--finance-panel`, `--finance-ink`, `--finance-muted`, and
`--finance-line` already carry the roles that `bg`, `surface`, `text`, `mute`,
and `hair` carry in the legacy system. Renaming them would churn sixteen files
for no user-visible result. The names stay and the values are replaced.

Two exceptions require call sites to change:

- `--finance-accent` inverts polarity. Lime is a light fill that carries dark
  text; teal is a mid fill that carries white text. A new
  `--finance-accent-contrast` token names the text color on the accent fill.
- category color splits into three roles, following the legacy `ColorTriple`:
  `dot` marks a chip or icon, `bg` fills that chip, and `ink` is the only one
  safe as text. `transaction-list.tsx` currently paints monetary text with the
  dot-level color and must move to the ink-level token.

### Measured contrast

The ratios below were recalculated on 2026-08-25 with the WCAG relative
luminance formula. The accent ink row uses the browser-resolved result of the
delivered `color-mix()`, not the approximate hex from the original plan.

| Pair                                       | Ratio  | Verdict                                  |
| ------------------------------------------ | ------ | ---------------------------------------- |
| Retired `#c9f277` fill on `#f3eee4` canvas | 1.10:1 | Fill is invisible; cannot carry state    |
| `#328f97` accent on `#ffffff`              | 3.81:1 | Graphical objects only, fails small text |
| Resolved accent-ink on `#ffffff`           | 4.58:1 | Safe for small text                      |
| Retired `#123c35` ink on `#328f97` fill    | 3.20:1 | Fails; replaced by accent-contrast       |
| `#129868` income dot on `#ffffff`          | 3.67:1 | Chip fill only, fails as numerals        |
| `#0b593f` income ink on `#ffffff`          | 8.35:1 | Safe for numerals                        |
| `#bf5317` expense dot on `#ffffff`         | 4.70:1 | Safe, but reserved for the chip          |
| `#79320d` expense ink on `#ffffff`         | 9.23:1 | Safe for numerals                        |

### Expense orange and danger red are different colors

The legacy system separates `saida` orange `#bf5317` from `ds-red` `#bd413f`.
An outgoing transaction is not an error and must not look like one. Destructive
confirmations and validation failures use the red family; expenses use orange.

### Derived values use `color-mix`, not new hex

The legacy design system states that no new color is invented for a component:
a new value comes from an existing token or from a mix. `--finance-ink-soft`,
hover states, and pressed states follow that rule so the palette stays auditable
against `designTokens.ts`.

### Typography: system UI, plus one subsetted monospace

The UI font becomes the platform font. This yields SF Pro on iOS, Roboto on
Android, and Segoe on Windows, costs zero bytes on the critical path, and is
what makes an unstyled control read as native. `--finance-font-display` is
removed rather than repointed, because a token that resolves to the same stack
as `--finance-font-sans` is dead weight that will rot. Its seventeen call sites
are deleted in the same commit.

Monetary numerals keep JetBrains Mono. Vertical digit alignment is what makes a
column of amounts comparable at a glance, and it is the strongest inherited
signature of the product. The cost is bounded by subsetting to the glyphs the
product actually renders.

The subset must include the Unicode minus `U+2212`, which
`transaction-list.tsx` already renders, and not only the ASCII hyphen.

### iOS reference language: Calendar on iOS 26

The reference is the native Calendar application, not the iCloud web client.
What transfers:

- floating translucent capsules over scrolling content, in place of full-width
  fixed bars; the scope control sits left, the action group sits right;
- a bottom-left pill carrying a word rather than an unlabeled icon, shown only
  when the anchor it returns to is off screen;
- a current-position rule with a labeled pill in the margin, replacing a 3%
  background tint that disappears in practice;
- explanatory footnote text below a grouped card rather than a persistent
  instructional card inside the flow;
- `›` for a control that pushes a screen versus `⌄` for a control that opens a
  menu in place, so the user knows whether they lose their position.

What must not transfer:

- the red accent. In Calendar, red is the brand and marks today. Here red
  already means a negative balance tier, so a red "today" would read as a daily
  financial alert. Today is teal.
- floating chrome positioned over the balance column. Calendar rows end in a
  short discardable time; ledger rows end in the number the screen exists to
  show. The bottom chrome sits left or centered, and the scroll container
  reserves padding equal to the chrome height plus the bottom safe area, so the
  final row of the month is never born hidden.
- a segmented control in the navigation bar for transaction type. In Calendar
  it switches entity and therefore the whole form. Here type is a field that
  does not change which fields exist, and four segments do not fit a navigation
  capsule at 390 px.
- unconditional `backdrop-filter`. Blur over a long scrolling list is the
  expensive case. It is acceptable on small capsules and must be measured
  before it is applied to anything full width.

### Fidelity limits of a PWA

These are accepted, not worked around:

- `navigator.vibrate` is unsupported in Safari on iOS, so no interaction may
  depend on haptic confirmation; press feedback stays visual;
- a standalone iOS PWA has no edge-swipe back gesture, so every pushed screen
  carries an explicit back control.

## Delivery steps

Each step is one focused commit on `chore/design-system`. The branch is
squash-merged as `chore: adopt the finance design system` after the full gate
passes.

### 1. Replace the color token layer

Status: completed on 2026-08-25 in `23b76b9`

Update:

- `src/styles/index.css`: replace every `--finance-*` color value in the light
  block and the `prefers-color-scheme: dark` block with the corresponding
  `DS_COLORS` entry from `legacy/finance-app/src/lib/designTokens.ts`; add
  `--finance-accent-contrast`, `--finance-line-strong`, `--finance-faint`,
  `--finance-income-ink`, and `--finance-expense-ink`; expose the new tokens
  through `@theme inline`; replace the hardcoded `#123c35` in the `::selection`
  rule with `var(--finance-accent-contrast)`;
- `src/features/home/home-page.tsx`: the `bg-accent` badge at line 132 carries
  `text-ink`, which measures 3.20:1 against the new accent; move it to
  `text-accent-contrast`;
- `src/features/transactions/transaction-list.tsx`: amounts move from
  `text-income` and `text-expense` to `text-income-ink` and `text-expense-ink`;
  the icon chip keeps the dot-level and soft-level tokens.

Do not add `daily`, `savings`, or balance tier tokens in this step. They arrive
with their consumers in roadmap steps 6 and 8.

Acceptance criteria:

- `/`, `/login`, `/offline`, an unknown route, and `/app` render at 390 by 844
  and 1280 by 800 CSS pixels, in light and dark, with no element rendering dark
  text on the teal accent fill;
- the "Em construção" badge on the public home page is legible against its
  fill;
- monetary amounts in the transaction list use the ink-level color and remain
  distinguishable between income and expense without relying on the sign alone;
- a color-literal audit finds no colors in components or TypeScript source
  outside `src/styles/index.css` and generated database types. `index.html`
  duplicates the two canvas values for `theme-color` metadata, which cannot
  consume CSS custom properties. The broad hex grep also matches two Auth test
  URL fragments beginning with `#access_token`; those inspected matches are
  not CSS colors;
- no test changes are required, because no accessible name or structure moves.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run build
```

Runtime check: serve the production build and inspect the five routes above at
both widths in both schemes. Stop the server afterwards.

Observed locally on 2026-08-25 in the production build. `/`, `/login`,
`/offline`, an unknown route, and authenticated `/app` rendered at 390 by 844
and 1280 by 800 in both schemes without horizontal overflow, clipped content,
or dark text on a teal fill. The authenticated route used the real local Auth
and Data API with two transaction fixtures.

Commit:

```text
feat: adopt the finance color system
```

### 2. Replace the typography layer

Status: completed on 2026-08-25 in `b87af58`

Create:

- `src/assets/fonts/jetbrains-mono-money.woff2`, a subset limited to the glyphs the
  product renders in monetary context: digits, `R`, `$`, `.`, `,`, space, the
  ASCII hyphen, the Unicode minus `U+2212`, and `+`.

The source file lives under `src/assets/` rather than `public/` because Vite
copies public assets without a fingerprint. The build then rewrites the CSS and
preload references to the same fingerprinted output.

The subset is produced with the documented command below and its provenance is
recorded as a comment beside the `@font-face` rule. The observed file size is
4,660 bytes.

```bash
curl -sG 'https://fonts.googleapis.com/css2' \
  --data-urlencode 'family=JetBrains Mono:wght@500;600' \
  --data-urlencode 'text=0123456789R$.,-−+ ' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
```

Update:

- `src/styles/index.css`: point `--finance-font-sans` at
  `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`; add
  `--finance-font-mono` and its `@theme inline` key; add the `@font-face` rule
  with `font-display: swap` and an explicit `unicode-range`; remove
  `--finance-font-display` and its `@theme inline` key; add
  `-webkit-text-size-adjust: 100%` so iOS respects the user text size;
- `index.html`: preload the woff2 with `crossorigin`;
- the seventeen `font-display` call sites across `src/app/`,
  `src/features/`, and `src/components/`, which are deleted rather than
  rewritten;
- `src/features/transactions/transaction-list.tsx`: amounts gain `font-mono`
  and keep `tabular-nums`.

Acceptance criteria:

- at 390 by 844, monetary amounts render in JetBrains Mono and every other
  string renders in the platform UI font, confirmed by inspecting the computed
  `font-family` of one amount and one label;
- a column of amounts of differing magnitude aligns on the decimal separator;
- the produced woff2 is at most 12 KB; a larger file means the subset is wrong;
- the production build emits the font with a fingerprinted name and the
  preload resolves without a console warning;
- the only `font-display` occurrence in `src/` is the required
  `font-display: swap` declaration in the `@font-face` rule;
- existing component tests pass without modification, because font choice
  changes no accessible name.

Observed locally on 2026-08-25 at 390 by 844: both monetary values resolved to
JetBrains Mono 600 with tabular numerals, while the "Entrada" label resolved to
the system UI stack. The values' decimal separators shared the same horizontal
coordinate. The clean browser tab loaded the 4,660-byte fingerprinted font
through the preload without a console warning.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run build
git grep -n "font-display" -- src | grep -v "font-display: swap"
```

Runtime check: serve the production build, confirm the two computed font
families and the network entry for the font, then stop the server.

Commit:

```text
feat: adopt the finance typography scale
```

### 3. Set viewport, safe area, and scroll behavior

Status: completed on 2026-08-25 in `a85ce0c`

Update:

- `index.html`: extend the viewport to
  `width=device-width, initial-scale=1.0, viewport-fit=cover`; change
  `apple-mobile-web-app-status-bar-style` to `black-translucent` so content
  extends under the status bar; update `theme-color` to the new canvas value,
  with a `prefers-color-scheme` pair;
- `src/styles/index.css`: add `overscroll-behavior-y: contain` on `body` to
  suppress the page-level rubber band in standalone mode; keep
  `.finance-safe-top` and `.finance-safe-bottom` and add
  `.finance-safe-x` for horizontal insets in landscape.

Acceptance criteria:

- at 390 by 844 with no insets, the five routes render exactly as they did
  after step 2, with no shifted or clipped content;
- with `.finance-safe-top` overridden to 47 px and `.finance-safe-bottom` to
  34 px through a devtools style override, no header control, no first list
  row, and no primary action is obscured;
- vertical rubber-band scrolling no longer detaches the page body;
- pinch zoom still works; the viewport does not set `user-scalable=no`.

Validation:

```bash
bun run check
bun run test
bun run build
```

Observed locally on 2026-08-25 at 390 by 844: `/`, `/login`, `/offline`, an
unknown route, and the authenticated `/app` had no horizontal overflow or
clipped controls. With 47 px of simulated top inset and 34 px of simulated
bottom inset, the header controls, primary action, and first transaction row
remained visible. The computed vertical overscroll behavior was `contain`, and
the viewport preserved zoom support.

Physical iPhone captures supplied on 2026-08-25 show `/app` in Safari and as an
installed standalone PWA. In both captures, the header clears the status bar
and no horizontal content or control is clipped. The standalone capture fills
the display without browser chrome. The Safari capture is scrolled farther down,
so the eyebrow has moved under the sticky header; this is a scroll-position
difference, not a safe-area regression.

The static captures do not verify the `black-translucent` style in isolation,
landscape horizontal insets, pinch zoom, the bottom safe inset with content
anchored to the bottom, or physical rubber-band behavior. These checks remain in
the roadmap step 10 device pass.

Correction observed on 2026-08-26, from the installed iPhone PWA. The deferred
bottom-inset check failed on the first surface that exercised it. Standalone iOS
measures `100svh` as the screen height minus the top safe-area inset while
`viewport-fit=cover` lays content out from the physical top, so a `min-h-svh`
element that paints its own background stops short of the home indicator by
exactly that inset and leaves the document canvas showing. The strip measured
about 61 pt against a top inset of about 61 pt.

The shell now settles this instead of each page: `body` no longer repeats a
background, because only the root element's background propagates to the
document canvas, and the canvas is the one surface that covers the full screen
and the overscroll bounce. A page needing a backdrop other than
`--finance-canvas` declares `data-page-canvas`, and
`html:has([data-page-canvas='subtle'])` follows it. Viewport units were not
widened to `lvh` or `dvh`: neither covers the overscroll bounce, and `lvh` would
overshoot the visible area in a Safari tab.

The device confirmed the strip is gone. Rubber-band behavior, landscape insets,
and pinch zoom stay deferred to the roadmap step 10 pass.

Commit:

```text
feat: extend the app under iOS safe areas
```

### 4. Replace the workspace header with floating chrome

Status: completed on 2026-08-25 in `4b1a3a2`

Create:

- `src/components/glass-capsule.tsx`: the translucent rounded container used by
  both the scope control and the action group. It exists because it has two
  call sites in this commit, not in anticipation of a third.

Update:

- `src/app/authenticated-app-page.tsx`: the sticky bordered header is replaced
  by two pinned capsules over the scrolling content. The left capsule holds the
  month scope; the right capsule holds the account and add actions. The brand
  link and the account email leave the workspace chrome, because a floating
  capsule cannot carry an email address at 390 px; the account action keeps its
  accessible name;
- `src/features/transactions/month-selector.tsx`: renders inside the left
  capsule and drops its own outer grid sizing;
- `src/features/transactions/transactions-page.tsx`: the scroll container
  reserves top and bottom padding equal to the chrome height plus the
  respective safe-area inset;
- `src/app/authenticated-app-page.test.tsx` and
  `src/features/transactions/month-selector.test.tsx` for any accessible name
  or structure that moved;
- `tests/e2e/auth-login.spec.ts` and `tests/e2e/transactions-read.spec.ts` if
  they locate the logout control through the removed header structure.

Acceptance criteria:

- at 390 by 844, the month control and the action group float above the list
  and list rows scroll behind them;
- the first and last rows of the list are fully readable and reachable; neither
  is covered by a capsule at any scroll position;
- the month title, "Mês anterior", "Próximo mês", the account action, and the
  add action keep their accessible names and a minimum 44 by 44 CSS pixel
  target;
- keyboard-only traversal reaches every control in a sensible order with a
  visible focus ring, including the controls inside the floating capsules;
- at 1280 by 800 the layout remains centered and bounded rather than stretching
  the capsules across the viewport;
- both schemes keep the capsule readable against list content scrolling
  underneath, including behind a tier-free white row and a dark row;
- `prefers-reduced-motion` suppresses any capsule transition.

The chrome uses a zero-height sticky carrier instead of viewport-fixed
positioning. This keeps the offline banner in document flow so it pushes the
capsules below itself, while transaction rows still pass behind the chrome.
The unavailable add action uses `aria-disabled` rather than native `disabled`
so keyboard traversal can still reach it and expose its explanatory text.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e
bun run build
```

Runtime check: sign in against the local Supabase stack, scroll a month with
enough rows to pass content under both capsules, and confirm the first and last
rows. Check `bunx supabase status` first; start the stack only if it was
stopped and stop it afterwards.

Observed locally on 2026-08-25 at 390 by 844 in light and dark schemes and at
1280 by 800 in the light scheme. The capsules remained readable and bounded,
all four controls measured 44 by 44 CSS pixels, rows scrolled behind the
chrome, and the first and last rows remained reachable. Simulated offline mode
wrapped the network banner without colliding with the capsules. Automated
coverage verifies keyboard order, the focusable unavailable add action,
reduced motion, list clearance, and sticky position. Physical-device review on
iPhone remains part of the release gate.

Commit:

```text
feat: float the workspace chrome over the ledger
```

### 5. Close the design system step

Status: complete

Update:

- `docs/architecture.md` with the styling boundary: where tokens live, that no
  source file carries a color literal, the font strategy, and the chrome model;
- `docs/plans/04-one-time-transactions.md` if the delivered chrome changes an
  assumption in its pending form steps;
- this plan with delivered commit IDs, the observed font byte size, the
  re-verified contrast ratios, and any deferred device check;
- `docs/implementation-plan.md` to mark roadmap step 5 complete.

Acceptance criteria:

- every ratio in the contrast table above is re-verified with a checker and the
  measured value recorded;
- the plan states which checks were observed locally and which were deferred to
  the device pass, without claiming the deferred ones passed.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local
bun run build
```

Verification record, 2026-08-26:

- the production route matrix covered all five routes at 390 by 844 and 1280
  by 800 in light and dark, with no horizontal overflow;
- `/app` resolved ordinary text to the system UI stack and amounts to the
  fingerprinted 4,660-byte JetBrains Mono subset;
- the month controls, logout, and add action each measured 44 by 44 CSS pixels;
- the full unit suite, local Playwright suite, static checks, type check, and
  production build passed;
- physical iPhone captures verify the safe-area shell before the floating
  chrome change. The floating capsules, landscape insets, pinch zoom, bottom
  inset with bottom-anchored content, physical rubber-band behavior, and
  Android installation remain in the roadmap step 10 device pass.

Follow-up, 2026-08-26. The token sweep missed two places, found while reviewing
the installed app:

- the manifest in `vite.config.ts` still carried `#f3eee4` and `#123c35`, the
  retired canvas and ink. Both now read `#ffffff`, matching the light canvas and
  the light `theme-color` meta. A manifest holds one value and cannot express a
  `prefers-color-scheme` pair, so a dark-scheme launch shows a light screen
  until the document loads and the meta takes over. Startup images per device
  size are the only alternative and do not pay for themselves yet;
- the PWA icon PNGs still carry the retired palette: `#123c35` tile with
  `#c9f277` art in `pwa-192x192-v3.png`, `pwa-512x512-v3.png`, the maskable
  variant, and `apple-touch-icon-v3.png`. The in-app `brand-mark.tsx` renders an
  ink tile with `--finance-mark-accent`, so the installed symbol and the
  in-product symbol are from different color systems. Regenerating them needs a
  `-v4` cache-bust across the manifest and `index.html` plus a reinstall on a
  device to prove the new icon replaced the cached one, so it earns its own
  step rather than riding along here.

Resolution follow-up, 2026-08-27:

- `app-icon.svg` and the four cache-busted `v4` PNGs now use the light ink
  `#1a2e35` and teal `#328f97`; `favicon.svg` also uses the same palette but
  keeps `/favicon.svg` without a versioned filename and is excluded from the
  manifest-based icon assertion that covers the three PWA icons and the Apple
  touch icon. The manifest, Apple metadata, and E2E assertions reference the
  versioned `v4` PNGs and reject the retired colors;
- the legacy red soft background, ink, ring, and contrasting foreground are
  exposed as coral tokens. Error and destructive UI uses that family instead
  of the expense category, and the dark destructive buttons measure 6.67:1;
- the public header, global offline banner, and fixed dialogs consume their
  top and bottom safe-area insets independently so the sticky header retains
  its inset after the banner scrolls away; a banner visible at the very top
  still counts the top inset twice, and this 47 px double count is accepted
  until a scroll-aware handoff is measured;
- every public Auth control now measures at least 44 by 44 CSS pixels, verified
  with a landmark-aware assertion that requires at least one measurable control
  per public route;
- the amount input uses only glyphs present in the monetary subset, and the
  delete summary and form amount render their amounts in JetBrains Mono
  verified with the loaded `FontFace` status plus the computed `fontFamily`;
- local production inspection covered 390 by 844 light and dark, simulated
  47 px top and 34 px bottom insets, offline-banner handoff, and the dirty-draft
  dialog. Physical icon replacement and the remaining device checks stay in
  roadmap step 10.

Validation follow-up, 2026-08-27:

- static checks, TypeScript, unit tests, the production build, and 32
  non-conflict Playwright cases pass;
- the full local Playwright command reaches 32 passes and four timeouts in the
  existing update/delete conflict cases. PostgREST 14.17 retries the
  application-level `SQLSTATE 40001` instead of returning it to the client, so
  a forward database correction is required outside this visual follow-up.

Delivered commits:

```text
23b76b9 feat: adopt the finance color system
b87af58 feat: adopt the finance typography scale
a85ce0c feat: extend the app under iOS safe areas
4b1a3a2 feat: float the workspace chrome over the ledger
```

Commit:

```text
docs: close the design system step
```

## Relationship to other plans

This plan supersedes the "Visual direction" section of
[`04-one-time-transactions.md`](04-one-time-transactions.md), which named the
warm canvas and lime accent as the source of truth and excluded Liquid Glass
vocabulary. That section now points here.

The following decisions are recorded in this plan but delivered elsewhere, so
that the owning step does not re-derive them:

| Decision                                                | Delivered in               |
| ------------------------------------------------------- | -------------------------- |
| `daily` and `savings` category triples                  | roadmap step 6             |
| Inset grouped lists, sheet chrome, footnote helper text | roadmap step 4, form steps |
| Balance tier palette and its non-hue second channel     | roadmap step 8             |
| Week strip with tier dots                               | roadmap step 8             |
| "Hoje" pill and the today rule with a labeled pill      | roadmap step 8             |

## References

- `legacy/finance-app/src/lib/designTokens.ts` — the authoritative palette
- `legacy/finance-app/global.css` — the token-to-role mapping
- `legacy/finance-app/src/components/balance/DayRow.tsx` — the ledger row this
  system is built to serve
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [MDN `backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- [MDN `env()` and safe area insets](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
