# Design system and iOS shell implementation plan

Status: planned

Last reviewed: 2026-08-25

Roadmap step: 5

Planning branch: `chore/plan-design-system`

Delivery branch: `chore/design-system`

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

Ratios below are computed from the hex values against the light surface they
sit on. Re-verify each with a contrast checker during implementation; do not
treat this table as observed.

| Pair                                       | Ratio  | Verdict                                              |
| ------------------------------------------ | ------ | ---------------------------------------------------- |
| Current `#c9f277` fill on `#f3eee4` canvas | 1.10:1 | Fill is invisible; cannot carry state                |
| `#328f97` accent on `#ffffff`              | 3.81:1 | Graphical objects only, fails small text             |
| `#2c7f86` accent-ink on `#ffffff`          | 4.68:1 | Safe for small text                                  |
| `#123c35` ink on `#328f97` fill            | 3.20:1 | Fails; this pair exists today at `home-page.tsx:132` |
| `#129868` income dot on `#ffffff`          | 3.67:1 | Chip fill only, fails as numerals                    |
| `#0b593f` income ink on `#ffffff`          | 8.35:1 | Safe for numerals                                    |
| `#bf5317` expense dot on `#ffffff`         | 4.70:1 | Safe, but reserved for the chip                      |
| `#79320d` expense ink on `#ffffff`         | —      | Verify; expected well above 4.5:1                    |

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

Status: pending

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
- `git grep -nE '#[0-9a-fA-F]{3,8}' -- src ':!src/styles/index.css' ':!src/lib/supabase/database.types.ts'` returns nothing, which is true before this
  step and must remain true after it;
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

Commit:

```text
feat: adopt the finance color system
```

### 2. Replace the typography layer

Status: pending

Create:

- `public/fonts/jetbrains-mono-money.woff2`, a subset limited to the glyphs the
  product renders in monetary context: digits, `R`, `$`, `.`, `,`, space, the
  ASCII hyphen, the Unicode minus `U+2212`, and `+`.

The subset is produced with the documented command below and its provenance is
recorded as a comment beside the `@font-face` rule. Record the observed byte
size in this plan when the step runs; do not predict it.

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
- `font-display` appears nowhere in `src/`;
- existing component tests pass without modification, because font choice
  changes no accessible name.

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

Status: pending

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

Deferred and explicitly not claimed by this step: the real
`black-translucent` status bar, the true safe-area insets, and the installed
standalone presentation can only be observed on a physical iPhone. They belong
to the device pass in roadmap step 10 and must not be reported as verified
here.

Commit:

```text
feat: extend the app under iOS safe areas
```

### 4. Replace the workspace header with floating chrome

Status: pending

Create:

- `src/components/glass-capsule.tsx`: the translucent rounded container used by
  both the scope control and the action group. It exists because it has two
  call sites in this commit, not in anticipation of a third.

Update:

- `src/app/authenticated-app-page.tsx`: the sticky bordered header is replaced
  by two fixed capsules over the scrolling content. The left capsule holds the
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

Commit:

```text
feat: float the workspace chrome over the ledger
```

### 5. Close the design system step

Status: pending

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
bun run test:e2e
bun run build
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
