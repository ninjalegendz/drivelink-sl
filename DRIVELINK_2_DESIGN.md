# DriveLink 2.0: Design System and Revamp Rules

This branch (`ui-revamp`) is a full visual and UX revamp of DriveLink. It must
stay mergeable into `main`: same routes, same data, same business rules, same
security boundaries. Only presentation and interaction change.

Read this whole file before touching a screen.

## 1. The idea: "calm precision"

DriveLink is used by nervous first-time renters on a phone, often outdoors,
and by small rental businesses answering customers between handovers. Premium
here does not mean decoration. It means:

1. **One obvious next step per screen.** The primary action is visually
   unmistakable. Secondary actions are quieter (secondary/ghost buttons, text
   links).
2. **Less chrome, more content.** Fewer boxes inside boxes. Cards are for
   repeated records (a vehicle, a booking). Page sections use whitespace and
   headings, not borders.
3. **Photography does the selling.** Vehicle photos are large, rounded,
   edge-to-edge in their card, never cramped.
4. **Numbers are first-class.** Prices, deposits, dates and counts are large,
   `tabular`, and never hidden in small grey text.
5. **Fast.** No new npm dependencies. Server components by default. CSS-only
   carousels (scroll-snap). Skeletons that match final layout.
6. **Mobile first, desktop generous.** Design at 390px, then widen. Desktop is
   the same flow with more room (two columns, sticky side panels), never a
   different product.

## 2. Tokens (already live in `src/app/globals.css`)

The whole app is written against Tailwind `slate` and `blue`. Both scales
were redefined, so **keep using `slate-*` and `blue-*` classes**:

- `blue-600` = `#006BFE`, the key pin in the logo. Primary actions, links,
  focus, active states. `blue-700` for hover and small text on white.
- `blue-950` = `#001A5A`, the logo navy. Also `bg-navy` / `bg-navy-deep`.
- `slate-*` is a navy-tinted neutral. Text: `slate-950` headings,
  `slate-900` strong body, `slate-600` body, `slate-500` secondary,
  `slate-400` placeholders and disabled only.
- Status colours keep one meaning each: `emerald` done/positive, `amber`
  needs attention, `rose` real risk or blocked. Never invent a new meaning.
- Page ground is `bg-canvas` (`#f6f8fb`). Cards are white.
- Radius ladder: inputs/buttons `rounded-lg` (12px), small tiles
  `rounded-xl` (16px), cards and photos `rounded-2xl` (20px), sheets and
  hero panels `rounded-3xl` (28px), pills `rounded-full`.
- Shadows are soft and layered: `shadow-xs` (resting card), `shadow-md`
  (hover/raised), `shadow-lg`/`shadow-xl` (floating: menus, sticky bars,
  booking panel), `shadow-2xl` (dialogs).
- Prefer hairlines as `ring-1 ring-slate-900/[0.06]` over `border
  border-slate-200` on cards. Borders are fine on inputs and dividers.
- Motion utilities: `animate-fade-up` (section entrances), `animate-fade-in`,
  `animate-scale-in` (menus, dialogs), `animate-sheet-up`, `spring-press`
  (tap feedback), `spring-hover` (card lift on hover devices only). Keep it
  subtle; never animate on every render of a list item.
- Other utilities: `glass-bar` (frosted white for floating chrome),
  `glass-dark` (frosted dark over photos), `tabular`, `scrollbar-none`,
  `mask-fade-x` (fade edges of horizontal scrollers), `bg-brand-gradient`
  (navy + blue glow panel), `skeleton-shimmer`.

### Typography (Poppins only, enforced)

Poppins is the only typeface anywhere. Never import another font.
`font-extrabold` renders at 700 now; prefer `font-semibold` for headings and
`font-bold` only for prices and hero lines. Headings get `tracking-tight`.

| Role | Classes |
| --- | --- |
| Hero (marketing) | `text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight` |
| Page title | `text-2xl sm:text-3xl font-semibold tracking-tight text-slate-950` (use `<PageHeader>`) |
| Section title | `text-lg sm:text-xl font-semibold tracking-tight text-slate-900` |
| Card title | `text-base font-semibold text-slate-900` |
| Body | `text-sm sm:text-base text-slate-600` |
| Meta | `text-xs text-slate-500` (13px is the floor, never smaller) |
| Eyebrow | `text-xs font-semibold uppercase tracking-[0.08em] text-blue-700` |
| Price | `text-lg`–`text-2xl font-semibold tabular text-slate-950` |

## 3. Components (in `src/components/ui`, already restyled)

Use these instead of hand-rolling. Import paths are unchanged.

- `Button` with `variant`: `primary | secondary | soft | dark | ghost |
  danger`, `size`: `sm | md | lg | xl`, `block`, `loading`.
  **For links styled as buttons use `buttonClasses({ variant, size, block,
  className })`** from `@/components/ui/Button`.
- `Card` (`default | raised | tinted | plain`, padding `none|sm|md|lg`,
  `interactive`).
- `Badge` (`green | amber | red | blue | slate`, leading dot; pass
  `dot={false}` when the badge has its own icon). `VerificationBadge`.
- `Chip` / `ChipLink` / `chipClasses(active)`: filter pills; active = solid ink.
- `Input`, `Textarea`, `inputBase`, `inputEdge(invalid)`, `Field` (label,
  hint under the control, error replaces hint).
- `Select`, `DatePicker` (custom, sheet on mobile).
- `BottomSheet` (slides up on phones, centred dialog on desktop).
- `ConfirmDialog`, `PageHeader`, `Section`, `PageShell` / `pageShellClass`,
  `EmptyState` (`bare` inside cards), `Stat` (optional `icon`), `Skeleton`,
  `SkeletonText`, `SkeletonVehicleCard`, `Timeline` / `TimelineStep`,
  `ActionBar` (floating sticky action on phones, sits above the tab bar).
- Layout: `NavbarShell` (+ `Avatar` export), `MobileNav` (floating tab bar),
  `Footer`, `CommandPalette` (Ctrl/Cmd+K or `/`; call
  `openCommandPalette()` from any button to open it).

Mobile tab bar geometry: fixed, `bottom = max(0.75rem, safe-area)`, 4rem
tall. Anything sticky at the bottom on phones must sit at
`bottom-[calc(5.5rem+env(safe-area-inset-bottom))]` (see `ActionBar`), and
pages inside the dashboard/admin shells already have `pb-28` on mobile.

## 4. Non-negotiable product rules

1. **Do not change behaviour.** Keep every data query, server action, API
   call, permission/capability check, redirect, form field name, validation
   and analytics event exactly as it is. If a component is split for
   presentation, the data it receives must be identical.
2. **Keep the explanatory code comments** that describe *why* something
   works the way it does (iOS label bugs, RLS reasons, money wording). Move
   them with the code; update them if the markup they describe changes. Match
   the existing comment style (plain sentences explaining why).
3. **Copy rules** (founder's standing rules):
   - No em dash or en dash characters anywhere in copy (`—` `–`). Use a
     comma, colon, full stop, `|` in titles, or `-` only for numeric ranges.
   - Never expose strategy or growth stage on renter-facing pages: no "free
     while we build", "right now", "currently", "hand-picked", "we list only",
     or explanations of where ratings come from.
   - Money statements say who is paid, what for, and that DriveLink does not
     hold deposits. Do not reword legal, insurance or money disclaimers beyond
     tone; keep their meaning exactly.
   - Say "Request this vehicle", not "inquiry". "Rental Page" for the
     provider's space; "host" or "rental business" on vehicle pages.
4. **Accessibility:** 44px minimum tap targets, visible focus, labels on
   every control, status never conveyed by colour alone, `aria-*` kept.
5. **13px minimum text.** `text-xs` is the floor.
6. **No horizontal overflow at 360px.**
7. **No new dependencies.** lucide-react is the icon set.

## 5. Page patterns

- **Marketplace pages** get the global `Navbar`/`Footer` from the
  `(marketplace)` layout. Use `pageShellClass("wide")` etc for columns.
- **Hero panels** are inset rounded panels (`rounded-3xl`, photo or
  `bg-brand-gradient`), not full-bleed slabs, except the homepage hero.
- **Lists of records** are cards with a photo/thumbnail left, text middle,
  status badge and the one action right (stacking on phones).
- **Detail pages**: content left, sticky action panel right on desktop
  (`lg:sticky lg:top-24`), floating `ActionBar` on phones.
- **Empty states** always say what is missing and give the one fixing action.
- **Loading** uses skeletons shaped like the final content.

## 6. Local preview

- The revamp dev server runs on **http://127.0.0.1:3100** (already running;
  do not start another one, and never stop it).
- Production has no public listings yet, so `DRIVELINK_DEMO_DATA=1` in
  `.env.local` fills search, homepage and vehicle pages with 12 sample
  listings (`src/lib/demo/fixtures.ts`, slugs start with `demo-`). This is
  inert in production builds. Example detail page:
  `/vehicles/demo-toyota-corolla-2019-colombo`.
- Signed-in screens are previewed under `/design/...` (404 in production;
  see `src/app/design/layout.tsx`). Build those previews by rendering the
  real presentational components with sample props, never by bypassing auth
  in real routes.
- Screenshots: from the repo root run
  `MSYS_NO_PATHCONV=1 node scripts/revamp-shots.mjs /route /other` (Git Bash
  needs `MSYS_NO_PATHCONV=1` or it rewrites `/route` into a Windows path).
  Options: `WIDTHS=390,1440` (default), `FULL=0` for first screen only.
  Output lands in `revamp-shots/`. Look at your screenshots and iterate.
- Checks: `npx tsc --noEmit` and `npx eslint <your files> --max-warnings=0`.
  Other people are editing other files at the same time; only fix errors in
  files you own.
