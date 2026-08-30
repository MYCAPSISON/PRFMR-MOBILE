# PRFMR — UI Replication Guide

> A concise reference for any agent or developer rebuilding the PRFMR interface. Covers theme tokens, typography, icons, layout shell, card/modal sizing, and per-page component patterns.

---

## 1. Design Philosophy

- **Dark-only.** No light mode exists — the `:root` block is the single source of truth. Never add a `.dark` toggle.
- **Mobile-first, max-width capped at desktop.** The app is designed for 375–430 px phone widths. Cards stack vertically. On desktop, content sits inside a `max-w-5xl` container centred on the page.
- **Orange on near-black.** The brand accent is a vivid orange (`hsl(24 100% 50%)`). Everything else is desaturated slate.
- **Conservative and informational.** No decorative illustrations inside the app (except the onboarding splash). Data is always front-and-centre. Cards carry disclaimers where relevant.
- **Framer Motion for all transitions** — page entries, card mounts, and number changes all animate softly. Nothing snaps in instantly.

---

## 2. Colour Tokens

All defined in `client/src/index.css` as CSS custom properties in H S% L% format (no `hsl()` wrapper). Tailwind reads them through `tailwind.config.ts`.

```css
/* Backgrounds */
--background:          220 20%  7%;   /* near-black slate — page background */
--card:                220 16% 11%;   /* slightly lighter — card surface */
--secondary:           220 15% 13%;   /* inputs, pills, secondary surfaces */
--muted:               220 12% 17%;   /* dividers, subtle backgrounds */

/* Foregrounds */
--foreground:          210 10% 95%;   /* primary text */
--secondary-foreground: 210 10% 90%;
--muted-foreground:    215 10% 50%;   /* captions, placeholders */

/* Brand */
--primary:              24 100% 50%;  /* orange — hsl(24,100%,50%) = #FF7A00 approx */
--primary-foreground:    0  0% 100%;
--accent:               24 100% 50%;  /* identical to primary */
--accent-foreground:     0  0% 100%;

/* Semantic */
--destructive:           0 62% 50%;   /* red for errors/delete */
--border:              220 10% 15%;
--input:               220 10% 15%;
--ring:                 24 100% 50%;  /* orange focus ring */

/* Sidebar (desktop nav uses these) */
--sidebar-background:  220 18%  8%;
--sidebar-border:      220 12% 14%;
--sidebar-accent:      220 12% 15%;
```

### Semantic colour usage patterns

| Context | Class / value |
|---|---|
| Active nav tab | `text-primary bg-secondary` |
| Warning callout | `bg-amber-500/10 border-amber-500/20` |
| Fight Camp callout | `bg-orange-500/8 border-orange-500/20` |
| Success / good | `text-emerald-400 bg-emerald-500/10 border-emerald-500/20` |
| Danger | `text-red-400 bg-red-500/10` |
| Low EA warning | `bg-yellow-500/10 border-yellow-500/20 text-yellow-400` |
| Macro stat border (calories) | `border-l-4 border-l-primary` (orange) |
| Macro stat border (protein) | `border-l-4 border-l-blue-500` |
| Macro stat border (carbs) | `border-l-4 border-l-amber-500` |
| Macro stat border (fat) | `border-l-4 border-l-yellow-500` |
| Macro stat border (fibre) | `border-l-4 border-l-emerald-500` |

---

## 3. Typography

Three fonts, loaded via Google Fonts (`index.css` line 1) plus a base CSS rule.

### Font families

| Role | Family | Tailwind class | Weight loaded |
|---|---|---|---|
| Body / UI text | **Inter** | `font-sans` | 300, 400, 500, 600 |
| All `h1`–`h6` headings | **Space Grotesk** | `font-display` | Applied in base CSS rule |
| Monospace numbers | **JetBrains Mono** | `font-mono` | 400, 500 |

> Space Grotesk is **not** in the Google Fonts `@import` line — it is applied directly in the `h1–h6` base rule as `font-family: 'Space Grotesk', sans-serif`. Load it separately (add to the Google Fonts URL or self-host).

### Text size patterns (copy these exactly)

| Context | Classes |
|---|---|
| Page title / hero heading | `text-3xl font-display font-bold` |
| Card section heading | `text-lg font-display font-semibold` |
| Large numeric stat (macro target) | `text-3xl font-extrabold font-mono` |
| Weight / large chart number | `text-4xl font-mono font-bold tracking-tight` |
| Body copy | `text-sm` (Inter, default weight) |
| Secondary description | `text-xs text-muted-foreground` |
| Micro label / unit | `text-[10px] text-muted-foreground/70 tracking-wide uppercase` |
| Disclaimer text | `text-[10px] italic text-muted-foreground` |
| Version watermark | `text-[10px] font-mono opacity-35` |

---

## 4. Border Radius

Defined in `tailwind.config.ts` — these override Tailwind defaults:

| Token | Value | Pixels |
|---|---|---|
| `rounded-sm` | 0.1875 rem | 3 px |
| `rounded-md` | 0.375 rem | 6 px |
| `rounded-lg` | 0.5625 rem | 9 px |
| `rounded-xl` | Tailwind default (0.75 rem) | 12 px |
| `rounded-2xl` | Tailwind default (1 rem) | 16 px |
| `rounded-full` | 9999 px | pill shape |

Cards almost always use `rounded-xl`. Buttons use `rounded-md`. Pill badges use `rounded-full`.

---

## 5. Icons

**All icons come from `lucide-react`** — no other icon library is used inside app pages (except sport badge images which are PNG files, see §10).

### Standard icon sizes

| Context | Size class |
|---|---|
| Nav bar tab icons (mobile) | `h-5 w-5` |
| Card header icons | `h-4 w-4` or `h-5 w-5` |
| Inline text icons | `h-3 w-3` or `h-3.5 w-3.5` |
| Alert / badge icons | `h-3 w-3` |
| Done / success state | `h-12 w-12` |
| Floating action button | `h-5 w-5` |

### Commonly used icons and where

| Icon (lucide-react name) | Used in |
|---|---|
| `Flame` | Calories stat card |
| `Beef` | Protein stat card |
| `Wheat` | Carbs stat card |
| `Droplets` | Fat stat card |
| `Leaf` | Fibre stat card |
| `ShieldCheck` | AMQS / micronutrient score row |
| `Sparkles` | Quick Log (AI) button |
| `Edit2` | "Review" button in AI log dialog |
| `Mic` / `MicOff` | Voice input toggle |
| `CheckCircle2` | Done/success state, food item confirmed |
| `XCircle` | Food item rejected |
| `ChevronRight` | Navigation row cues |
| `ChevronDown` | Collapsible sections |
| `Info` | Info popover trigger (ⓘ) |
| `Dumbbell` | Training sessions |
| `Clock` | Duration / time |
| `Scale` | Weight logging |
| `Moon` | Sleep logging |
| `Zap` | Energy / readiness score |
| `AlertTriangle` | Warnings (low EA, low carb) |
| `TrendingDown` / `TrendingUp` | Weight trend arrows |
| `CalendarDays` | Date picker / training block |
| `Plus` | Add food FAB |
| `Copy` | Copy food entry |
| `Trash2` | Delete actions |
| `Share2` | Share moment sheet |
| `LogOut` | Logout button |
| `Camera` / `Barcode` | Barcode scanner |

---

## 6. Layout Shell

Defined in `client/src/components/layout.tsx`.

```
┌─────────────────────────────────────────────────────────┐
│ HEADER  sticky top-0 z-50                               │
│  h-16 (64 px) · bg-background/80 backdrop-blur          │
│  container px-4 sm:px-6 · flex justify-between          │
│                                                          │
│  [PRFMR logo img h-9 w-auto]   [Desktop nav — hidden    │
│                                  on mobile, gap-6]       │
│                                  Dashboard Training …    │
├─────────────────────────────────────────────────────────┤
│ MAIN                                                     │
│  container px-4 py-8 sm:px-6 lg:py-10                   │
│  max-w-5xl mx-auto                                       │
│  {page content}                                          │
├─────────────────────────────────────────────────────────┤
│ FOOTER (hidden on mobile, md:block)                      │
│  border-t py-4 px-6 text-center                         │
│  text-[11px] text-muted-foreground max-w-3xl mx-auto    │
│  Disclaimer text · Shown only if VITE_SHOW_FOOTER_TAGLINE│
└─────────────────────────────────────────────────────────┘
│ MOBILE BOTTOM NAV  md:hidden fixed bottom-0 z-50        │
│  bg-background border-t px-1 py-2 pb-safe               │
│  flex justify-around                                     │
│  Each tab: flex-col items-center gap-0.5 p-1.5 rounded-lg│
│  Icon h-5 w-5 + label text-[9px]                        │
│  Active: text-primary bg-secondary rounded-lg            │
│  Tabs: Dashboard · Training · Supplements ·              │
│        Playbook · Profile · Feedback · Log out           │
└─────────────────────────────────────────────────────────┘
```

**Mobile spacer:** `<div className="md:hidden h-20" />` is inserted after the main content to prevent the fixed bottom nav overlapping content.

**Version watermark** (desktop only): `fixed bottom-[6px] right-[8px] text-[10px] font-mono opacity-35 z-40 pointer-events-none` — shows `v{version} • {env}`.

---

## 7. Card & Surface Anatomy

All content cards use **shadcn `<Card>`** with these consistent patterns:

### Standard data card
```
rounded-xl border bg-card
CardHeader: flex-row items-center justify-between gap-1 space-y-0 pb-2
  CardTitle: text-sm font-medium flex items-center gap-2
CardContent: (varies by card)
```

### Elevated card (chart / macro cards)
```
+ className="card-elevated"
  → box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15)
  → border-color: hsl(220 12% 18% / 0.5)
```

### Interactive hover card (add `.card-hover` to an elevated card)
```
transition: box-shadow 0.2s ease, transform 0.2s ease
hover: translateY(-1px) + deeper shadow
```

### Inner section cell (e.g. macro target grid)
```
p-4 bg-secondary/50 rounded-lg text-center
Number: text-3xl font-extrabold font-mono
Label:  text-[10px] text-muted-foreground/70 tracking-wide
```

### AMQS card (custom, not shadcn Card)
```
bg-card rounded-xl p-6 amqs-card-glow space-y-6
  amqs-card-glow = box-shadow: 0 1px 2px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)
                   border: 1px solid hsl(var(--border) / 0.25)
```

---

## 8. Modal / Dialog Sizes

All dialogs use shadcn `<Dialog>` + `<DialogContent>`. Sizes on mobile are always full-width with safe margins; the `sm:max-w-*` class controls the capped width on larger screens.

| Dialog | `sm:max-w-*` | Notes |
|---|---|---|
| Quick Log (AI) | `sm:max-w-md` (448 px) | Full-screen feel on mobile |
| Add Food | `sm:max-w-[425px]` | `flex flex-col max-h-[90vh] p-0 overflow-visible` |
| AMQS nutrient detail | `sm:max-w-[400px] max-h-[85vh] overflow-y-auto` | Scrollable |
| AMQS food suggestion | `sm:max-w-[420px] max-h-[85vh] overflow-y-auto` | Scrollable |
| EA warning | `sm:max-w-sm` (384 px) | |
| Carb warning | `sm:max-w-sm` | |
| Weight update | `sm:max-w-[425px]` | |
| Weight cut stat | `max-w-sm mx-4` | |
| Training Block | `max-w-lg max-h-[90vh] overflow-y-auto p-0` | Multi-step wizard |
| Log Entry (manual) | `sm:max-w-[425px]` | |
| Copy food | `sm:max-w-[360px]` | |
| Feedback | `sm:max-w-md` | |
| Stacks | `max-w-md` | |

---

## 9. Custom CSS Utility Classes

Defined in `@layer components` in `client/src/index.css`.

| Class | Effect |
|---|---|
| `.card-elevated` | Depth shadow + slightly lighter border |
| `.card-hover` | Lift on hover (pointer devices only) — `translateY(-1px)` |
| `.progress-bar-animated` | `transition: width 0.8s cubic-bezier(0.4,0,0.2,1)` |
| `.number-animate` | `transition: all 0.3s ease-out` |
| `.fab-shadow` | Orange glow: `0 3px 10px rgba(255,122,0,0.3)` — used on the Add Food FAB |
| `.amqs-glow` | Orange text shadow on AMQS score number |
| `.amqs-card-glow` | Subtle card shadow with thin border |
| `.amqs-card-interactive` | Hover + press transitions for AMQS nutrient cards |
| `.amqs-highlight` | One-shot orange pulse animation (2 s) |
| `.pb-safe` | `padding-bottom: env(safe-area-inset-bottom)` — mobile home indicator |

**Scrollbar:**
```css
::-webkit-scrollbar { width: 6px }
::-webkit-scrollbar-track { background: transparent }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 3px }
```

---

## 10. Buttons

Using shadcn `<Button>`. The variants in use:

| Variant | Appearance | Use |
|---|---|---|
| `default` | Filled orange (`bg-primary text-white`) | Primary CTA, confirm |
| `outline` | Transparent + border | Secondary actions |
| `ghost` | Transparent, no border | Tertiary / icon buttons |
| `destructive` | Red fill | Delete actions |
| `secondary` | Dark slate fill | Neutral actions |

**Size:** `size="sm"` for compact actions (within cards), default size for main CTAs, `size="icon"` for icon-only buttons.

**FAB (floating Add Food button, mobile only):**
```
fixed bottom-24 right-4 z-40 rounded-full h-14 w-14
fab-shadow class  +  bg-primary text-white
Plus icon h-6 w-6
```

---

## 11. Badges

Using shadcn `<Badge>`. Common combinations:

| Badge | Variant | Extra classes |
|---|---|---|
| Fight Camp | default | `bg-orange-500/20 text-orange-400 border-orange-500/30` |
| AI confidence: high | — | `bg-emerald-500/20 text-emerald-400` |
| AI confidence: medium | — | `bg-yellow-500/20 text-yellow-400` |
| AI confidence: low | — | `bg-red-500/20 text-red-400` |
| AMQS tier: Elite/Optimal | — | emerald |
| AMQS tier: Good | — | blue |
| AMQS tier: Fair | — | yellow |
| AMQS tier: Basic | — | red |
| "AMQS tracked" (supplements) | default | standard |

---

## 12. Page-by-Page UI Summary

### 12.1 `/` and `/login` — Login Page

- Full-page centred layout (no `<Layout>` shell)
- Card: `max-w-md mx-auto` with `bg-card rounded-xl p-6 sm:p-8`
- PRFMR logo centred above the card
- Form fields use shadcn `Input` + `Label`
- Google OAuth button (rendered only after source selection — "join" vs "google")

---

### 12.2 `/start` — Invite / Landing Page

- Uses a **full-viewport hero image** (`attached_assets/stock_images/fight_action_1.jpg`) as a background or hero
- Text overlay: "PRFMR" in large `font-display font-bold` heading
- Invite code entry field below
- Dark overlay (`bg-background/70`) over the image for readability

---

### 12.3 `/onboarding` — Onboarding Wizard (22 steps)

**Step 0 — Splash:**
- Full-screen background image: `onboarding-splash-bg.jpeg` (fills 100vw × 100vh, `object-cover`)
- No other UI — the image has a CTA button baked into the design
- An orange `<Button>` is absolutely positioned at `bottom: 4%` over the baked-in button area of the image
- `data-testid="button-splash-cta"`

**Steps 1–22 — Survey/profile steps:**
- Card: `border-0 shadow-none bg-transparent` (borderless, no shadow)
- Progress bar track: `bg-white/5` (very subtle)
- `OptionBtn` (choice options): `ring-1 ring-primary/50` when selected, `bg-secondary/60` when unselected — no `border-2`
- Logo at top: `no_back_logo_1777367768475.png` at `height: 34px`
- Wrestling action photo used in the fight-camp intro step: `onboarding-wrestling-photo.jpg`

---

### 12.4 `/dashboard` — Main Dashboard

Page body: `<div className="space-y-8">` — all sections separated by `2rem` vertical gap.

Component order (top → bottom):

1. `<CelebrationBurst />` — Framer Motion confetti, globally overlaid
2. `<AILogDialog />` — full-screen modal, triggers from Quick Log button
3. `<EmailVerificationBanner />` — orange top bar if email unverified
4. `<WeightCutHero />` — fight camp card (conditional). Full-width `bg-card` with orange accents
5. `<MorningCheckIn />` — prompts sleep, weight, session. `rounded-xl border bg-card`
6. `<ReadinessSummaryCard />` — readiness score 0–100. Wrapped in `pt-2`
7. `<ProvisionalCheckIn />` — conditional, when data gaps detected
8. **Daily Intake Estimates card** — `rounded-xl border bg-card`
   - `CardHeader` with title, optional "Fight Camp" badge, training kcal badge, info popover
   - 2×4 macro grid: `grid-cols-2 sm:grid-cols-4 gap-4`
   - Each cell: `p-4 bg-secondary/50 rounded-lg text-center`
   - Number: `text-3xl font-extrabold font-mono`
   - Label: `text-[10px] text-muted-foreground/70 tracking-wide`
   - Conditional fight-camp callout row: `bg-orange-500/8 border-orange-500/20`
   - Conditional low-EA warning row: `bg-yellow-500/10`
   - Conditional low-carb warning row: `bg-yellow-500/10`
   - Disclaimer: `text-[10px] italic text-muted-foreground`
   - Collapsible "How estimates are calculated" section

9. **Date navigation bar** — `flex-col sm:flex-row justify-between`
   - Left: ← prev · `<input type="date">` · next → · "Today" ghost button
   - Right: weight log btn · Add Food btn (primary) · Quick Log btn (Sparkles) · Log Entry btn

10. **Greeting header** — `h1 text-3xl font-display font-bold` "Hello, {username}"

11. **Macro stats grid** — `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`
    - Each `<StatCard>`: `border-l-4` with colour per macro (see §2)
    - Flame / Beef / Wheat / Droplets / Leaf icons

12. **Macro warning banner** (conditional, one or none)
    - Over-target: `bg-amber-500/10 border-amber-500/20 rounded-xl px-4 py-3`
    - Under-calories but over a macro: `bg-card/60 border-border/40 rounded-xl px-4 py-3`

13. **AMQS mini CTA row** — `rounded-xl border border-border/50 bg-card p-4` — clickable → `/micronutrients`
    - Left: ShieldCheck + "Micronutrient Score" + score text
    - Right: ChevronRight icon

14. **Today's Supplements checklist** — `rounded-xl border bg-card`

15. **Food diary** — one `<Card>` per meal section (breakfast / lunch / dinner / snacks)
    - Meal header: label + total kcal badge
    - Per-item rows with inline edit / delete
    - "Add food to {meal}" button at bottom of each section

16. **Weight trend mini-chart** — Recharts `LineChart` with area fill

---

### 12.5 `/training` — Training Log

- Date selector at top (same style as dashboard)
- Active training block chip: `bg-secondary/50 rounded-full px-3 py-1 text-xs`
- Session cards: `rounded-xl border bg-card p-4`
  - Each session: title, time of day, estimated kcal, activity list
  - Activity rows: exercise name, duration, MET value, optional sets table
- "Add Session" FAB-style button at bottom
- Load insight panel: coloured border based on ACWR risk level

---

### 12.6 `/supplements` — Supplement Tracker

- Grid of supplement shelf cards: `grid grid-cols-1 gap-3`
- Each card: `rounded-xl border bg-card p-4`
- "AMQS tracked" badge (default variant) on supplements with a catalog ID
- Reminder time shown as `text-xs text-muted-foreground`
- "Add Supplement" button (primary, full width on mobile)

---

### 12.7 `/micronutrients` — AMQS Detail

- Top: AMQS score (large `font-mono` number) + tier badge + `.amqs-glow` class
- Grid of nutrient cards: `grid grid-cols-2 gap-3` on mobile
- Each nutrient: `amqs-card-glow amqs-card-interactive rounded-xl p-3`
- Progress bar: `progress-bar-animated` class
- Gap/goal rows: `text-xs flex flex-col gap-1 p-2 rounded bg-secondary/15`

---

### 12.8 `/profile` — Profile Page

- Avatar: circular, `h-20 w-20 rounded-full` — uses Replit Object Storage upload
- Profile fields in a `<Card>` with form layout
- Danger zone section at bottom with destructive styling

---

### 12.9 `/playbook` — Educational Content

- Accordion-based layout (shadcn `<Accordion>`)
- Section headers: `font-display font-semibold`
- Content: `prose prose-invert text-sm` (Tailwind typography plugin)

---

## 13. Animations

All via **Framer Motion**.

| Animation | Usage |
|---|---|
| `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` | Standard card/page entry |
| `transition={{ duration: 0.3 }}` | Default timing |
| `AnimatePresence` | Conditional cards (fight camp hero, morning check-in) |
| Spring physics | Confetti (`CelebrationBurst`) |
| CSS `transition: width 0.8s` | Progress bars (`.progress-bar-animated`) |
| CSS `transition: all 0.3s ease-out` | Numeric value changes (`.number-animate`) |

---

## 14. Forms

All forms use **shadcn `useForm` + `react-hook-form` + `zodResolver`**.

- Inputs: `bg-input border border-border rounded-md h-10 px-3 text-sm`
- Labels: `text-sm font-medium`
- Error messages: `text-xs text-destructive`
- Submit button: full-width, `default` variant, shows "Saving…" text during mutation

---

## 15. Asset Reference (all files in `PRFMR Theme/`)

### Logos

| File | Used in | Size |
|---|---|---|
| `logo-main.png` | Header nav (`layout.tsx`) | Displayed at `h-9` (36 px height) |
| `logo-onboarding.png` | Onboarding step headers | Displayed at `height: 34px` |

### Hero / background images

| File | Used in |
|---|---|
| `onboarding-splash-bg.jpeg` | Onboarding step 0 — full-screen splash background |
| `onboarding-wrestling-photo.jpg` | Onboarding fight camp intro step |
| `stock-images/fight_action_1.jpg` | `/start` page hero background |

### Additional stock images (in `stock-images/`)

Available for use as hero/background images on auth pages, marketing sections, or future screens. All are dark, high-contrast combat sports photography.

```
fight_action_1.jpg  fight_action_2.jpg  fight_action_3.jpg
fight_action_4.jpg  fight_action_5.jpg
boxer_bag_hero_1.jpg  boxer_bag_hero_2.jpg  boxer_bag_hero_3.jpg
fighter_real_1.jpg  fighter_real_2.jpg  fighter_real_3.jpg
fighter_real_4.jpg  fighter_real_5.jpg
```

### Sport badge icons (in `sport-icons/`)

PNG icons used in the `<SportBadge>` component. All are displayed at approximately `h-8 w-8` (32×32 px) inside a rounded container.

```
boxing.png        mma.png         muay-thai.png
kickboxing.png    bjj.png         wrestling.png
traditional.png
```

### Favicons (in `favicon/`)

```
favicon.svg              — SVG, used in HTML <link>
favicon.ico              — Multi-size ICO
favicon-96x96.png        — 96×96 PNG
apple-touch-icon.png     — 180×180 PNG for iOS
web-app-manifest-192x192.png
web-app-manifest-512x512.png
```

---

## 16. Key Spacing Conventions

| Pattern | Value |
|---|---|
| Page section gap | `space-y-8` (2 rem) |
| Card internal padding | `p-4` (1 rem) or `p-6` (1.5 rem) |
| Card header bottom padding | `pb-2` |
| Inline row gap | `gap-2` (0.5 rem) or `gap-3` (0.75 rem) |
| Grid gap (macro grid) | `gap-4` (1 rem) |
| Stat cell padding | `p-4` |
| Warning/callout padding | `px-4 py-3` or `px-3 py-2.5` |
| Bottom nav padding | `px-1 py-2` + `pb-safe` |
| Dialog padding | Default shadcn (`p-6`), some use `p-0` with inner scroll areas |

---

## 17. Dashboard Page — Full Element-by-Element Breakdown

This section supersedes the high-level bullets in §12.4 with exact, pixel-level detail for every dashboard element: exact classes, colours (resolved to hex where useful), font sizes/weights, spacing, and animation behaviour. Work through it top-to-bottom as the build order.

Component file: `client/src/components/WeightCutHero.tsx`. Rendered conditionally as item #4 in the dashboard stack (after the email-verification banner, before Morning Check-In).

### 18.1 Fight Camp Card (`WeightCutHero`)

The card has **three distinct render states**, driven by `useQuery(["/api/me/weight-cut"])`:

1. **Loading** — skeleton
2. **Empty** — no fight camp plan set (`plan === null`)
3. **Active** — plan exists (the full hero card)

---

#### 18.1.1 State 1 — Loading skeleton

```
<Card data-testid="card-weight-cut-hero">
  <CardContent className="p-4">
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-secondary rounded w-1/3" />
      <div className="h-8 bg-secondary rounded w-1/2" />
      <div className="h-4 bg-secondary rounded w-3/4" />
    </div>
  </CardContent>
</Card>
```
- Card shell: standard shadcn `Card` — `rounded-xl border bg-card border-card-border shadow-sm` (background `hsl(220 16% 11%)`, border falls back through `--card-border`, which is undefined in `:root` — in practice renders with no visible extra tint beyond the shadow, so visually the card reads as a borderless dark rectangle with a soft shadow).
- Padding is only `p-4` here (tighter than the active state's `p-5` — a minor inconsistency to preserve faithfully).
- Three grey bars (`bg-secondary` = `hsl(220 15% 13%)`), pulse animation via Tailwind's built-in `animate-pulse` (opacity 1→0.5→1, 2s cubic-bezier ease-in-out, infinite).
- Bar heights: `h-4` (16px), `h-8` (32px), `h-4` (16px) — widths `1/3`, `1/2`, `3/4` respectively, `space-y-3` (12px gap) between them, all `rounded` (0.1875rem / 3px per §4 token override — note: plain `rounded` is Tailwind's default `0.25rem`/4px, NOT overridden by the custom radius scale, since the custom scale only touches `sm/md/lg`).

---

#### 18.1.2 State 2 — Empty state ("no fight camp set")

```
<Card data-testid="card-weight-cut-hero-empty">
  <CardContent className="p-5 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold">Fight Camp</h3>
      </div>
    </div>
    <p className="text-sm text-muted-foreground">
      Set a fight date to start your camp plan — track your cut and stay on pace.
    </p>
    <Button size="sm" onClick={openCreate}>Set a fight date</Button>
  </CardContent>
</Card>
```

**Colours:**
- Card background: `hsl(220 16% 11%)` (`--card`) — a very dark blue-grey, near-black.
- Card border: effectively invisible (no `--card-border` token defined) — only the shadow (`shadow-sm`, Tailwind default `0 1px 2px rgba(0,0,0,0.05)`) reads against the page background `hsl(220 20% 7%)`.
- `Target` icon: `text-primary` = `hsl(24 100% 50%)` ≈ `#FF7A00` (vivid orange), size `16×16px` (`h-4 w-4`).
- Heading "Fight Camp": `text-foreground` (default, inherited) = `hsl(210 10% 95%)` (near-white).
- Body copy: `text-muted-foreground` = `hsl(215 10% 50%)` (mid-grey).
- Button: default shadcn variant — filled `bg-primary` orange, `text-primary-foreground` white text.

**Typography:**
- "Fight Camp" heading: `text-sm` (14px) + `font-display` (Space Grotesk) + `font-semibold` (600).
- Body sentence: `text-sm` (14px), Inter, regular weight (400), default line-height.
- Button label "Set a fight date": inherits shadcn Button's default `text-sm font-medium`, `size="sm"` gives `h-9 px-3` (36px tall).

**Layout:**
- Outer `CardContent`: `p-5` (20px all sides), `space-y-3` (12px vertical gap between the 3 children: header row, body text, button).
- Header row: `flex items-center justify-between` — icon+title on the left (`flex items-center gap-2`, 8px gap), nothing on the right (the `justify-between` is vestigial here since the active-state header reuses this same wrapper structure with badges/buttons on the right — kept for DOM parity between states).
- No animation on mount for this state (renders directly, no Framer Motion wrapper) — note this differs from most other dashboard cards, which typically fade/slide in.

---

#### 18.1.3 State 3 — Active state (fight camp plan set) — the full hero card

```
<Card data-testid="card-weight-cut-hero" className="border-border/50">
  <CardContent className="p-5 space-y-4">
    ...
  </CardContent>
</Card>
```

Note: the active state adds an explicit `border-border/50` override (border colour `hsl(220 10% 15% / 0.5)`), unlike the empty/loading states which rely on the (empty) default. This makes the active card have a faint but real visible edge.

Outer padding: `p-5` (20px), `space-y-4` (16px vertical gap between each of the ~8 sub-sections listed below). No entry animation on the Card itself (it's a plain conditional render, not wrapped in `motion.div`) — but several elements *inside* it animate on state change (see 18.1.3g "justLogged" pulse).

##### (a) Header row

```
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Target className="h-4 w-4 text-primary" />
    <h3 className="text-sm font-display font-semibold">Fight Camp</h3>
  </div>
  <div className="flex items-center gap-1.5">
    <Badge className={`text-xs font-semibold ${statusColor}`}>{plan.statusLabel}</Badge>
    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
    <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
  </div>
</div>
```

- Same left-hand "Target icon + Fight Camp" title as the empty state (orange `h-4 w-4` icon, `text-sm font-display font-semibold` label) — kept visually identical across states for continuity.
- **Status badge** (`badge-cut-status`): text `text-xs` (12px) `font-semibold` (600), colour driven by `plan.status` via the `statusColors` map:

| `status` value | Text colour | Border | Background | Meaning |
|---|---|---|---|---|
| `on_track` | `text-green-400` | `border-green-400/30` | `bg-green-400/10` | Pace is sustainable |
| `aggressive` | `text-yellow-400` | `border-yellow-400/30` | `bg-yellow-400/10` | Faster than ideal |
| `very_aggressive` | `text-orange-400` | `border-orange-400/30` | `bg-orange-400/10` | Risky pace |
| `unrealistic` | `text-red-400` | `border-red-400/30` | `bg-red-400/10` | Not achievable safely |
| `complete` | `text-green-400` | `border-green-400/30` | `bg-green-400/10` | Fight weight reached |
| `past_date` | `text-muted-foreground` | `border-border` | `bg-secondary/20` | Fight date has passed |

  (Tailwind `green-400` = `#4ADE80`, `yellow-400` = `#FACC15`, `orange-400` = `#FB923C`, `red-400` = `#F87171` — standard Tailwind palette, distinct from the app's custom `--primary` orange.)
- **Edit button** (pencil, `button-edit-cut-plan`): `variant="ghost" size="icon"`, `h-7 w-7` (28×28px, smaller than shadcn's default `size="icon"` which is 40×40 — explicitly overridden). Icon `h-3.5 w-3.5` (14px), colour `text-muted-foreground`, opens the edit dialog pre-filled with current values.
- **Delete button** (trash, `button-delete-cut-plan`): identical sizing/colour to edit button; calls `deleteMutation` directly with no confirmation dialog (destructive action with no "are you sure" step — worth flagging as a deliberate low-friction design choice, not an oversight, since the plan can be trivially recreated).
- Row gap between badge and buttons: `gap-1.5` (6px).

##### (b) Fight countdown — the hero element

```
<div className="flex items-center gap-2 py-1" data-testid="text-fight-countdown">
  <CalendarDays className="h-5 w-5 text-primary shrink-0" />
  <span className="text-3xl font-extrabold tracking-tight">{daysText}</span>
  <span className="text-sm font-medium text-muted-foreground">to fight night</span>
</div>
```

This is the single largest, most visually dominant element in the card — the reason it's called the "hero" card.

- `CalendarDays` icon: `h-5 w-5` (20px, larger than the header's 16px icon), `text-primary` orange, `shrink-0` prevents squashing on narrow viewports.
- Days count (e.g. "12 days"): `text-3xl` (30px) `font-extrabold` (800) `tracking-tight` (-0.025em letter-spacing). Uses the **default body font** (Inter/`font-sans`), NOT `font-display` — a deliberate distinction from headings, since this is a data value, not a heading. No `font-mono` here either (unlike other numeric stats in the app) — the countdown text reads as one flowing phrase ("12 days") rather than an isolated tabular number.
- "to fight night" suffix: `text-sm` (14px) `font-medium` (500) `text-muted-foreground` (grey) — deliberately understated relative to the huge orange-adjacent number beside it.
- Row: `flex items-center gap-2` (8px gaps), `py-1` (4px vertical breathing room), no background/border — sits directly on the card surface.
- Singular/plural handled in JS: `daysUntil === 1 ? "1 day" : "${daysUntil} days"`.

##### (c) Weight-log CTA (conditional — two sub-states)

**Not yet logged today AND input not open** (`button-prompt-weight-hero`):
```
<button className="flex items-center gap-3 w-full p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left">
  <Scale className="h-4 w-4 text-primary shrink-0" />
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold text-foreground">Log today's weight</p>
    <p className="text-xs text-muted-foreground">Updates your cut trend</p>
  </div>
  <span className="text-xs text-primary font-medium">Tap →</span>
</button>
```
- Full-width tappable row, `rounded-lg` (9px per custom radius token), `p-3` (12px padding).
- Border: `border-primary/30` = orange at 30% opacity — a soft orange outline.
- Background: `bg-primary/5` = orange at 5% opacity (barely-there warm tint distinguishing it from the plain card surface), `hover:bg-primary/10` on pointer devices (10% opacity, subtle brighten), `transition-colors` (default 150ms).
- Icon: `Scale`, `h-4 w-4`, orange.
- Title "Log today's weight": `text-sm font-semibold text-foreground` (white).
- Subtitle "Updates your cut trend": `text-xs text-muted-foreground` (grey, 12px).
- Trailing "Tap →": `text-xs text-primary font-medium` — orange call-to-action affordance text.

**Input open** (`hero-weight-input-form`) — replaces the button above when tapped:
```
<div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
  <div className="flex items-center gap-2">
    <Scale className="h-4 w-4 text-primary" />
    <Label className="text-sm font-medium">Morning weight (kg)</Label>
  </div>
  <Input type="number" step="0.1" min="20" max="300" placeholder="e.g., 72.4" autoFocus />
  <div className="flex gap-2">
    <Button size="sm" onClick={handleWeightSubmit} disabled={...}>{pending ? "Saving…" : "Save"}</Button>
    <Button size="sm" variant="ghost" onClick={...}>Cancel</Button>
  </div>
</div>
```
- Same outer container styling (orange-tinted border/bg) as the closed-state button, so the transition feels like the button "expands in place".
- Input auto-focuses (keyboard pops immediately on mobile), Enter key submits.
- Save button: default filled orange `size="sm"`, disabled while `weightMutation.isPending` or input empty; label swaps to "Saving…" mid-flight.
- Cancel: `variant="ghost" size="sm"`, collapses back to the closed CTA button.
- Once submitted successfully, this entire section disappears (both sub-states are gated on `!weightLoggedToday`) and is replaced by nothing — the row is simply omitted for the rest of the day.

##### (d) Progress row — 3-column stat grid

```
<div className="grid grid-cols-3 gap-3 text-center" data-testid="section-cut-progress">
  <div> {/* Current */}
    <p className="text-2xl font-extrabold font-mono tracking-tight transition-all duration-300 {justLogged && 'text-green-400 scale-105'}">{plan.currentWeight}</p>
    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Current kg</p>
  </div>
  <div> {/* Middle: rate summary */}
    <TrendingDown className="h-4 w-4 text-primary mb-1" />
    <p className="text-sm font-bold">{plan.totalToLose} kg to go</p>
    <p className="text-[10px] text-muted-foreground">{plan.weeklyRate} kg/wk fat loss</p>
  </div>
  <div> {/* Target */}
    <p className="text-2xl font-extrabold font-mono tracking-tight">{plan.targetWeight}</p>
    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Fight weight</p>
  </div>
</div>
```
- `grid grid-cols-3 gap-3` (12px gutters), all cells `text-center`.
- **Current weight** and **Fight weight** numbers: `text-2xl` (24px) `font-extrabold` (800) `font-mono` (JetBrains Mono — tabular figures, unlike the countdown above) `tracking-tight`.
- **Current weight only** gets a live celebration micro-animation: when `justLogged` is true (fires for 2.5s right after a successful weight submission), the number turns `text-green-400` and scales up 5% (`scale-105`), animated via `transition-all duration-300` (300ms ease). This is the *only* colour+scale combo animation in the card driven by a plain CSS transition rather than Framer Motion.
- Labels under Current/Target: `text-[10px]` (10px) `text-muted-foreground font-medium uppercase tracking-wide` — tiny uppercase caption style used throughout the app for stat labels.
- **Middle cell** (rate summary) is visually distinct — not a number+label pair but an icon+two-lines: `TrendingDown` icon (`h-4 w-4 text-primary`, `mb-1` = 4px below), then `"{totalToLose} kg to go"` at `text-sm font-bold` (14px, 700 — bold but not huge, deliberately smaller than the flanking numbers so it reads as connective tissue between them), then `"{weeklyRate} kg/wk fat loss"` at `text-[10px] text-muted-foreground`.

##### (e) Fat-loss breakdown trigger row

```
<button onClick={() => setBreakdownDialogOpen(true)} className="w-full border-t border-border/30 pt-3 flex items-center justify-between group">
  <div className="flex items-center gap-2">
    <Badge variant="outline" className={`text-[10px] font-semibold ${pace.color}`}>{pace.label}</Badge>
    {pace.note && <span className="text-[10px] text-orange-400/70">{pace.note}</span>}
  </div>
  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
</button>
```
- `border-t border-border/30` (top divider, border colour at 30% opacity, `hsl(220 10% 15% / 0.3)`) + `pt-3` (12px) separates this from the progress grid above — this top-divider + top-padding pattern repeats for every subsequent section in the card (a consistent "section separator" idiom worth extracting as a shared class in a rebuild, e.g. `.section-divider { border-top: 1px solid hsl(var(--border)/0.3); padding-top: 0.75rem }`).
- Pace badge (`badge-pace`), from `getPaceInfo(weeklyRatePct)`:

| `weeklyRatePct` | Label | Colour classes | Note |
|---|---|---|---|
| `< 0.5` | "Easy pace" | `text-muted-foreground border-border/40 bg-secondary/20` | none |
| `0.5–0.75` | "Moderate pace" | `text-primary border-primary/30 bg-primary/10` (orange) | none |
| `> 0.75` | "Aggressive pace" | `text-orange-400 border-orange-400/30 bg-orange-400/10` (Tailwind orange-400, distinct from brand primary) | "Quite fast — consider extending timeline" shown alongside in `text-[10px] text-orange-400/70` |

- Entire row is a `<button>` (full click target), `group` class enables the chevron colour hover-through (`group-hover:text-muted-foreground` brightens the otherwise 50%-opacity chevron on hover/press).

##### (f) "This week's target" row (conditional on `weeklyTargets.length > 0`)

```
<div className="border-t border-border/30 pt-3">
  <p className="text-xs text-muted-foreground">
    <span className="font-semibold text-foreground/80 uppercase tracking-wide text-[10px]">This week's target</span>
    <span className="ml-2 text-sm font-bold transition-colors duration-300 {justLogged ? 'text-green-400' : 'text-foreground'}">{weeklyTargets[0].targetWeight} kg</span>
    {suggestedDeficitKcal > 0 && <span className="text-muted-foreground"> · ~{suggestedDeficitKcal} kcal deficit/day</span>}
  </p>
</div>
```
- Same top-divider idiom as (e).
- All on one flowing paragraph line (not separate blocks): a tiny uppercase label (`text-[10px] uppercase tracking-wide font-semibold text-foreground/80`), then the target weight value inline at `text-sm font-bold` (turns green like the current-weight stat when `justLogged`), then an optional trailing deficit note in plain `text-muted-foreground`.

##### (g) Trend + consistency block

```
<div className="space-y-2 border-t border-border/30 pt-3">
  <div className={`flex items-center gap-2 font-semibold transition-colors duration-300 ${
    justLogged ? "text-green-400 text-sm" : trend.isUp ? "text-amber-400 text-base" : "text-foreground/70 text-xs"
  }`}>
    {trend.isUp ? <TrendingUp className="h-5 w-5 shrink-0 text-amber-400" /> : <Flame className="h-3.5 w-3.5 shrink-0 text-primary/60" />}
    <span>{trend.message}</span>
  </div>
  <div className="flex items-center justify-between">
    <p className={`text-xs transition-colors duration-300 ${justLogged ? "text-green-400/80 font-semibold" : "text-muted-foreground"}`}>
      Weight logged: <span className={`font-semibold ${justLogged ? "text-green-400" : "text-foreground"}`}>{consistencyCount} of last 7 days</span>
    </p>
    {consistencyBadge && <Badge variant="outline" className={`text-[10px] font-semibold ${consistencyBadge.color}`}>{consistencyBadge.label}</Badge>}
  </div>
</div>
```

This is the most state-driven part of the card — **3 possible visual treatments** for the trend line alone:

| Condition | Text colour/size | Icon |
|---|---|---|
| `justLogged` (just submitted a weight, within 2.5s window) | `text-green-400 text-sm` (14px) | `Flame`, `h-3.5 w-3.5`, `text-primary/60` |
| `trend.isUp` (recent weight rose vs. prior reading) | `text-amber-400 text-base` (16px — the largest of the three) | `TrendingUp`, `h-5 w-5` (20px, largest icon), `text-amber-400` |
| default (steady/downward trend) | `text-foreground/70 text-xs` (12px, dimmed white) | `Flame`, `h-3.5 w-3.5`, `text-primary/60` |

Trend message copy logic (`getTrendMessage`, from 7-day weight history):
- `< 2` readings → "Trend forming — keep logging daily"
- `status === "complete"` → "At fight weight — well done"
- `status === "past_date"` → "Fight date passed"
- `change < -0.2kg` → "On trend — moving in the right direction" (`isUp: false`)
- `-0.2 to 0.3kg` → "Fluctuations are normal — trends take time" (`isUp: false`)
- `> 0.3kg` → "Weight naturally fluctuates — stay consistent" (`isUp: true`, triggers the amber/TrendingUp treatment)

All colour transitions animate via `transition-colors duration-300` (300ms) — no layout shift, just colour crossfade.

**Consistency line**: "Weight logged: N of last 7 days" — `text-xs` normally, brightens to `text-green-400/80 font-semibold` during the `justLogged` window; the "N of last 7 days" number itself is always `font-semibold`, switching between `text-foreground` and `text-green-400`.

**Consistency badge** (`badge-consistency`, from `getConsistencyLabel(count)`), shown only if count ≥ 2:

| Count (of 7 days) | Label | Colour |
|---|---|---|
| ≥ 6 | "Great momentum" | `text-green-400 border-green-400/30 bg-green-400/10` |
| 4–5 | "Building rhythm" | `text-yellow-400 border-yellow-400/30 bg-yellow-400/10` |
| 2–3 | "Getting started" | `text-muted-foreground border-border/40 bg-secondary/20` |
| 0–1 | *(no badge shown)* | — |

##### (h) Demo share button

```
<button className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-primary/70 transition-colors py-1">
  <Share2 className="h-3 w-3" />
  Try sharing a moment
</button>
```
- Deliberately the most understated interactive element in the card: `text-[11px]` (11px), `text-muted-foreground/50` (grey at 50% opacity — very faint), centred, full-width, only `py-1` (4px) padding, no border/background at all.
- Hover brightens to `text-primary/70` (orange at 70% opacity) — a whisper of brand colour on interaction.
- Exists purely as a discoverability affordance for the share-sheet feature outside of its normal trigger points (celebration modals).

##### (i) Disclaimer footer line

```
<p className="text-[10px] text-muted-foreground/50 italic leading-relaxed">
  This planner focuses on gradual fat loss. Some athletes temporarily reduce body weight before weigh-ins. Weight naturally fluctuates day to day — focus on trends.
</p>
```
- Smallest, faintest text in the card: `text-[10px]` (10px), `text-muted-foreground/50` (grey at 50% opacity), `italic`, `leading-relaxed` (1.625 line-height) for legibility despite the small size. No divider above it — sits directly under the share button.

---

#### 18.1.4 Celebration/notice modal (`fcModal`) — triggered from within the hero card

Not part of the card's static layout, but tightly coupled to it — fires on weight submission, consistency milestones, and plan creation. Rendered via `createPortal(..., document.body)` so it always overlays the full viewport regardless of scroll position.

```
<motion.div /* backdrop */
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
  className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65"
>
  <motion.div /* card */
    initial={{ opacity: 0, scale: 0.9, y: 16 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: 8 }}
    transition={{ duration: 0.26, delay: 0.06 }}
    className={`mx-6 max-w-sm w-full bg-card rounded-2xl p-7 shadow-2xl border ${isUp ? "border-amber-400/25" : "border-primary/20"}`}
  >
    ...
  </motion.div>
</motion.div>
```

- Backdrop: `bg-black/65` (65% black scrim) covering the full viewport (`fixed inset-0`), `z-[9999]` (above everything, including the bottom nav), fades in/out over 300ms. Tapping the backdrop dismisses.
- Card: `max-w-sm` (384px) capped width with `mx-6` (24px) side margins on narrow screens, `rounded-2xl` (16px radius — the largest radius token in the app, reserved for modals like this), `p-7` (28px, generous padding for a "moment" feel), `shadow-2xl` (Tailwind's largest built-in shadow).
- Entry animation: scales up from 90%→100% and slides up 16px→0, with a 60ms delay after the backdrop starts fading in (so the backdrop is very slightly visible before the card pops), total duration 260ms.
- Exit: scales down to 95% and drops 8px, opacity to 0.
- Border colour is conditional: `border-amber-400/25` when the notice is a "weight went up" warning (`isUp: true`), otherwise `border-primary/20` (orange) for positive/neutral notices.
- Icon: `TrendingUp` (amber, `h-6 w-6`) for up-trend warnings, `Flame` (orange/primary, `h-6 w-6`) otherwise — both `shrink-0 mt-0.5`.
- Title: `text-lg font-bold` (18px, 700) — `text-amber-400` if `isUp`, else default `text-foreground`.
- Body: `text-sm text-muted-foreground mt-2 leading-relaxed`.
- **Share button** inside the modal: `mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all text-primary text-sm font-semibold` — a pill-ish full-width button with an orange 10%-opacity tint background, scales down 5% on press (`active:scale-95`) for tactile feedback, opens the `ShareMomentSheet`.
- Footer hint: `text-xs text-muted-foreground/40 mt-3 text-center` — "Tap backdrop to dismiss".
- **Auto-dismiss**: closes automatically after 4500ms if not interacted with.
- **Queueing**: if a second notice fires while one is showing, it queues (`fcModalQueue`) and appears 350ms after the current one finishes exiting — notices never overlap or interrupt each other.
- Triggers that fire this modal: consistency milestones (3/5/6 of 7 days logged — each also fires `fireCelebration()` confetti with a themed emoji 🔥/🥊/💪), a weight submission that increased vs. the prior reading ("Weight naturally fluctuates") vs. decreased ("On trend ↓"), and successful fight-camp plan creation ("Fight camp set 🎯", which additionally renders a `chartType: "fight_camp_new"` projected-cut mini-chart in the subsequent share sheet).

---

#### 18.1.5 Fat-loss breakdown dialog (triggered by row (e))

Standard shadcn `Dialog`, `max-w-sm mx-4` (per §8 table). Content is a flat list of label/value rows, `space-y-3 pt-1`, each row `flex items-center justify-between text-sm`:

| Row | Value colour | Shown when |
|---|---|---|
| Fat loss target | `text-foreground font-semibold` | always |
| Temporary reduction assumed (`~Xkg`) | `text-muted-foreground font-semibold` | `tempCutDisplayed > 0` |
| Estimated temp. reduction (fight week) | `text-muted-foreground font-semibold` | else if `tempCut > 0` |
| Target by D−4 (`≤ Xkg`) | `text-yellow-400/80`, value `font-semibold` | `dayMinus4Target` set AND `daysUntil ≤ 10` |
| Fat-loss pace | pace badge (same colour system as 18.1.3e) + optional note | always, `border-t border-border/30 pt-1` above this row |
| Daily deficit target (`~Xkcal`) | `text-foreground font-semibold` | `suggestedDeficitKcal > 0` |

---

#### 18.1.6 Create/Edit plan dialog

Standard shadcn `Dialog` (`sm:max-w-[425px]` default, per §8). Title switches "Set Up Fight Camp Plan" (create) / "Edit Fight Camp Plan" (edit), both `font-display`.

Fields, in order: Current Weight (kg, number input), Fight Weight (kg), Fight Date (date input), Weigh-In Timing (2-column button group — "Same day" / "Day before", active state `border-primary bg-primary/10 text-foreground`, inactive `border-border/40 hover:bg-secondary/30 text-muted-foreground`), a collapsible "Advanced options" toggle (▲/▼ text arrow + label, `text-xs text-muted-foreground hover:text-foreground`) revealing a manual temp-reduction-kg override input, then a full-width primary submit button ("Start Camp Plan" / "Update Plan"), and a centred `text-[10px] text-muted-foreground` disclaimer: "Educational tool only — not medical or nutritional advice."

---

#### 18.1.7 Weight Cut Warning System — Deep Dive

This section is the complete authoritative reference for the **fight camp status badge** ("Quite aggressive — consider extending timeline" etc.) and the **pace badge** ("Aggressive pace"). Both are warnings derived from the same underlying plan data but are different systems. Everything you need to replicate them on mobile is here.

---

##### A. What is stored (and what is not)

**Database table: `weight_cut_plans`** (`shared/schema.ts`)

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | integer FK → users | |
| `current_weight` | real (kg) | Set at plan-creation time — overridden at read time by today's actual weigh-in |
| `target_weight` | real (kg) | The fight-weight goal |
| `fight_date` | text (`YYYY-MM-DD`) | |
| `weigh_in_timing` | text | `"same_day"` or `"day_before"` — affects the temp-cut buffer calculation |
| `manual_temp_reduction_kg` | real, nullable | Advanced override for the water-weight estimate; `null` = use automatic formula |
| `created_at` / `updated_at` | timestamps | |

**Critical: no warning text is ever stored.** `status`, `statusLabel`, and every derived number (`requiredWeeklyRatePct`, `weeklyRate`, `suggestedDeficitKcal`, etc.) are **always recomputed on every API read** from the five raw inputs: `currentWeight` (resolved live), `targetWeight`, `fightDate`, `weighInTiming`, `manualTempReductionKg`. Caching a warning badge string in the DB would cause it to go stale — the current architecture avoids that entirely.

---

##### B. Where the calculation lives

The core calculation function is `calculateWeightCutPlan()`, defined in **`shared/weight-cut.ts`** (TypeScript, no dependencies). It is re-exported through `server/lib/weight-cut.ts` (a one-line passthrough file), which is where the server imports it from.

The function is in `shared/` — meaning it is theoretically isomorphic (can run in a browser or on a server). **In the current app it is only ever called server-side**, from route handlers in `server/routes.ts`. The client receives the fully-computed result over the API and never runs `calculateWeightCutPlan()` itself. Mobile replication can either call the same API or port the function directly (it is pure TypeScript with no imports).

---

##### C. The status-badge warning — exactly how it works

**Entry point:** `GET /api/me/weight-cut` (see §D below)

**Step-by-step computation:**

1. **Resolve today's actual bodyweight.** The server calls `resolveBodyweight(userId, today, user.currentWeight)` — this looks for a weight-log entry for today; if found it uses that reading; if not it falls back to `user.currentWeight` (profile value). The resolved `currentWeight` and its `source` (`"log"` vs `"profile"`) are both returned in the response.

2. **Choose the flow** based on `weighInTiming`:
   - `"day_before"` → `dayBeforeFlow()` — assumes a **6% bodyweight** temporary water cut in fight week (the athlete rehydrates overnight between weigh-in and fight). `weeksForFatLoss = (daysUntil − 7) / 7` (reserves the final week entirely for the temp cut).
   - `"same_day"` → `sameDayFlow()` — assumes only a **1% bodyweight** same-day water reduction. `weeksForFatLoss = (daysUntil − 4) / 7` (reserves the final 4 days).
   - Both flows cap `weeksForFatLoss` at a minimum of `0.5` (half a week) to avoid division-by-zero with very close fight dates.

3. **Compute fat loss required.** For `day_before`:
   ```
   predictedWeekMinus1Weight = targetWeight / (1 − 0.06)   [auto]
                             OR targetWeight + cappedManualKg [manual]
   fatLossRequired = currentWeight − predictedWeekMinus1Weight
   ```
   For `same_day`:
   ```
   predictedDayMinus4Weight = targetWeight / (1 − 0.01)    [auto]
                            OR targetWeight + cappedManualKg [manual]
   fatLossRequired = currentWeight − predictedDayMinus4Weight
   ```
   Manual temp overrides are capped at 10% BW (`day_before`) or 2% BW (`same_day`) for safety.

4. **Compute the required weekly rate:**
   ```
   requiredWeeklyRate    = fatLossRequired / weeksForFatLoss          (kg/wk)
   requiredWeeklyRatePct = (requiredWeeklyRate / currentWeight) × 100 (% BW/wk)
   ```

5. **`deriveStatus(requiredWeeklyRatePct)`** — the sole source of the warning badge:

   | `requiredWeeklyRatePct` | `status` | `statusLabel` (exact string) |
   |---|---|---|
   | ≤ 0.5% | `"on_track"` | `"Steady pace"` |
   | > 0.5% and ≤ 1.0% | `"on_track"` | `"On track"` |
   | > 1.0% and ≤ 1.5% | `"aggressive"` | `"Quite aggressive — consider extending timeline"` |
   | > 1.5% and ≤ 2.0% | `"very_aggressive"` | `"Very aggressive — adjust target or date"` |
   | > 2.0% | `"unrealistic"` | `"Timeline too tight — adjust target or date"` |

   Plus two special-case early-exit statuses (set before `deriveStatus` is ever reached):

   | Condition | `status` | `statusLabel` |
   |---|---|---|
   | `daysUntil ≤ 0` | `"past_date"` | `"Fight date has passed"` |
   | `totalToLose ≤ 0` | `"complete"` | `"Already at or below target"` |

6. **Compute the recommended rate and deficit:**
   ```
   maxWeeklyRate          = currentWeight × 0.01  (hard cap at 1% BW/wk)
   recommendedWeeklyRate  = min(requiredWeeklyRate, maxWeeklyRate)
   suggestedDeficitKcal   = round(recommendedWeeklyRate × 7700 / 7)  (kcal/day)
   ```
   The `recommendedWeeklyRate` is what drives the `weeklyRate` and `weeklyRatePct` fields in the response — the *capped* rate, not the required one. This is what the pace badge (System B) uses.

---

##### D. API endpoints

All four endpoints require an authenticated session (`credentials: "include"` / cookie-based auth).

| Method | Path | Purpose | Runs `calculateWeightCutPlan`? |
|---|---|---|---|
| `GET` | `/api/me/weight-cut` | Fetch plan + computed result for today | Yes — uses today's actual logged bodyweight |
| `POST` | `/api/me/weight-cut` | Create new plan (deletes any existing plan first, so there is always at most one plan per user) | Yes — uses POSTed `currentWeight` |
| `PUT` | `/api/me/weight-cut` | Partial update (any subset of fields) | Yes |
| `DELETE` | `/api/me/weight-cut` | Delete plan | No — returns 204 |

**`GET /api/me/weight-cut` response shape** (the data `WeightCutHero` binds to via `useQuery(["/api/me/weight-cut"])`):

```ts
{
  // From calculateWeightCutPlan():
  currentWeight: number          // resolved live (log or profile fallback)
  targetWeight: number
  fightDate: string              // YYYY-MM-DD
  daysUntil: number
  weeksUntil: number             // rounded to 1 d.p.
  totalToLose: number            // kg, 0 if already at target
  fatLossRequired: number        // kg of body fat to lose before temp-cut window
  tempCut: number                // estimated temp water cut, kg
  tempCutDisplayed: number       // non-zero only within the final window (≤5 days same_day, ≤10 days day_before)
  requiredWeeklyRate: number     // kg/wk needed to hit target
  requiredWeeklyRatePct: number  // % BW/wk — drives the status badge
  recommendedWeeklyRate: number  // min(required, 1% BW/wk cap)
  recommendedWeeklyRatePct: number
  weeklyRate: number             // alias for recommendedWeeklyRate
  weeklyRatePct: number          // alias for recommendedWeeklyRatePct — drives the pace badge
  dayMinus4Target: number | null // same_day only: target weight at D−4
  predictedWeekMinus1Weight: number | null  // day_before only
  predictedDayMinus4Weight: number | null   // same_day only
  status: CutStatus              // "on_track" | "aggressive" | "very_aggressive" | "unrealistic" | "complete" | "past_date"
  statusLabel: string            // the warning text (see table in §C)
  weeklyTargets: Array<{ week: number; targetWeight: number }>
  suggestedDeficitKcal: number   // kcal/day
  manualTempReductionKg: number | null

  // Added by the route handler (not from calculateWeightCutPlan):
  planId: number
  bodyweightSource: "log" | "profile"  // how currentWeight was resolved
  weighInTiming: "same_day" | "day_before"
}
```

Returns `null` (not an error) when no plan exists — the component checks `if (!plan)` to render the empty state.

**`POST /api/me/weight-cut` request body** (validated with Zod):
```ts
{
  currentWeight: number          // 30–300 kg
  targetWeight: number           // 30–300 kg
  fightDate: string              // /^\d{4}-\d{2}-\d{2}$/
  weighInTiming: "same_day" | "day_before"  // default "same_day"
  manualTempReductionKg?: number | null     // 0–30 kg
}
```
Response: 201, same shape as GET.

---

##### E. Two parallel warning systems (important distinction)

There are **two independent warning labels** on the WeightCutHero card. They use different inputs and are designed for different purposes:

**System A — Status Badge** (header, top-right of card, `data-testid="badge-cut-status"`)
- Input: `requiredWeeklyRatePct` (the *needed* rate to actually make weight)
- Source: `deriveStatus()` in `shared/weight-cut.ts`, run server-side
- Range: 5 possible values (`on_track` with 2 sub-labels, `aggressive`, `very_aggressive`, `unrealistic`, plus `complete` and `past_date`)
- Purpose: tells the athlete whether the *plan as set* is physiologically safe
- Colours: green → yellow → orange → red (see §18.1.3(a) colour table)

**System B — Pace Badge** (in the fat-loss breakdown trigger row, `data-testid="badge-pace"`)
- Input: `weeklyRatePct` (the *capped recommended* rate, max 1% BW/wk)
- Source: `getPaceInfo()` in `WeightCutHero.tsx`, run **client-side only**
- Range: 3 levels only (Easy / Moderate / Aggressive)
- Purpose: tells the athlete how hard the *actual recommended cadence* is to execute day-to-day
- The inline note "Quite fast — consider extending timeline" appears **only** at the `> 0.75%` threshold for System B — this is a **different** message from System A's "Quite aggressive — consider extending timeline" (which triggers at `> 1.0%` required rate)

The two systems can read differently at the same time. Example: a plan with `requiredWeeklyRatePct = 1.3%` gets System A badge "Quite aggressive" (yellow), but if `weeklyRatePct` (the capped recommended) is only `0.8%`, System B shows "Aggressive pace" (orange) with the "Quite fast…" note. The athlete sees both warnings simultaneously.

**System B logic (client-side, `getPaceInfo(weeklyRatePct)`):**
```ts
if (weeklyRatePct < 0.5)  → { label: "Easy pace",     color: "text-muted-foreground border-border/40 bg-secondary/20",       note: null }
if (weeklyRatePct ≤ 0.75) → { label: "Moderate pace",  color: "text-primary border-primary/30 bg-primary/10",                 note: null }
else                       → { label: "Aggressive pace", color: "text-orange-400 border-orange-400/30 bg-orange-400/10",       note: "Quite fast — consider extending timeline" }
```
Note: System B uses Tailwind `orange-400` (`#FB923C`) — a distinctly different orange from the app's brand primary (`hsl(24 100% 50%)` ≈ `#FF7A00`). Preserve this difference.

---

##### F. What triggers the status to change

The status badge re-evaluates automatically whenever:
- The user logs a new morning weight (invalidates `/api/me/weight-cut` — `currentWeight` changes)
- The user edits the plan (`PUT /api/me/weight-cut`)
- The fight date gets closer (server computes `daysUntil` fresh on every GET, using `new Date()` — no stored date arithmetic)

There is no scheduled job or push-recalculation. Status is always computed on-demand at request time.

---

##### G. Mobile replication — what to implement and how

Below is a priority-ordered checklist for a mobile build (React Native / Expo or similar).

**1. API layer (required, no changes needed server-side)**
- Call `GET /api/me/weight-cut` with session cookie / auth header. Parse the JSON directly — `status`, `statusLabel`, all numeric fields are ready to use.
- For plan creation/editing: `POST /api/me/weight-cut` with the 5 fields above.
- For deletion: `DELETE /api/me/weight-cut`.

**2. Status Badge (System A) — pure display**
Map `plan.status` → colour. The `statusLabel` string is already the human-readable warning text from the server — just render it. No client-side calculation needed.

```
status → badge colour
"on_track"        → green  (#4ADE80 / Tailwind green-400)
"aggressive"      → yellow (#FACC15 / Tailwind yellow-400)
"very_aggressive" → orange (#FB923C / Tailwind orange-400)
"unrealistic"     → red    (#F87171 / Tailwind red-400)
"complete"        → green
"past_date"       → grey (muted)
```

**3. Pace Badge (System B) — tiny client function**
Port `getPaceInfo(plan.weeklyRatePct)` — it is 8 lines with three if-branches, no imports. The `weeklyRatePct` comes from the API response. Show the badge label and, if non-null, the `note` string inline beside it (in the current web app this is `text-[10px] text-orange-400/70` — on mobile use the equivalent small muted-orange style).

**4. Core numbers to display**
All available directly from the GET response, no client maths required:

| Display element | API field |
|---|---|
| Days to fight | `plan.daysUntil` |
| Current weight | `plan.currentWeight` |
| Fight weight | `plan.targetWeight` |
| Total to lose | `plan.totalToLose` kg |
| Weekly fat-loss rate | `plan.weeklyRate` kg/wk |
| Suggested daily deficit | `plan.suggestedDeficitKcal` kcal |
| This week's target weight | `plan.weeklyTargets[0].targetWeight` (if array non-empty) |
| Temp cut size (fight week) | `plan.tempCutDisplayed` if > 0, else `plan.tempCut` |
| D−4 target (same_day timing) | `plan.dayMinus4Target` (non-null when `daysUntil ≤ 10`) |

**5. Trend message (client function)**
Port `getTrendMessage(recentWeights, plan.status)` — takes the last 7 days of weight logs (from `GET /api/me/weights/range?start=YYYY-MM-DD&end=YYYY-MM-DD`) and returns `{ message: string; isUp: boolean }`. Pure function, no imports. The `isUp` flag drives amber vs. default colour treatment of the trend message.

**6. Consistency badge (client function)**
Port `getConsistencyLabel(count)` — count = number of distinct dates with a weight log in the last 7 days. Returns `null` below 2 readings (suppress badge), or a `{ label, color }` pair for 2–3 / 4–5 / 6–7 readings.

**7. Weight logging**
`POST /api/weights` with `{ date: "YYYY-MM-DD", weight: number }`. On success, invalidate/refetch `GET /api/me/weight-cut` — this refreshes `currentWeight` (and thus recalculates status) if the new log is the most recent for today.

**8. The `bodyweightSource` field**
The GET response includes `bodyweightSource: "log" | "profile"`. This can optionally be shown as a small annotation ("current weight from today's log" vs "using profile weight — log your weight to update"). The web app does not currently surface this label in the UI but returns it from the API for potential future use.

**9. If you want to run the calculation offline / without the API**
The entire `calculateWeightCutPlan()` function (`shared/weight-cut.ts`, 218 lines, zero imports) can be copied verbatim and run client-side. Input: `(currentWeight, targetWeight, fightDateStr, weighInTiming, todayStr?, manualTempReductionKg?)`. It returns the full `WeightCutPlanResult` including `status` and `statusLabel`. This is useful for a plan-preview screen before the user saves — run it locally to show real-time feedback as inputs change, then POST to save.

---

### 17.2 Morning Check-In card (`MorningCheckIn`)

Component file: `client/src/components/MorningCheckIn.tsx`. Sits directly below the Fight Camp card. **Renders `null` entirely once all 3 sub-tasks (sleep, weight, training) are complete for the day** — this card only exists to nag about missing data, and vanishes the moment it's no longer needed (no "all done" success state is ever shown to the user).

```
<Card className="border-primary/20 bg-primary/5" data-testid="card-morning-checkin">
  <CardContent className="p-4 space-y-3">
    ...
  </CardContent>
</Card>
```

**Card-level colour treatment** — this is the one card on the dashboard that tints its *entire surface* orange rather than just accenting a border on a neutral card:
- `border-primary/20` — orange border at 20% opacity (`hsl(24 100% 50% / 0.2)`), replacing the Card component's default (empty/invisible) `border-card-border`.
- `bg-primary/5` — orange wash at 5% opacity over the whole card body, layered on top of (not replacing) the base `bg-card` from the shadcn Card class — the two composite to a very faint warm-tinted dark surface, visually distinguishing this as an "action needed" card versus the neutral `bg-card` used everywhere else.
- Padding: `p-4` (16px, tighter than Fight Camp's `p-5`) with `space-y-3` (12px) between each row/section.

##### (a) Header row

```
<div className="flex items-center justify-between">
  <h3 className="text-sm font-display font-semibold">Morning Check-In</h3>
  <Badge variant="outline" className="text-xs">{completedCount}/3</Badge>
</div>
```
- Title: `text-sm font-display font-semibold` (14px, Space Grotesk, 600) — identical typographic treatment to the Fight Camp card's title, for visual consistency between dashboard card headers.
- Progress badge: shadcn `Badge variant="outline"` (transparent fill, `border-border` default outline colour, `text-foreground`), `text-xs` (12px), shows a live fraction e.g. "1/3", "2/3" — counts `hasSleep`, `hasWeight`, and `trainingDone` (`hasPlannedTraining || isRestDay`) as booleans summed via `.filter(Boolean).length`.

##### (b) Sleep sub-section — 3 possible states

**Not logged, prompt closed** (`button-prompt-sleep`):
```
<button className="flex items-center gap-3 w-full p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors text-left">
  <Moon className="h-4 w-4 text-primary shrink-0" />
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium">How did you sleep?</p>
    <p className="text-xs text-muted-foreground">Log last night's sleep</p>
  </div>
</button>
```
- Full-width row, `rounded-lg` (9px), `p-3` (12px). Border is **neutral** here (`border-border/50`, not orange) — a deliberate contrast against the Fight Camp card's `border-primary/30` prompt buttons, since this card is already orange-washed at the container level and doesn't need a second orange accent per-row.
- `hover:bg-secondary/30` (10–13% lightness slate tint) on pointer devices, no background at rest.
- `Moon` icon `h-4 w-4 text-primary` (orange, 16px). Title `text-sm font-medium` (500), subtitle `text-xs text-muted-foreground`.

**Input open** (`sleep-input-form`):
```
<div className="space-y-3 p-3 rounded-lg border border-border/50 bg-secondary/20">
  <div className="flex items-center gap-2"><Moon className="h-4 w-4 text-primary" /><Label className="text-sm font-medium">Hours slept</Label></div>
  <Input type="number" step="0.5" min="0" max="24" placeholder="e.g., 7.5" />
  <div>
    <Label className="text-xs text-muted-foreground">Quality (optional)</Label>
    <div className="flex gap-1 mt-1">
      {[1,2,3,4,5].map(q => <Star className="h-5 w-5" /* filled yellow-400 up to selected q, else muted-foreground/30 */ />)}
    </div>
  </div>
  <div className="flex gap-2"><Button size="sm">Save</Button><Button size="sm" variant="ghost">Cancel</Button></div>
</div>
```
- Container swaps the border-only look for a filled `bg-secondary/20` (subtle slate fill) once expanded, `space-y-3` (12px) between the hours input, star-quality picker, and action buttons.
- **5-star quality picker**: each star is a `<button className="p-1">` wrapping a `Star` icon at `h-5 w-5` (20px, larger than the standard `h-4 w-4` icon size, since stars need to read clearly as tap targets). Filled state: `text-yellow-400 fill-yellow-400` (solid yellow star, both stroke and fill) for every star index ≤ the selected quality; unfilled: `text-muted-foreground/30` (very faint grey outline star, no fill). Tapping the same star that's already selected toggles quality back to `null` (deselects, since quality is optional).
- Save button `size="sm"` disabled while `!sleepHours` or pending; Cancel `size="sm" variant="ghost"` collapses the form.

**Logged** (`button-edit-sleep`):
```
<button className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 w-full text-left hover:bg-secondary/30 transition-colors">
  <Check className="h-4 w-4 text-green-500" />
  <span className="text-sm text-muted-foreground flex-1">Sleep logged: {hours}h{quality ? ` (quality ${q}/5)` : ""}</span>
  <span className="text-[10px] text-muted-foreground/60">tap to edit</span>
</button>
```
- Tighter padding than the prompt/input states (`p-2` vs `p-3`), filled `bg-secondary/20` background (no border at all — the fill alone signals "done").
- `Check` icon: `h-4 w-4 text-green-500` (Tailwind green-500, `#22C55E` — note this is a *different* green shade from the Fight Camp card's `green-400` used for the `justLogged` pulse; both read as "success green" but are not colour-matched pixel-for-pixel — preserve `green-500` specifically here).
- Summary text `text-sm text-muted-foreground flex-1` (grows to fill the row), trailing `text-[10px] text-muted-foreground/60` "tap to edit" affordance — identical micro-copy pattern used for all "completed, tap to revisit" rows in this card.
- Tapping repopulates the form inputs from the logged values and reopens the input state (full round-trip edit, not inline).

##### (c) Weight sub-section — 3 states

Structurally identical to the Fight Camp card's weight CTA (§17.1.3c) but with neutral (non-orange) borders to match this card's sub-section styling, and writes to the same `POST /api/weights` endpoint:
- Prompt: `button-prompt-weight` — "Morning weight?" / "Log today's weigh-in", `Scale` icon, same `border-border/50` neutral row style as (b).
- Input: `weight-input-form` — `Scale` icon + "Morning weight (kg)" label, numeric input (`step="0.1" min="20" max="300"`, `autoFocus`), Save/Cancel pair, Save shows "Saving…" while pending.
- Logged: `button-weight-logged` — green check + "Weight logged: {weight} kg" + "tap to edit", same `bg-secondary/20` fill treatment as the sleep-logged row.
- On success: toast "Weight logged — trend updated ✅" (note: this is a **separate** write path from the Fight Camp card's own weight CTA — both call `POST /api/weights` independently and both invalidate `/api/me/weight-cut`, `/api/me/morning-status`, `/api/me/readiness`, `/api/me/fuel` — logging from either card keeps both in sync).

##### (d) Training sub-section — 3 states

**Not done** (prompt, non-button container with an embedded action button):
```
<div className="p-3 rounded-lg border border-border/50 space-y-2">
  <div className="flex items-center gap-3">
    <Dumbbell className="h-4 w-4 text-primary shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">Training today?</p>
      <p className="text-xs text-muted-foreground">Log a session or mark as rest</p>
    </div>
  </div>
  <Button size="sm" variant="outline" className="w-full text-xs gap-2">
    <BedDouble className="h-3.5 w-3.5" /> Mark as rest day
  </Button>
</div>
```
- Unlike sleep/weight, this row is **not itself a button** (it doesn't deep-link anywhere — logging an actual training session happens via the Training page or Quick Log), it only offers the "Mark as rest day" shortcut inline. Same `border-border/50 rounded-lg p-3` shell as the other prompt rows, `space-y-2` (8px) between the label row and the button.
- "Mark as rest day" button: `variant="outline" size="sm"` (bordered, transparent fill), full width, `text-xs gap-2`, `BedDouble` icon at `h-3.5 w-3.5` (14px, smaller than the section icons — this is a secondary action, not the row's main icon).

**Rest day marked** (`button-unmark-rest-day`): same green-check `bg-secondary/20` row pattern as sleep/weight-logged states — "Rest day" text + "tap to undo" trailing hint. Tapping calls `DELETE /api/me/rest-day/:date`.

**Training session already created** (static, non-interactive row — `hasPlannedTraining && !isRestDay`):
```
<div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20">
  <Check className="h-4 w-4 text-green-500" />
  <span className="text-sm text-muted-foreground">Training session created</span>
</div>
```
- The only sub-section state across this entire card that is **not** wrapped in a `<button>` — there's nothing to "tap to edit" back to (editing a training session happens on the Training page), so no trailing hint text and no hover treatment.

##### (e) No entry/exit animation

Like the Fight Camp card, this component is not wrapped in a `motion.div` — it mounts/unmounts as a plain conditional (`if (allDone) return null`), so its disappearance once the day's 3 tasks are complete is an instant DOM removal, not a fade-out. This is consistent with the app's general pattern of using Framer Motion for *value changes within* a mounted card (colour pulses, modal transitions) rather than for a card's own mount/unmount — worth preserving as a deliberate low-motion default rather than adding animation everywhere.

---

### 17.3 Readiness Summary card (`ReadinessSummaryCard`)

Component file: `client/src/components/ReadinessSummaryCard.tsx`. Always renders (no loading/empty gating) — a compact, always-visible link-out row to `/readiness`. Wrapped in `pt-2` (8px top padding) by the parent dashboard, per §12.4.

```
<Link href="/readiness">
  <Card className="cursor-pointer hover:bg-secondary/10 transition-colors" data-testid="card-readiness-summary">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Readiness block */}
          {/* Fuel block */}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
          <span>Details</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </CardContent>
  </Card>
</Link>
```

- The **entire card is a Link** (`wouter`'s `<Link>` wraps the `<Card>`) — the whole surface is clickable, not just an internal button; `cursor-pointer hover:bg-secondary/10 transition-colors` gives a whole-card hover tint (10% opacity slate wash) distinguishing it as a "click to see more" summary card, unlike the primarily self-contained Fight Camp / Morning Check-In cards above it.
- Padding: `p-4` (16px), single row layout (`flex items-center justify-between`), no internal vertical stacking.

##### Left side — two stat blocks side by side (`gap-4`, 16px between them)

Each block: `flex items-center gap-2` (icon + text column).

**Readiness block:**
- `Zap` icon: `h-4 w-4 text-muted-foreground/50` — note this icon is **muted grey**, not orange, at rest (unlike most other card icons in the app which default to `text-primary`). It never changes colour regardless of the readiness value — only the badge beside it carries colour.
- Micro-label "Readiness": `text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider` — the app's smallest label style, at 60% opacity (fainter than the `/70` label style used elsewhere, e.g. Fight Camp's `text-[10px] text-muted-foreground/70`).
- Value badge (`badge-readiness-summary`): shadcn `Badge variant="outline"`, `text-[11px]` (11px, between the app's `text-[10px]` and `text-xs`/12px sizes — used nowhere else on the dashboard), `mt-0.5` (2px) gap from the label above it. Colour keyed by label:

| Readiness label | Colour classes |
|---|---|
| `High` | `text-green-400 border-green-400/30 bg-green-400/10` |
| `Moderate` | `text-yellow-400 border-yellow-400/30 bg-yellow-400/10` |
| `Low` | `text-orange-400 border-orange-400/30 bg-orange-400/10` |
| `Poor` | `text-red-400 border-red-400/30 bg-red-400/10` |
| `Provisional` (i.e. `readiness.provisional === true`, label text shown as "Estimated") | `text-blue-300 border-blue-300/30 bg-blue-300/10` |

  Note `blue-300` is used nowhere else in the colour system documented in §2/§11 — it's a one-off "this is an estimate, not real data" signal colour, worth adding to the master token table if extending the palette. Empty/loading value falls back to a plain `"—"` em-dash with no colour classes applied.

**Fuel block:** identical structure — `Fuel` icon (`h-4 w-4 text-muted-foreground/50`), label "Fuel", badge (`badge-fuel-summary`) coloured by `fuel.fuelStatus`:

| Fuel status | Colour classes |
|---|---|
| `High` | `text-green-400 border-green-400/30 bg-green-400/10` |
| `Adequate` | `text-green-400 border-green-400/30 bg-green-400/10` (identical to `High` — both map to the same green) |
| `Low` | `text-red-400 border-red-400/30 bg-red-400/10` |

  Unlike the readiness badge, the fuel badge has **no distinct "provisional" colour** — even when the underlying data is estimated, the fuel badge still uses the plain status-based colour (only the readiness side visually flags provisional data via the blue "Estimated" badge).

##### Right side — "Details" affordance

`flex items-center gap-1 text-xs text-muted-foreground/50` — plain "Details" text (12px, faint grey) + `ChevronRight` icon (`h-3.5 w-3.5`, 14px). No hover-state colour change on this element specifically (the whole-card `hover:bg-secondary/10` is the only hover feedback).

---

### 17.4 Provisional Check-In card (`ProvisionalCheckIn`)

Component file: `client/src/components/ProvisionalCheckIn.tsx`. Conditionally rendered **only when `readiness.provisional === true`** (i.e. the system can't compute real readiness from logged data and needs a manual self-report) — returns `null` otherwise. Two states: **form** (not yet submitted, or editing) and **summary** (submitted, read-only).

##### 17.4.1 Summary state (`isComplete && !editing`)

```
<Card data-testid="card-provisional-checkin">
  <CardContent className="p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold">Quick Check-in</h3>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="text-xs text-blue-300 border-blue-300/30 bg-blue-300/10">Estimated</Badge>
        <button data-testid="button-edit-checkin"><Pencil className="h-3.5 w-3.5" /></button>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 text-xs text-center">...</div>
    {/* optional yesterday-training line */}
    <p className="text-[10px] text-muted-foreground italic">...</p>
  </CardContent>
</Card>
```

- Header: same `text-sm font-display font-semibold` title treatment as all other dashboard cards, but with a `CheckCircle2` icon (`h-4 w-4 text-primary`, orange — signalling "done"), plus the same blue-300 "Estimated" badge used on the Readiness Summary card (visual thread tying provisional data together across cards) and a bare (unstyled-container) `Pencil` icon button, `text-muted-foreground hover:text-foreground transition-colors`, `h-3.5 w-3.5` — no button background/border at all, just an icon that brightens on hover.
- **3-column emoji summary grid**: `grid grid-cols-3 gap-2 text-xs text-center`, each cell `bg-secondary/20 rounded p-2` (note: plain `rounded`, not `rounded-lg` — 4px corners here vs. the 9px used on most other cells in the app, a small inconsistency to preserve). Cell content stacked: emoji at `text-lg mb-1` (18px, `mb-1` = 4px), category label in `text-muted-foreground` (e.g. "Feeling", "Fueled", "Today's plan"), then the answer in `font-medium` (e.g. "Fresh", "Yes", "Moderate" — the intensity value additionally gets `capitalize`).
- Optional "trained yesterday" line (only if that question was asked): `text-xs text-muted-foreground flex items-center gap-1.5` — a raw emoji (✅ or 😴) followed by plain text, e.g. "Trained yesterday — moderate" or "Rest day yesterday". Uses literal emoji characters directly in JSX text, not an icon component.
- Disclaimer footer: `text-[10px] text-muted-foreground italic` — "Readiness and fuel status are estimated from your self-report — not objective data. Log yesterday's food and training for a complete assessment." (Note: this one is NOT dimmed to `/50` opacity like the Fight Camp card's disclaimer — it's full `text-muted-foreground`, making it slightly more prominent since provisional-data disclosure is more important here.)

##### 17.4.2 Form state (not complete, or `editing === true`)

```
<Card data-testid="card-provisional-checkin">
  <CardContent className="p-4 space-y-4">
    <div className="flex items-center gap-2">
      <ClipboardList className="h-4 w-4 text-primary" />
      <div>
        <h3 className="text-sm font-display font-semibold">Quick Check-in</h3>
        <p className="text-xs text-muted-foreground">{questionCount} questions — drives estimated readiness & fuel status</p>
      </div>
    </div>
    <div className="space-y-4">{/* 3 or 4 question blocks */}</div>
    <div className="flex gap-2">{/* Cancel (if editing) + Submit */}</div>
  </CardContent>
</Card>
```

- Header icon swaps to `ClipboardList` (still `h-4 w-4 text-primary`) with a subtitle showing the dynamic question count ("3 questions…" or "4 questions…" when the yesterday-training branch applies).
- **Each question block**: `space-y-2` — a `text-xs font-medium` question label, then a `ToggleGroup` (or `BoolToggleGroup` for the yes/no yesterday-training question) of 2–3 emoji-button options.

**`ToggleGroup` / `BoolToggleGroup` button anatomy** (shared component, reused for all 4 questions):
```
<button className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg text-xs border transition-all
  {selected: 'border-primary bg-primary/10 text-primary font-semibold'}
  {unselected: 'border-border/40 bg-secondary/20 text-muted-foreground hover:border-border hover:bg-secondary/40'}">
  <span className="text-lg leading-none">{emoji}</span>
  <span>{label}</span>
</button>
```
- Options lay out in an equal-width row (`flex-1` each, `gap-2` container), `rounded-lg` (9px), `py-2.5 px-1` (10px vertical / 4px horizontal padding — tall, narrow buttons designed to sit 2–3 across).
- **Selected**: `border-primary` (solid orange border, full opacity — the only place in the app where a toggle border goes to 100% orange rather than a fractional-opacity tint), `bg-primary/10` fill, `text-primary font-semibold` label.
- **Unselected**: `border-border/40` (faint neutral border), `bg-secondary/20` fill, `text-muted-foreground` label; hovers to `border-border` (full opacity neutral) + `bg-secondary/40` (doubled fill opacity) — a purely neutral hover, no orange tinting pre-selection.
- Emoji rendered at `text-lg leading-none` (18px, tight line-height so it doesn't add extra vertical space), label below at default `text-xs` (12px, inherited from the button's own class).
- Question sets: Feel today (💪 Fresh / 😐 Okay / 😴 Tired), Fueled yesterday (🟢 Yes / 🟡 Somewhat / 🔴 Not really), Planned intensity (🚶 Light / 🏃 Moderate / 🔥 Hard), conditionally Trained yesterday (✅ Yes / 😴 No/Rest) which if "Yes" reveals a nested 5th question reusing the same intensity option set at `pt-1` (4px) indent with a `text-xs text-muted-foreground` sub-label ("How hard was yesterday's session?").
- Submit row: `flex gap-2` — if editing, a `variant="outline" size="sm" flex-1 h-9 text-sm` Cancel button appears first; the submit button is always `size="sm" flex-1 h-9 text-sm` filled/default variant, disabled until all applicable questions are answered (`canSubmit`), label cycles "Submit check-in" → "Saving…" (pending) / "Update" when editing an existing entry.

---

### 17.5 Daily Intake Estimates card

Defined inline in `client/src/pages/dashboard.tsx` (not a separate component file). Standard shadcn `Card`, no loading/empty state — always renders once `user` and `adjustedTargets` are available.

##### (a) Header

```
<CardHeader className="flex flex-row items-start justify-between gap-1 space-y-0 pb-2">
  <div>
    <CardTitle className="flex items-center gap-2 flex-wrap">
      Daily Intake Estimates
      {isFightCamp && <Badge className="text-xs font-normal bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20">Fight Camp</Badge>}
      {hasTraining && <Badge variant="outline" className="text-xs font-normal">+{trainingKcal} kcal training …</Badge>}
    </CardTitle>
    <CardDescription>{contextual sentence}</CardDescription>
  </div>
  <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm"><Info className="h-4 w-4" /></Button></PopoverTrigger>
    <PopoverContent side="left" className="max-w-[320px] text-xs space-y-2">…</PopoverContent>
  </Popover>
</CardHeader>
```
- Uses `items-start` (not `items-center`, unlike the standard card header pattern in §7) because the title can wrap onto 2 lines when badges are present.
- "Fight Camp" badge: `bg-orange-500/20 text-orange-400 border-orange-500/30` — note this exact combo is also documented in §11 as the canonical Fight Camp badge; the `hover:bg-orange-500/20` explicitly cancels shadcn's default badge hover-darken since this badge is not interactive.
- "+N kcal training" badge: `variant="outline"`, plain, with an inline conditional suffix in `text-orange-400/80` showing how much was actually credited back ("· 320 added (EA)" or "· 320 added (80%)") when in fight-camp mode.
- Info popover: `variant="ghost" size="sm"` icon-only trigger (`Info`, `h-4 w-4`), popover content `side="left"`, capped `max-w-[320px]`, `text-xs space-y-2` — explains the goal-mode training-kcal-addback policy (50/75/100% by goal, or EA-floor logic for fight camp), plus a closing "estimates only" disclaimer line in `text-muted-foreground`.

##### (b) 2×4 macro target grid

```
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
  <div className="p-4 bg-secondary/50 rounded-lg text-center">
    <div className="text-3xl font-extrabold font-mono">{calories}</div>
    <div className="text-[10px] text-muted-foreground/70 tracking-wide mt-0.5">Calories</div>
    {addedBack > 0 && <div className="text-[9px] text-muted-foreground/40 mt-1">Base: {base} +{addedBack}</div>}
  </div>
  {/* Protein, Carbs, Fat — same cell shape */}
</div>
```
- 2 columns on mobile, 4 on `sm:` and up — `gap-4` (16px). Each cell: `p-4 bg-secondary/50 rounded-lg text-center` (the standard "inner section cell" pattern from §7).
- Number: `text-3xl font-extrabold font-mono` (30px, 800, JetBrains Mono) — identical treatment to the Fight Camp card's current/target weight numbers.
- Label: `text-[10px] text-muted-foreground/70 tracking-wide mt-0.5` (2px top gap).
- **Calories and Carbs cells only** can show a third micro-line breaking down the base vs. training-adjusted value: `text-[9px] text-muted-foreground/40 mt-1` — the smallest text size found anywhere in the app (9px, even below the `text-[10px]` micro-label standard), at the faintest opacity (40%), reserved for this one "extra detail nobody needs to read but some will want" breakdown line.

##### (c) Fight Camp priority callout (conditional, `isFightCamp` only)

```
<div className="flex items-start gap-2 rounded-lg bg-orange-500/8 border border-orange-500/20 px-3 py-2.5">
  <span className="text-orange-400 mt-0.5 flex-shrink-0 text-sm">🥊</span>
  <div className="text-xs text-orange-300/90 leading-relaxed">Fight Camp plan is controlling your targets…</div>
</div>
```
- `bg-orange-500/8` — note the unusual `/8` opacity fraction (8%, not a standard Tailwind step like `/10`) — a deliberately very subtle warm wash, listed in §2's semantic table as "Fight Camp callout".
- Boxing-glove emoji (🥊) used as a literal inline icon at `text-sm` (14px), not a lucide icon — one of only a few places in the app using raw emoji as a visual glyph instead of an SVG icon (others: the pace-note micro-copy and the ProvisionalCheckIn emoji toggles).
- Body text colour `text-orange-300/90` — note this is Tailwind `orange-300` (a lighter shade than the `orange-400` used for badges elsewhere), at 90% opacity — a one-off shade for this specific callout body copy.

##### (d) Energy Availability (EA) row + warnings (conditional, fight camp + `eaValue` present)

```
<div className={cn(
  "flex items-center justify-between rounded-md px-3 py-2 text-xs",
  isLowEA && !eaAccepted ? "bg-orange-500/10 border border-orange-500/30 text-orange-400" : "bg-secondary/50 text-muted-foreground"
)}>
  <span className="font-medium">Energy Availability</span>
  <div className="flex items-center gap-2">
    <span className="font-mono font-semibold">{eaValue} kcal/kg FFM</span>
    {isLowEA && !eaAccepted && <button className="text-[10px] underline underline-offset-2 opacity-80 hover:opacity-100">Review →</button>}
    {originallyLowEA && eaAccepted && <span className="text-[10px] flex items-center gap-1.5 text-muted-foreground">· adjusted ✓ <button className="text-primary underline underline-offset-2">Review</button></span>}
  </div>
</div>
```
- Two colour states: **warning** (`bg-orange-500/10 border-orange-500/30 text-orange-400`, when EA is below the 30 kcal/kg-FFM threshold and the user hasn't yet acknowledged it) vs. **neutral** (`bg-secondary/50 text-muted-foreground`, either healthy EA or already-acknowledged-and-adjusted).
- `rounded-md` (6px — smaller radius than the `rounded-lg`/`rounded-xl` used for cells/cards elsewhere, since this is a slim inline status row).
- Value shown in `font-mono font-semibold` (tabular figures for the kcal/kg number).
- "Review →" link-style button: `text-[10px] underline underline-offset-2 opacity-80 hover:opacity-100` — text-as-button with no border/background, just an underline; label drops the arrow ("Review" only) if the user previously dismissed/declined the review flow (`eaDecision === "declined"`).
- Post-acknowledgement state adds "· adjusted ✓" in muted grey plus a still-clickable orange `text-primary underline` "Review" link to revisit the decision.
- **Low-carb warning row** (`text-low-carb-warning`, conditional, separate row below): same `rounded-md px-3 py-2 text-xs` shell but with `bg-yellow-500/10 border-yellow-500/30 text-yellow-400` (yellow, distinct from the EA row's orange) for "Carbs below 3 g/kg", with its own matching "Review →" / post-acceptance "adjusted ✓" pattern in the same interaction style as the EA row.
- The two rows stack in a `space-y-1.5` (6px) wrapper.

##### (e) Disclaimer + collapsible "How estimates are calculated"

```
<p className="text-[10px] text-muted-foreground italic leading-tight px-1">These values are estimates…</p>
<Collapsible className="mt-4">
  <CollapsibleTrigger asChild>
    <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground hover:text-foreground gap-2 p-2">
      <ChevronDownIcon className="h-3 w-3" /> How estimates are calculated
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="pt-3 pb-1 px-2">
    <p className="italic border-t border-border/50 pt-1 text-[11px] text-muted-foreground leading-relaxed">…</p>
  </CollapsibleContent>
</Collapsible>
```
- Disclaimer: `text-[10px] italic text-muted-foreground leading-tight px-1` — same tiny-italic disclaimer idiom used across the app (Fight Camp card, Supplements checklist).
- Collapsible trigger styled as a full-width ghost button (`justify-start`, left-aligned, not centred) with a `ChevronDownIcon` (`h-3 w-3`, 12px) that rotates via shadcn's built-in Collapsible animation on expand (CSS `data-[state=open]` rotation, not manual Framer Motion).
- Expanded content: `text-[11px]` (11px, between the disclaimer's 10px and body's 12px) with a `border-t border-border/50 pt-1` divider separating it from the trigger row above.

---

### 17.6 Date navigation bar

Inline JSX in `dashboard.tsx`, not a component. Row layout: `flex flex-col sm:flex-row sm:items-center justify-between gap-4` — stacks vertically on mobile (date controls above action buttons), goes side-by-side from `sm:` breakpoint up.

**Left cluster** (`flex items-center gap-3`):
- Prev-day button: `variant="outline" size="icon"` (40×40px default icon button), `ChevronLeft h-4 w-4`.
- Date group: `flex items-center gap-2` — `Calendar` icon (`h-4 w-4 text-muted-foreground`) + native `<input type="date">` styled via shadcn `Input`, `w-[160px] font-medium` (fixed 160px width, medium-weight date text — the browser's native date-picker chrome is used as-is, not a custom calendar popover).
- Next-day button: identical to prev, `ChevronRight`.
- "Today" ghost button: `variant="ghost" size="sm"`, **only rendered when `!isToday`** (i.e. viewing a past/future date) — appears/disappears based on the selected date rather than being permanently visible.

**Right cluster** (`flex gap-2 flex-wrap`, wraps onto multiple lines on narrow viewports rather than overflowing):
1. `WeightUpdateDialog` trigger button
2. `FoodEntryDialog` trigger, `isPrimary` (styled as the default filled/primary button — the dominant action in this row)
3. Quick Log button: `variant="outline" size="default"`, `Sparkles` icon (`mr-2 h-4 w-4`) + "Quick Log" label — opens the AI logging dialog
4. `LogEntryDialog` trigger (manual weight/training/supplement log entry)

---

### 17.7 Greeting header

```
<div>
  <div className="flex items-center flex-wrap gap-2">
    <h1 className="text-3xl font-display font-bold text-foreground">Hello, {user.username}</h1>
    {user.mainSport && <SportBadge mainSport={user.mainSport} />}
  </div>
  <p className="text-muted-foreground">{isToday ? "Here is your daily nutrition summary." : `Viewing ${format(...)}`}</p>
</div>
```
- Heading: `text-3xl font-display font-bold text-foreground` (30px, Space Grotesk, 700) — the single largest text on the entire dashboard, matching the "Page title / hero heading" pattern from §3.
- `SportBadge` (sport icon PNG, ~32×32px per §15) sits inline beside the heading via `flex items-center flex-wrap gap-2`, wrapping onto a new line on very narrow screens rather than clipping.
- Subtext switches copy based on whether the selected date is today ("Here is your daily nutrition summary.") vs. a different date ("Viewing {Month Day, Year}") — same `text-muted-foreground`, default `text-sm`-equivalent (inherited paragraph size, no explicit size class).

---

### 17.8 Macro stats grid (`StatCard` × 5)

Component file: `client/src/components/ui/stat-card.tsx`. Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4` — 1 column on mobile, 2 on tablet, all 5 across on desktop.

```
<div className="bg-card border border-border/40 rounded-xl p-5 card-elevated card-hover {border-l-4 border-l-{colour}}">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{title}</h3>
    <div className="text-muted-foreground/40">{icon}</div>
  </div>
  <div className="flex items-baseline gap-1.5">
    <span className="text-3xl font-bold font-mono tracking-tight number-animate {isOverTarget && 'text-amber-500'}">{value}</span>
    <span className="text-xs text-muted-foreground/70 font-medium">{unit}</span>
  </div>
  {target && (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Target: {target}</span>
        <span className="{isOverTarget && 'text-amber-500 font-medium'}">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full progress-bar-animated {isOverTarget ? 'bg-amber-500' : 'bg-primary'}" style={{ width: `${animatedWidth}%` }} />
      </div>
      {isOverTarget && <p className="text-[10px] text-amber-500/80">{pct - 100}% above target</p>}
    </div>
  )}
</div>
```

- Card shell (note: this is a **plain `<div>`**, not the shadcn `Card` component — its own bespoke class set): `bg-card border border-border/40 rounded-xl p-5 card-elevated card-hover`. `border-border/40` gives a real, always-visible border (unlike shadcn `Card`'s empty `border-card-border` token) — one of the few places on the dashboard with a genuinely visible neutral card outline at rest.
- Left accent border, per macro (from §2's semantic table, `border-l-4`): Calories → `border-l-primary` (orange), Protein → `border-l-blue-500`, Carbs → `border-l-amber-500`, Fat → `border-l-yellow-500`, Fibre → `border-l-emerald-500`.
- Header row: `text-xs font-semibold tracking-wide text-muted-foreground` title (12px, uppercase-adjacent letter tracking but NOT actually uppercased in CSS — the title strings themselves are already capitalized, e.g. "Calories") + icon at `text-muted-foreground/40` (very faint grey wrapper — the icon itself, e.g. `Flame`, inherits this colour rather than being tinted per-macro, unlike the border).
- Value row: `flex items-baseline gap-1.5` — big number `text-3xl font-bold font-mono tracking-tight` (30px, 700, mono) + unit `text-xs text-muted-foreground/70 font-medium` inline beside it, baseline-aligned so the unit sits on the number's text baseline rather than being vertically centred.
- **Over-target state** (`rawPercentage > 110`): value number itself turns `text-amber-500`, percentage readout turns `text-amber-500 font-medium`, progress bar fill turns `bg-amber-500` (from the default `bg-primary` orange), and an extra line appears below the bar: `text-[10px] text-amber-500/80` — "{N}% above target".
- Progress bar: `h-2 w-full bg-secondary rounded-full overflow-hidden` (8px tall track) with an animated inner fill (`progress-bar-animated` class from §9 — `transition: width 0.8s cubic-bezier(0.4,0,0.2,1)`). The width animates from 0% on mount via a `setTimeout(50ms)` delay before setting the real `animatedWidth` state — this deliberate 1-frame delay is what makes the bar visibly "grow in" on card mount/date-change rather than snapping instantly to its target width.
- `card-hover` class (from §9) adds the lift-on-hover treatment (`translateY(-1px)` + deeper shadow) — these are the only cards on the dashboard with hover-lift, signalling (subtly) that they're not clickable but are meant to feel tactile/alive.

---

### 17.9 Macro warning banner (conditional — 0 or 1 shown, computed inline)

Not a component — an IIFE inline in `dashboard.tsx` returning one of two banners or `null`, based on `calRatio` (logged ÷ target calories) and whether any individual macro exceeds 110% of its target.

**Case A — total calories over target (`calRatio > 1.05`)**, `text-over-target-message`:
```
<div className="rounded-xl border bg-amber-500/10 border-amber-500/20 px-4 py-3">
  <p className="text-sm text-foreground">Today ran a bit higher than planned. The best approach is to return to your normal routine tomorrow — consistency beats compensation.</p>
  <p className="text-xs text-muted-foreground mt-1">There's no need to reduce intake or "make up for it" the next day.</p>
</div>
```
- Amber warning treatment (`bg-amber-500/10 border-amber-500/20`), matching §2's "Warning callout" pattern.
- Deliberately reassuring/non-punitive copy — reflects the app's stated "conservative framing" design principle from §1: no shaming language, no compensatory-eating suggestions.

**Case B — calories under target but a macro elevated (`calRatio < 0.95 && anyMacroElevated`)**, `text-macro-note-message`:
```
<div className="rounded-xl border bg-card/60 border-border/40 px-4 py-3">
  <p className="text-sm text-foreground">A few individual nutrients ran a bit high, but total calorie intake stayed below plan.</p>
  <p className="text-xs text-muted-foreground mt-1">Isolated macro overages are normal when overall energy intake is on or below target.</p>
</div>
```
- Neutral/calm treatment — `bg-card/60 border-border/40` (a translucent card-tinted surface, not a colour-coded warning) since this scenario isn't actually concerning (net calories are fine).
- Both cases share the same shell shape: `rounded-xl border px-4 py-3`, a `text-sm text-foreground` primary line, and a `text-xs text-muted-foreground mt-1` supporting line.
- On-target / no deviation → banner is entirely omitted (returns `null`), no "all good" success banner is ever shown here (consistent with the Morning Check-In card's philosophy of only surfacing action/attention items).

---

### 17.10 AMQS mini CTA row

```
<div
  className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/20 transition-colors"
  role="button" tabIndex={0}
>
  <div className="flex items-center gap-3">
    <ShieldCheck className="h-5 w-5 text-muted-foreground/60 shrink-0" />
    <div>
      <p className="text-sm font-semibold leading-tight">Micronutrient Score</p>
      <p className="text-xs text-muted-foreground">{score} — {tier} · {topGap} gap</p>
      {/* or, if no AMQS data yet: */}
      <p className="text-xs text-muted-foreground">Log your first meal to start tracking</p>
    </div>
  </div>
  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
</div>
```
- A plain `<div>` (not `Card` or `Link`) manually wired for click + keyboard accessibility (`role="button" tabIndex={0}`, `onKeyDown` handles Enter/Space) navigating to `/micronutrients` via `wouter`'s `setLocation`.
- `border-border/50` gives a real visible border (50% opacity neutral) — heavier than the plain shadcn Card default, lighter than the macro StatCard's `/40`.
- Whole-row hover: `hover:bg-secondary/20` (20% slate tint) + `transition-colors` — same "clickable card" affordance pattern as the Readiness Summary card (§17.3), though implemented as a raw div here rather than a `Link`-wrapped `Card`.
- `ShieldCheck` icon: `h-5 w-5 text-muted-foreground/60` (20px, muted grey — like the Readiness card's icons, this doesn't recolor based on the score value).
- Title "Micronutrient Score": `text-sm font-semibold leading-tight` (14px, 600).
- Summary line composes score + tier + (optional) top nutrient gap inline: `{score} — {tier}` then, if gaps exist, ` · {gap label} gap` with the gap label itself bumped to `text-foreground/70` for slightly more emphasis within the otherwise `text-muted-foreground` line. Falls back to "Log your first meal to start tracking" before any AMQS data exists for the day.
- Trailing `ChevronRight`: `h-4 w-4 text-muted-foreground/40` (16px, very faint — fainter than the Readiness card's `/50` chevron).

---

### 17.11 Today's Supplements checklist (`TodaysSupplements`)

Defined inline in `dashboard.tsx` (function component in the same file, not a separate module). Standard shadcn `Card`, 3 states: loading, empty (no scheduled supplements), and populated checklist.

**Header** (all 3 states share this shell): `CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2"` — `CardTitle` with `Pill` icon (`h-5 w-5`, default foreground colour — not tinted orange, unlike most other card-header icons) + "Supplements — {Month Day}" title, `CardDescription` beneath showing either "Loading...", "Today's scheduled supplements" (empty state), or a live tally "Scheduled for today ({taken} of {total} taken)". A "Manage" ghost button (`variant="ghost" size="sm"`, wrapped in a `Link` to `/supplements`) sits at the top-right of the header in the empty and populated states only (omitted while loading).

**Empty state**: `CardContent` with a single `text-sm text-muted-foreground` sentence: "No supplements scheduled today. Enable reminders on your supplements to see them here."

**Populated state** — `CardContent className="space-y-2"`, one row per scheduled slot:
```
<div className={cn(
  "flex items-center justify-between p-3 rounded-lg border transition-colors",
  taken ? "bg-emerald-500/10 border-emerald-500/30" : "bg-secondary/30"
)}>
  <div className="flex-1">
    <p className={cn("font-medium text-sm", taken && "line-through text-muted-foreground")}>
      {name} {dose && <span className="text-muted-foreground font-normal"> ({dose})</span>}
    </p>
    <p className="text-xs text-muted-foreground">{stackName ? `${stackName} at ${time}` : `at ${time}`}</p>
  </div>
  <Button size="icon" variant={taken ? "default" : "outline"} className={cn("h-8 w-8", taken && "bg-emerald-500 hover:bg-emerald-600")}>
    {taken ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
  </Button>
</div>
```
- Row shell: `p-3 rounded-lg border` — **untaken** rows have no visible border colour beyond the default `border` class token and sit on a flat `bg-secondary/30` fill; **taken** rows switch to a distinct green treatment (`bg-emerald-500/10 border-emerald-500/30`), a different green shade family (`emerald`) from the amber/green/red status colours used elsewhere — emerald is specifically reserved for "supplement/positive completion" states across the app (also used for fibre's stat-card accent border in §17.8 and the fat-loss consistency badge's best tier).
- Supplement name: `font-medium text-sm`; once taken, gets `line-through text-muted-foreground` (struck through, dimmed) — the only strikethrough treatment used anywhere in the dashboard.
- Dose (if present): inline parenthetical in `text-muted-foreground font-normal` appended directly after the name.
- Sub-line: stack name + time, or just time — `text-xs text-muted-foreground`.
- Action button: `size="icon"` (32×32px override via `h-8 w-8`, smaller than shadcn's default 40×40 icon button), toggles between `variant="outline"` + `Plus` icon (untaken) and filled `bg-emerald-500 hover:bg-emerald-600` (a literal green fill overriding the `default` variant's orange) + `Check` icon (taken) — this is the **only button in the entire app that uses a green fill instead of the brand orange**, deliberately signalling supplement-completion as a distinct "done" affordance separate from primary actions.
- Footer disclaimer (all populated-state cards): `text-[10px] text-muted-foreground italic pt-2` — "Personal tracking only. Not medical advice." — same disclaimer idiom pattern as the other dashboard cards, but scoped only to the populated (non-empty) state here.
- Taking a supplement fires a toast, and if the resulting AMQS score increased, the toast title becomes `"AMQS +{delta}"` with a `ToastAction` button "See updated gaps" (navigates back to `/`) — otherwise a plain "Logged — dashboard updated" toast.

---

### 17.12 Weight trend mini-chart

Inline JSX block, `bg-card border border-border/40 rounded-xl p-6 card-elevated` — note this card uses `p-6` (24px, the most generous padding on the dashboard) and applies `card-elevated` (from §9) but *not* `card-hover` (it's not meant to feel clickable — no navigation happens on click).

**Header row**: `flex items-center justify-between mb-6` — left side: `h3.text-lg.font-display.font-semibold` "Weight Trend" + `p.text-sm.text-muted-foreground` "Last 7 recorded entries"; right side: a small icon badge, `bg-secondary p-2 rounded-lg` housing a `Scale` icon (`h-5 w-5 text-muted-foreground`) — this is the only place on the dashboard where a header icon sits inside its own filled pill/badge container rather than floating inline beside text.

**Chart** (`h-[250px] w-full`, Recharts `AreaChart` via `ResponsiveContainer`):
- Gradient fill `id="colorWeight"`: `linearGradient` from `stopColor="hsl(var(--primary))" stopOpacity={0.1}` at 5% down to `stopOpacity={0}` at 95% — a soft orange fade-to-transparent area fill under the line, referencing the CSS variable directly (not a static hex) so it always tracks the theme's primary colour.
- `CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"` — horizontal-only dashed gridlines in the border colour.
- Axes: both `axisLine={false} tickLine={false}` (no visible axis lines/ticks, just floating labels) — X-axis labels `dy={10}` (10px below the plot), Y-axis `domain={['auto','auto']}` with values formatted to 1 decimal (`tickFormatter`), fixed `width={48}`. Both use `tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}`.
- `Tooltip`: custom `contentStyle` — `backgroundColor: hsl(var(--card))`, `borderRadius: 8px`, `border: 1px solid hsl(var(--border))`, `boxShadow: 0 4px 12px rgba(0,0,0,0.1)` — replicates the app's card surface styling inside the Recharts tooltip so it feels native rather than using Recharts' default white tooltip.
- `Area` line: `stroke="hsl(var(--primary))" strokeWidth={2}`, fill via the gradient above, `type="monotone"` (smoothed curve, not straight line segments).
- **Empty/insufficient-data state** (`chartData.length <= 1`): the chart area is replaced entirely by a centred message — `flex items-center justify-center h-full text-muted-foreground text-sm` — "Record more weight data to see trends" (no placeholder chart/skeleton is shown, just plain centred text filling the same 250px height).

---

### 17.13 Food diary (meal-grouped entries)

Outer container: `bg-card border border-border/40 rounded-xl p-6 card-elevated` (identical shell treatment to the Weight Trend card directly above it — the two large content cards on the lower dashboard share this exact surface style).

**Header row**: `flex items-center justify-between gap-2 mb-4 flex-wrap` — `h3.text-lg.font-display.font-semibold` "Today's Meals" (or "Meals — {Month Day}" for past/future dates) + a `SavedMealsDialog` trigger button on the right, wrapping onto a new line on narrow viewports (`flex-wrap`) rather than squeezing.

**Empty state** (no food entries at all for the day):
```
<div className="flex flex-col items-center py-6 text-center border border-dashed border-border/50 rounded-lg">
  <Utensils className="h-8 w-8 text-muted-foreground/20 mb-3" />
  ...
</div>
```
- Dashed border container (`border-dashed border-border/50 rounded-lg`) — the **only dashed-border element documented on the dashboard**, a standard "empty drop-zone-style" affordance signalling "nothing here yet, add something".
- Large, extremely faint icon: `Utensils`, `h-8 w-8` (32px, one of the largest icons on the page) at `text-muted-foreground/20` (20% opacity — barely visible, purely decorative).

**Populated state** (`MealGroupedEntries`): sections stack in `space-y-5` (20px), one per meal that has ≥1 entry (breakfast/lunch/dinner sections are omitted entirely if empty; snacks are further split into numbered sub-groups "Snack #1", "Snack #2", etc. via `snackIndex`).

Each meal section (`space-y-2`):
- **Meal header row**: `flex items-center gap-2 text-sm font-medium text-muted-foreground flex-wrap` — a meal-specific icon (`Coffee` breakfast / `Sun` lunch / `Moon` dinner / `Cookie` snack, all `h-4 w-4`), the meal label, an item-count `Badge variant="secondary" className="text-[10px] px-1.5"`, then (pushed right via `ml-auto`) a tight `gap-0.5` cluster of `SaveMealDialog` and `CopyMealDialog` trigger icon-buttons.
- **Meal totals line** (`meal-totals-{mealKey}`): `text-[11px] text-muted-foreground/60 font-mono pl-1` — a compact one-line macro summary, e.g. "620 kcal · P 45g · C 60g · F 18g · Fi 6g" (fibre segment only appended when > 0), matching the app-wide "compact totals row" feature noted in the project overview.
- **Individual food entry rows**, each wrapped in `motion.div` (`initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-20}}`, inside an `AnimatePresence` so removals slide out to the left while additions fade/slide up from below — the only per-item list animation on the dashboard):
```
<motion.div className="flex items-center justify-between p-3 rounded-lg border bg-secondary/30 group">
  <div className="flex-1">
    <p className="font-medium">{name} <span className="text-xs text-muted-foreground font-normal">({grams}g {basis})</span></p>
    <div className="flex gap-3 text-xs text-muted-foreground">
      <span>{cal} kcal</span><span>P: {p}g</span><span>C: {c}g</span><span>F: {f}g</span>{fibre > 0 && <span>Fi: {fi}g</span>}
    </div>
  </div>
  <div className="flex gap-1">
    <CopyFoodDialog entry={entry} />
    <EditFoodDialog entry={entry} existingEntries={allEntries} />
    <DeleteFoodButton id={entry.id} />
  </div>
</motion.div>
```
  - Row shell: `p-3 rounded-lg border bg-secondary/30` — same base treatment as the Supplements checklist's untaken row, reused here for visual consistency between the two "small item list" patterns on the dashboard.
  - `group` class enables icon-button hover-through styling within the row (copy/edit/delete icon buttons brighten together on row hover, in components not shown here).
  - Name row: food name in `font-medium` (default size, ~16px), immediately followed inline by a parenthetical gram/basis note in `text-xs text-muted-foreground font-normal` (e.g. "(150g cooked)").
  - Macro breakdown sub-row: `flex gap-3 text-xs text-muted-foreground` — four or five short macro readouts space-separated (`gap-3`, 12px), fibre segment conditionally appended only when present and > 0.
  - Action cluster: 3 icon buttons in a tight `flex gap-1` row (copy to another date/meal, edit, delete) — no labels, icon-only, consistent with the compact list-row pattern used throughout the app's list views.

---

This completes the full element-by-element pass for the Dashboard page (§17.1–17.13). Next candidate pages for the same treatment, in priority order suggested by app usage: Training Log (`/training`), Micronutrients/AMQS detail (`/micronutrients`), and Supplements (`/supplements`).

---

## 19. Toast Notification System — Complete Reference

Every in-app toast in PRFMR is documented here: the trigger, the exact text, the variant, which file owns it, what API call (if any) precedes it, and what mobile replication requires.

---

### 19.1 Infrastructure — how toasts work

**Library:** Radix UI Toast primitive, wrapped by shadcn's `Toast` component family. The wrapper is in `client/src/components/ui/toast.tsx`; state management in `client/src/hooks/use-toast.ts`; the renderer in `client/src/components/ui/toaster.tsx`.

**Key constraints:**
- `TOAST_LIMIT = 1` — only one toast is ever on screen at a time. If a new one fires while another is showing, the new one replaces the previous (the reducer slices to the first element of the updated array).
- `TOAST_REMOVE_DELAY = 1,000,000 ms` — toasts are never automatically removed from React state. They are visually dismissed by Radix's own internal duration timer (default ~5 seconds for the Radix primitive), but stay in the state array until `REMOVE_TOAST` is dispatched. This means a mobile port should treat each toast as ephemeral and auto-dismiss after ~5 seconds unless the user manually swipes/closes.
- The `duration` prop on an individual toast call (e.g. `toast({ ..., duration: 5000 })`) overrides Radix's default for that specific toast.

**Two variants:**

| `variant` | Background | Text | Use |
|---|---|---|---|
| `default` (omitted) | `bg-background` = `hsl(220 20% 7%)` (near-black) | `text-foreground` | All normal confirmations |
| `destructive` | `bg-destructive` = deep red (`hsl(0 62.8% 30.6%)`) | `text-destructive-foreground` | Validation errors, failures |

**Toast anatomy:**
- Title: `text-sm font-semibold` (14px, 600)
- Description: `text-sm opacity-90` (14px, slightly dimmed)
- Optional action button (`ToastAction`): `h-8 px-3 text-sm font-medium rounded-md border` — inline clickable link that navigates or triggers an action
- Close button: `X` icon, `absolute right-2 top-2`, only visible on hover (`group-hover:opacity-100`)
- Swipe-to-dismiss supported on touch (Radix handles this natively via `data-[swipe=end]:animate-out`)

**Position:**
- Mobile (< `sm` breakpoint): top of viewport, slides in from top (`slide-in-from-top-full`)
- Desktop (≥ `sm`): bottom-right, slides in from bottom (`slide-in-from-bottom-full`)
- `z-[100]` — above normal UI, below the fight-camp celebration modal (`z-[9999]`) and fixed bottom nav

**`fireCelebration(emoji)` is NOT a toast.** It fires a DOM `CustomEvent` on a singleton `EventTarget` (`celebrationBus`). The emoji confetti animation is a completely separate visual system — it never shows text or a dismissable card. The two systems are independent: a toast and a `fireCelebration` call can fire together for the same action (e.g. plan creation), but must be implemented separately.

---

### 19.2 Food logging toasts

**Source file: `client/src/hooks/use-logs.ts` → `useCreateFoodEntry()`**

This is the most complex toast flow in the app. Every successful food add goes through a 5-step decision tree:

```
onSuccess(entry):
  1. Snapshot old AMQS score from React Query cache (before invalidation)
  2. Invalidate all food + AMQS query keys
  3. Check AMQS_TOAST_DEBOUNCE_MS (5000ms) — was the last AMQS toast < 5s ago?
     → YES: fire fallback toast "Logged — dashboard updated" / "{name} added." — STOP
     → NO: fetch /api/me/amqs/score/{date} fresh (cache: "no-store")
       → HTTP fail / exception: fire fallback "Logged — dashboard updated" / "{name} added. AMQS recalculating."
       → HTTP OK: compare old vs new score:
           → newScore > oldScore: fire AMQS boost toast
           → score unchanged, top gap improved: fire gap improvement toast
           → score unchanged, no gap improvement: fire fallback
```

**The debounce (`lastAmqsToastTime`)** is a module-level variable (not React state) — it survives re-renders but resets on page reload. Purpose: if a user logs 3 foods in 4 seconds, only the first gets an AMQS-fetching toast; subsequent ones get the cheaper fallback to avoid hammering the AMQS endpoint and spamming near-identical toasts.

**Outcome A — AMQS debounce active (< 5s since last AMQS toast):**
| Field | Value |
|---|---|
| Title | `"Logged — dashboard updated"` |
| Description | `"{entry.name} added."` |
| Variant | default |
| Action | none |

**Outcome B — AMQS score increased:**
| Field | Value |
|---|---|
| Title | `"AMQS +{newScore − oldScore}"` |
| Description | `"{entry.name} boosted your micronutrient score."` |
| Variant | default |
| Action | `"See updated gaps"` — `data-testid="toast-see-gaps"` — navigates to `/micronutrients` (via `window.location.href`) |

**Outcome C — Score unchanged, but top micronutrient gap reduced:**
| Field | Value |
|---|---|
| Title | `"{oldTopGap.label} gap improved by {improvement}%"` |
| Description | `"{entry.name} added. Keep going."` |
| Variant | default |
| Action | `"See updated gaps"` → `/micronutrients` |

Where `improvement = matchingGap.pctOfTarget − oldTopGap.pctOfTarget` (integer percentage points), `oldTopGap.label` is the human-readable name of the nutrient (e.g. `"Vitamin D"`, `"Iron"`).

**Outcome D — Generic fallback (API fail, exception, no AMQS movement):**
| Field | Value |
|---|---|
| Title | `"Logged — dashboard updated"` |
| Description | `"{entry.name} added. AMQS recalculating."` |
| Variant | default |
| Action | none |

**Outcome E — Mutation error:**
| Field | Value |
|---|---|
| Title | `"Failed to add food"` |
| Description | `error.message` (from the thrown Error) |
| Variant | `destructive` |

---

**Dashboard-specific delayed food toast** (`client/src/pages/dashboard.tsx`, `showJustAdded()`)

Some food-add paths in `dashboard.tsx` (the barcode scanner, Core Foods quick-add, custom-macro entry) call `showJustAdded(name)` locally rather than routing through `useCreateFoodEntry`. This function:
1. Sets `justAdded` state (drives an inline "just added" flash in the UI for 2.5s)
2. Starts a **5000ms timer** that fires a toast after the flash animation has settled:

| Field | Value |
|---|---|
| Title | `"Logged — dashboard updated"` |
| Description | `"{name} added. Micro scores recalculating."` |
| Variant | default |

This timer is cleared if the component unmounts (cleanup in `useEffect`), so closing the dialog before 5s prevents the toast from appearing. Note the slight difference in description vs. the `use-logs.ts` fallback (`"Micro scores recalculating."` here vs. `"AMQS recalculating."` in `use-logs.ts`).

---

**Food update (`useUpdateFoodEntry`):**
| Outcome | Title | Description | Variant |
|---|---|---|---|
| Success | `"Entry Updated"` | `"Food item and totals have been updated."` | default |
| Error | `"Update Failed"` | `error.message` | destructive |

**Food delete (`useDeleteFoodEntry`):**
| Outcome | Title | Description | Variant |
|---|---|---|---|
| Success | `"Entry Removed"` | `"Food item has been deleted."` | default |
| Error | `"Delete Failed"` | `"Failed to remove food entry."` | destructive |

**Copy food entry** (copy-to-date dialog, `dashboard.tsx`):
| Outcome | Title | Description | Variant |
|---|---|---|---|
| Success | `"Copied"` | `"{entry.name} copied to {toDate}."` | default |

---

### 19.3 Weight logging toasts

Weight can be logged from four different surfaces. Each produces slightly different text — this is intentional (each surface has a different context) and must be preserved faithfully on mobile.

| Surface | File | Toast title | Description | Notes |
|---|---|---|---|---|
| Morning Check-In card | `MorningCheckIn.tsx` | `"Weight logged — trend updated ✅"` | none | The `✅` emoji is part of the literal string |
| Morning Check-In Gate (full-screen modal) | `MorningCheckInGate.tsx` | `"Weight logged"` | none | Shorter — gate modal is more streamlined |
| Fight Camp Hero card | `WeightCutHero.tsx` | (no toast — uses `fcModal` instead) | — | Weight submission fires an `fcModal` overlay card ("On trend ↓" or "Weight naturally fluctuates"), NOT a toast. See §18.1.4. |
| Quick Log / AI Log dialog | `AILogDialog.tsx` | `"Weight logged — {weightValue} kg"` | none | Includes the numeric value |
| Weight update dialog | `weight-update-dialog.tsx` | `"Weight saved"` | none | Used from the profile weight edit field |
| Weight log create (`useCreateWeightLog`, `use-logs.ts`) | `use-logs.ts` | `"Log Saved"` | `"Your daily progress has been recorded."` | General-purpose hook |
| Weight log update (`useUpdateWeightLog`, `use-logs.ts`) | `use-logs.ts` | `"Log Updated"` | `"Your changes have been saved."` | Edit existing log |
| Weight + targets save (`useUpdateWeight`, `use-logs.ts`) | `use-logs.ts` | `"Weight Saved"` | `"Your weight and targets have been updated."` | Updates profile weight + recalculates targets |

**Weight validation error** (`weight-update-dialog.tsx`):
| Title | Description | Variant |
|---|---|---|
| `"Invalid weight"` | `"Please enter a valid number for weight."` | destructive |

**Mobile note:** When logging a weight from the fight camp card context on mobile, do not fire a toast — replicate the `fcModal` overlay (§18.1.4) instead. For all other surfaces, fire the appropriate toast above. The distinction is important because the fight camp card's overlay also handles "weight went up" vs "weight went down" branching logic.

---

### 19.4 AMQS update toasts

AMQS toasts fire from three separate places. They are always **client-side computed** — the server never pushes a notification; the client snapshots the score before an action, waits for the mutation to settle, fetches the new score, then diffs.

#### 19.4.1 After logging a food item
See §19.2 outcomes B and C above (AMQS boost, gap improvement). The action button navigates to `/micronutrients`.

#### 19.4.2 After marking a supplement as taken (`dashboard.tsx` checklist toggle)

The supplement toggle in the Today's Supplements checklist (dashboard) runs its own AMQS diff — **independently** of the `use-logs.ts` food debounce. It waits 300ms after mutation success (to let the server aggregate micros), then fetches `/api/me/amqs/score/{date}`.

| Outcome | Title | Description | Action |
|---|---|---|---|
| Score increased | `"AMQS +{delta}"` | `"Supplement boosted your micronutrient score."` | `"See updated gaps"` (`data-testid="toast-see-gaps-supp"`) → `window.location.href = '/'` (reloads dashboard) |
| Score unchanged / API fail / exception | `"Logged — dashboard updated"` | `"Supplement marked as taken. AMQS recalculating."` | none |

Note: the action for the supplement AMQS toast goes to `'/'` (dashboard root), while the food AMQS toast goes to `'/micronutrients'`. This is an inconsistency in the current codebase — preserve it as-is.

#### 19.4.3 AMQS milestone — all baseline targets met (`AMQSCard.tsx`)

A one-time daily toast that fires when `daily.allMet` transitions from `false` to `true` (tracked with a `useRef` to prevent re-firing on re-renders).

| Field | Value |
|---|---|
| Title | `"Baseline adequacy covered"` |
| Description | `"All key micronutrient targets met today. Now optimise for athlete targets."` |
| Duration | `5000` ms (explicitly passed — longer than the default ~5s Radix timer) |
| Variant | default |
| Action | none |
| Trigger | `useEffect` watching `daily?.allMet` — fires only when the value flips to `true`, not on every render |

**Where AMQS is computed:** entirely server-side. `GET /api/me/amqs/score/{date}` aggregates all food and supplement micronutrients for the date and returns `{ score, allMet, topGaps }`. The client never computes AMQS directly — it only diffs the before/after `score` and `topGaps[0]` values it receives from two sequential fetches.

---

### 19.5 Fight camp toasts

| Trigger | File | Title | Description | Variant |
|---|---|---|---|---|
| Plan created (`WeightCutHero`) | `WeightCutHero.tsx` | *(toast suppressed — fires `fcModal` + `fireCelebration("🎯")` instead)* | — | — |
| Plan edited (`WeightCutHero`) | `WeightCutHero.tsx` | `"Fight camp plan updated 🎯"` | none | default |
| Plan deleted (`WeightCutHero`) | `WeightCutHero.tsx` | `"Weight cut plan removed"` | none | default |
| Plan created/edited (`WeightCutPlanner`) | `WeightCutPlanner.tsx` | `"Weight cut plan created"` or `"Plan updated"` | none | default |
| Plan deleted (`WeightCutPlanner`) | `WeightCutPlanner.tsx` | `"Weight cut plan removed"` | none | default |

**Performance carb warning** (`dashboard.tsx` — fight camp only):

A soft nutrition warning shown as a toast (not a modal) when the user has logged actual training activities and carb intake is above the hard floor (≥ 3 g/kg) but below the performance-optimised threshold for hard/very-hard sessions.

| Field | Value |
|---|---|
| Title | `"Performance note"` |
| Description | The `performanceCarbWarning` string from `GET /api/me/targets/effective` (e.g. `"Carbohydrate intake may be low for this training load…"`) |
| Timing | Fires 1500ms after the `useEffect` observing `effectiveTargets.isBelowPerformanceCarb` runs |
| Frequency | Once per day per plan fingerprint — stored in `localStorage` via `useFightCampOverride` (`perfToastShown: true`) |
| Variant | default |

The server computes `isBelowPerformanceCarb` and `performanceCarbWarning` inside `GET /api/me/targets/effective` (see §18.1.7). The client just reads those flags and fires the toast.

---

### 19.6 Training toasts

All sourced from `client/src/pages/training.tsx` unless noted.

| Action | Title | Description | Variant |
|---|---|---|---|
| Session created | `"Session created"` | none | default |
| Session deleted | `"Session deleted"` | none | default |
| Exercise added to session | `"Exercise added"` | none | default |
| Set added to exercise | `"Set added"` | none | default |
| Activity (cardio) added | `"Activity added"` | none | default |
| Activity updated | `"Activity updated"` | none | default |
| Rest day marked | `"Rest day marked"` | none | default |
| Rest day removed | `"Rest day removed"` | none | default |
| Manual kcal burn logged | `"Manual burn logged"` | `"{kcal} kcal added to today's training."` | default |
| Manual kcal burn error | `"Error"` | `"Failed to log manual burn."` | destructive |
| Training block saved | `"Training block saved"` | `"{blockName} is active — sessions created for each week."` | default |
| Training block save error | `"Failed to save block"` | none | destructive |
| Training block preview error | `"Could not load preview"` | none | destructive |

**Quick log (AILogDialog.tsx):**
| Action | Title | Description | Variant |
|---|---|---|---|
| Training session logged | `"Training session logged"` | none | default |
| Recurring session(s) created | `"Sessions created for next {dayOfWeek}"` | none | default |
| Any save error | `"Failed to save"` | `error.message` | destructive |

---

### 19.7 Supplement management toasts

**Supplement CRUD** (`client/src/pages/supplements.tsx`):
| Action | Title | Variant |
|---|---|---|
| Added | `"Supplement added"` | default |
| Updated | `"Supplement updated"` | default |
| Deleted | `"Supplement deleted"` | default |

**Stack CRUD** (`client/src/pages/stacks.tsx`):
| Action | Title | Variant |
|---|---|---|
| Stack created | `"Stack created"` | default |
| Stack updated | `"Stack updated"` | default |
| Stack deleted | `"Stack deleted"` | default |
| Reminder added | `"Reminder added"` | default |
| Reminder deleted | `"Reminder deleted"` | default |

**Push notification permission** (`stacks.tsx`):
| Result | Title | Description | Variant |
|---|---|---|---|
| Granted | `"Notifications enabled"` | `"You'll receive browser notifications for reminders"` | default |
| Denied | `"Notifications blocked"` | `"Please enable notifications in your browser settings"` | destructive |
| Default/unavailable | `"Notifications unavailable"` | `"Your browser may not support notifications"` | default |

**Supplement reminder engine** (`client/src/hooks/use-reminder-engine.ts`):

This hook runs a `setInterval` in the background (checks every minute whether a scheduled reminder time has been crossed) and fires both a toast and a `Notification` (if browser permission is granted).

| Field | Value |
|---|---|
| Title | `"Supplement Reminder"` |
| Description | `"Time to take your {stackName} stack"` |
| Variant | default |
| Also fires | `new Notification("Supplement Reminder", { body: "Time to take your {stackName} stack" })` if `Notification.permission === "granted"` |

**Mobile note:** Mobile apps have native push notification APIs instead of the Web Notification API. The `use-reminder-engine.ts` hook's `setInterval` pattern can be replaced with scheduled local notifications (e.g. `expo-notifications` for Expo). The toast component of the reminder would fire as normal when the app is foregrounded.

---

### 19.8 Saved meal toasts

All from `client/src/hooks/use-logs.ts`.

| Action | Title | Description | Variant |
|---|---|---|---|
| Meal saved as template | `"Meal Saved"` | `"Your meal has been saved as a template."` | default |
| Save error | `"Failed to save meal"` | `error.message` | destructive |
| Template logged (added to diary) | `"Meal Logged"` | `"{count} items added to your log."` | default |
| Log error | `"Failed to log meal"` | `error.message` | destructive |
| Meal copied (to another date/meal slot) | `"Meal Copied"` | `"{count} items copied successfully."` | default |
| Copy error | `"Failed to copy meal"` | `error.message` | destructive |
| Template deleted | `"Template Deleted"` | `"Saved meal has been removed."` | default |

---

### 19.9 Morning Check-In Gate toasts

`MorningCheckInGate.tsx` is a full-screen card shown at the start of day (before the user has done their morning check-in). It has its own weight/sleep mutation copies independent of `MorningCheckIn.tsx`.

| Action | Title | Variant |
|---|---|---|
| All check-in tasks done | `"Check-in complete — your targets are up to date"` | default |
| Sleep logged | `"Sleep logged"` | default |
| Weight logged | `"Weight logged"` | default |
| Gate dismissed with incomplete check-in | `"You can complete your check-in anytime from the dashboard"` | default |

---

### 19.10 Auth toasts

All from `client/src/hooks/use-auth.ts`.

| Action | Title | Description | Variant |
|---|---|---|---|
| Login success | `"Welcome back"` | `"Signed in as {username}"` | default |
| Login error | `"Login failed"` | `error.message` | destructive |
| Register success | `"Account created"` | `"Welcome, {username}!"` | default |
| Register error | `"Registration failed"` | `error.message` | destructive |
| Logout success | `"Signed out"` | `"You have been logged out."` | default |
| Logout error | `"Error"` | `error.message` | destructive |
| Verification email sent | `"Email sent"` | `"Check your inbox for a verification link."` | default |
| Email updated | `"Email updated"` | `"Check your new email for a verification link."` | default |

---

### 19.11 Profile toasts

All from `client/src/pages/profile.tsx`.

| Action | Title | Description | Variant |
|---|---|---|---|
| Sport identity updated | `"Sport identity updated"` | none | default |
| Sport identity save failed | `"Failed to save"` | none | destructive |
| Body fat % updated | `"Body fat % updated"` | none | default |
| Body fat % save failed | `"Failed to save"` | none | destructive |
| Body fat % invalid (< 3 or > 55) | `"Enter a value between 3 and 55"` | none | destructive |
| Username updated | `"Username updated"` | `"Please sign in again with your new username."` | default |
| Sport badge removed | `"Sport badge removed"` | none | default |

---

### 19.12 Quick Log (AI Log) toasts

All from `client/src/components/AILogDialog.tsx`. These fire on the final "confirm and save" step.

| Action | Title | Description | Variant |
|---|---|---|---|
| Food item(s) logged | `"{N} item(s) logged"` | none | default |
| Weight logged | `"Weight logged — {weightValue} kg"` | none | default |
| Training session logged | `"Training session logged"` | none | default |
| Supplement(s) marked taken | `"{N} supplement(s) marked taken"` | none | default |
| Recurring sessions created | `"Sessions created for next {dayOfWeek}"` | none | default |
| Voice input not supported | `"Voice not supported"` | `"Use text input instead."` | destructive |
| Any save error | `"Failed to save"` | `error.message` | destructive |

---

### 19.13 Feedback toasts

`client/src/pages/feedback.tsx` and `client/src/components/feedback-modal.tsx`.

| Trigger | Title | Description | Variant |
|---|---|---|---|
| Invalid screenshot file type | `"Invalid file type"` | `"{filename}: Only PNG, JPEG, and WebP are allowed."` | destructive |
| Screenshot file too large (> 5 MB) | `"File too large"` | `"{filename}: Maximum size is 5MB."` | destructive |
| Max screenshots reached (limit varies) | `"Maximum reached"` | `"You can attach up to {N} screenshots."` | destructive |
| Submit failed / rate limited | `"Failed to submit"` | `"Too many submissions. Try again later."` (if 429) or `"Something went wrong. Please try again."` | destructive |

---

### 19.14 Mobile replication guide

**The toast system is entirely client-side.** No server endpoint triggers a toast directly. The pattern for every toast is:
1. User takes an action (form submit, toggle, etc.)
2. A mutation fires against the API
3. `onSuccess` / `onError` of the mutation calls `toast({...})`

To replicate on mobile:

**1. Use a native in-app notification/snackbar** — React Native's `react-native-toast-message`, Expo's `expo-toast`, or a custom `Snackbar`. Match the two variants:
- `default` → dark background with white text (matches the app's dark card surface)
- `destructive` → red background with white text

**2. Observe the same TOAST_LIMIT = 1 rule.** Show only one at a time; queued toasts replace the current one. This prevents stacking and is visible in every flow where multiple rapid actions could fire toasts.

**3. For AMQS-enhanced food toasts:** implement the same diff pattern:
```
before mutation → snapshot GET /api/me/amqs/score/{date} into local cache
after mutation success → wait for cache invalidation to settle, then re-fetch /api/me/amqs/score/{date}
compare: if newScore > oldScore → show AMQS boost notification
         else if topGap improved → show gap improvement notification
         else → show generic "logged" notification
apply debounce: skip the AMQS fetch if last AMQS-fetch toast was < 5s ago
```

**4. For fight-camp weight logging:** do NOT fire a toast — show a fullscreen overlay card instead (see §18.1.4). The overlay handles the "weight up" vs "weight down" branching, has a share button, and auto-dismisses after 4.5s. This is only on the fight camp card surface; all other weight-log surfaces use a plain toast.

**5. Action buttons in toasts:** the two toasts with action buttons ("See updated gaps" on AMQS boosts) navigate to `/micronutrients`. On mobile, map this to your equivalent deep-link or tab navigation to the micronutrients screen. The supplement AMQS toast's action currently goes to `'/'` (dashboard) — see §19.4.2.

**6. The reminder engine** (`use-reminder-engine.ts`) uses `setInterval` + Web Notifications API. On mobile, replace this with scheduled local push notifications. The in-app toast portion fires normally when the app is in the foreground.

**7. Exact string matching matters for some toasts.** The title `"Weight logged — trend updated ✅"` from the Morning Check-In card includes a trailing emoji as part of the string. The fight camp plan edit toast `"Fight camp plan updated 🎯"` also includes an emoji. Preserve these exactly.

**8. The `duration: 5000` override** is only used by the AMQS milestone toast in `AMQSCard.tsx` (`"Baseline adequacy covered"`). All other toasts use the Radix default (~5s visual duration). Keep the milestone toast slightly longer to give users time to read the description.

---

## 18. Vite Asset Alias

In `vite.config.ts`:
```typescript
"@assets": path.resolve(import.meta.dirname, "attached_assets")
```

So `import logo from "@assets/no_back_logo_1775476772001.png"` resolves to `attached_assets/no_back_logo_1775476772001.png`. When replicating, keep this alias or update all import paths accordingly.

---

## 20. Training Page — Full Element-by-Element Breakdown

**Route:** `/training` | **File:** `client/src/pages/training.tsx` (2,026 lines)

---

### 20.1 Page header

```
Training Log                                     [🥊 N days to fight night]  [📅 Block name]  [Plan Block / Edit Block]
Track your workouts and activities
```

- Title: `text-2xl font-display font-bold` — Space Grotesk
- Subtitle: `text-muted-foreground` — Inter, default size
- Header row: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`
- Chips and button sit in a `flex flex-wrap items-center gap-2` wrapper

**Fight night countdown chip** (conditional — only when a weight-cut plan exists with `daysUntil >= 0`):
- `data-testid="chip-days-to-fight"`
- Classes: `flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold`
- Content: `🥊 {N} day(s) to fight night`
- Data source: `GET /api/me/weight-cut` → `{ daysUntil, fightDate }` — server-computed from `fight_date - today`, cached 5 minutes

**Active block chip** (conditional — only when a training block is active):
- `data-testid="chip-active-block"`
- Classes: `flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-medium`
- Icon: `Calendar` (lucide), `h-3 w-3`
- Content: `{activeBlock.name}`
- Data source: `GET /api/training-blocks/active` → `{ id, name, startDate, weekCount, days[] }`

**Plan Block / Edit Block button:**
- `data-testid="button-plan-block"`
- Classes: `h-8 text-xs border-primary/30 text-primary hover:bg-primary/10` on `variant="outline" size="sm"`
- Label: `"Plan Block"` when no block active, `"Edit Block"` when one is active
- Icon: `Calendar` `h-3.5 w-3.5 mr-1`
- Action: opens `TrainingBlockModal`

---

### 20.2 Date navigation card

A `<Card>` containing a centered date picker with prev/next buttons.

```
[<]   [date input]        [>]
      Thursday, July 14, 2026
      📅 Planned: hard
```

- Card: standard `rounded-xl border bg-card`, `p-4` via `<CardContent>`
- Prev/next: `variant="outline" size="icon"` buttons with `ChevronLeft` / `ChevronRight` icons (`h-4 w-4`)
- `data-testid="button-previous-day"` / `"button-next-day"`
- Date input: `<Input type="date">`, `w-auto mx-auto text-center`; `data-testid="input-date"`
- Formatted date below input: `text-sm text-muted-foreground mt-1`, format `"EEEE, MMMM d, yyyy"` (date-fns)

**Planned load chip** (conditional — only when active block has a planned load for the selected date):
- Computed **client-side** from `activeBlock.days` — no extra API call
- Formula: find the day-of-week in `activeBlock.days` where `dayOfWeek = (selectedDate.getDay() + 6) % 7` (Mon=0 … Sun=6)
- If activities are present on the plan day, derives load from AU = `Σ(rpe × durationMinutes)` or `Σ(durationMinutes × 3)` if no RPE
  - AU < 300 → `light`, < 600 → `moderate`, < 900 → `hard`, else → `very_hard`
- `data-testid="chip-planned-load"` or `"chip-planned-rest"`
- Colour coding:
  - `very_hard`: `bg-red-500/15 border-red-500/30 text-red-400`
  - `hard`: `bg-orange-500/15 border-orange-500/30 text-orange-400`
  - `moderate`: `bg-yellow-500/15 border-yellow-500/30 text-yellow-400`
  - `light` / other: `bg-green-500/15 border-green-500/30 text-green-400`
  - `rest`: `bg-muted/30 border-border/30 text-muted-foreground`
- Format: `📅 Planned: {load}` (underscores replaced with spaces)

---

### 20.3 Rest day toggle

**Only visible when `sessions.length === 0` for the selected date.**

```
🛏 Mark as rest day          (when not a rest day)
🛏 Rest day ✓ (tap to undo)  (when rest day is active)
```

- Aligned to the right: `flex justify-end`
- Custom `<button>` (not shadcn Button), `data-testid="button-toggle-rest-day"`
- Classes (active state): `flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25`
- Classes (inactive state): `border-border/50 text-muted-foreground hover:bg-secondary/40`
- Icon: `BedDouble` (`h-3.5 w-3.5`)
- API: `POST /api/me/rest-day/{date}` to mark, `DELETE /api/me/rest-day/{date}` to remove
- Data source: `GET /api/me/training/summary/{date}` → `{ isRestDay: boolean }` (server checks `rest_days` table)
- On success: invalidates `training/summary`, `morning-status`, and `targets/effective` queries; fires toast `"Rest day marked"` or `"Rest day removed"`

---

### 20.4 Estimated calories card

```
🔥 Estimated Calories Burned          [Hard]  ~420 kcal
   ⚠ Back-to-back hard days detected.
   Classification is personalised to your baseline.         [📊 28-day trend]
```

- Card: `bg-accent/10 border-accent/20`; `p-4`
- Flame icon: `h-5 w-5 text-accent`
- Label: `font-medium`
- `~{totalCalories} kcal`: `text-xl font-bold text-accent` — computed client-side as `Σ session.estimatedKcal`

**Day classification badge** (`data-testid="badge-day-classification"`):
- `variant="outline"`, with colour class from the load map (same colours as planned load chip above)
- Classification derived by the client from `GET /api/me/training-load/{date}`, preferring `effectiveClassification` over `classification`
- If no API data yet, falls back to client-side computation: `Σ (rpe × durationMinutes)` for lifting, `Σ estimatedKcal` for cardio
- If user has overridden: badge text shows `"{label} ✎"`
- If provisional (no activities logged): `"{label} (est.)"`

**Inline warning text** (conditional — only when `trainingLoadData.warnings.length > 0`):
- Each warning: `text-xs text-orange-400/70 flex items-start gap-1`, with `AlertTriangle h-3 w-3 mt-0.5 text-orange-400/70` icon
- `data-testid="text-load-warning-{i}"`
- Warnings are **server-generated** strings from `GET /api/me/training-load/{date}`

**Disclaimer footnote:** `text-[10px] text-muted-foreground/50 italic`

**28-day trend button:** `data-testid="button-view-load-trend"`, navigates to `/load-trend`; `text-xs text-muted-foreground hover:text-foreground`, icon `BarChart2 h-3.5 w-3.5`

**Missing-weight notice** (conditional — only when `user.currentWeight` is not set): `text-xs text-muted-foreground mt-2` — "Set your weight in profile for cardio activity estimates."

---

### 20.5 Time-of-day session panels

Three collapsible panels: **Morning** (06:00–12:00), **Afternoon** (12:00–18:00), **Evening** (18:00–24:00). All open by default on page load.

Each panel is a `<Collapsible>` wrapping a `<Card>`:

**Panel header (CollapsibleTrigger):**
- `flex items-center justify-between cursor-pointer` inside `<CardHeader className="p-4">`
- Left: `ChevronDown h-5 w-5` (rotates to `-rotate-90` when collapsed), then time-of-day label (`text-lg` / `font-display` via `<CardTitle>`) and time-range string (`text-xs text-muted-foreground`)
- Right (conditional — only when session exists): `<Badge variant="secondary">` with `Flame h-3 w-3 mr-1` + `~{estimatedKcal} kcal`

**No session yet state:**
- `w-full text-left py-3 px-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-2`
- `Plus h-4 w-4 text-muted-foreground/50 flex-shrink-0`
- Text: `"No {morning/afternoon/evening} session yet — tap to log"`
- `data-testid="button-create-session-{timeOfDay}"`
- Click: `POST /api/workouts/sessions` with `{ date, timeOfDay }`

**Session exists — header row:**
- Left: optional `{session.title}` (`font-medium`) + optional `"Planned"` badge (`border-primary/40 text-primary/80 bg-primary/8 text-[10px] px-1.5 py-0 border`)
- Right: delete button — `variant="ghost" size="icon"`, `Trash2 h-4 w-4 text-destructive`, `data-testid="button-delete-session-{id}"`
- Below title: `intensity` badge (`variant="outline" text-xs`) + duration (`Clock h-3 w-3` + `{N} min`, `text-sm text-muted-foreground`)

**Exercises sub-section:**
- Header: `Dumbbell h-4 w-4` + "Exercises" (`text-sm font-medium flex items-center gap-2`)
- "Add Exercise" button: `variant="outline" size="sm"`, `Plus h-3 w-3 mr-1`, `data-testid="button-add-exercise-{sessionId}"`

Each exercise row (`border rounded-lg p-3`):
- Exercise name (`font-medium`) + optional estimated kcal badge (`variant="outline" text-xs`)
- `data-testid="button-add-set-{exerciseId}"` (ghost `+ Set` button) and delete icon (`Trash2 h-3 w-3 text-destructive`)
- Set table header: `grid grid-cols-5 gap-2 text-xs text-muted-foreground px-2` — columns: Set / Reps / Weight / RPE / (action)
- Set rows: `grid grid-cols-5 gap-2 text-sm bg-muted/50 rounded px-2 py-1`

**Activities sub-section:**
- Header: `Activity h-4 w-4` + "Activities" (`text-sm font-medium`)
- "Add Activity" button: `variant="outline" size="sm"`, `data-testid="button-add-activity-{sessionId}"`

Each activity row (`flex items-center justify-between py-2 border-b last:border-0`):
- **Cardio:** Activity name + `intensity` badge + optional `RPE {N}` badge + `~{estimatedKcal} kcal` (`text-accent`)
- **Lifting** (`activityType === "lifting"`): Activity name + `Dumbbell h-3.5 w-3.5 text-muted-foreground` icon + `"Lifting"` badge (`variant="secondary"`) + `RPE {sessionRpe}` badge + duration + region text (`text-xs text-muted-foreground/70`)
- Edit icon (`Pencil h-4 w-4 text-muted-foreground`), `data-testid="button-edit-activity-{id}"`
- Delete icon (`Trash2 h-4 w-4 text-destructive`)

---

### 20.6 API endpoints consumed by training page

| Method | Endpoint | Purpose | Who computes |
|---|---|---|---|
| `GET` | `/api/workouts/sessions?start={date}&end={date}` | Sessions with exercises + activities for selected date | Server |
| `POST` | `/api/workouts/sessions` | Create session | Server |
| `DELETE` | `/api/workouts/sessions/{id}` | Delete session | Server |
| `POST` | `/api/workouts/sessions/{sessionId}/exercises` | Add exercise | Server |
| `DELETE` | `/api/workouts/exercises/{id}` | Delete exercise | Server |
| `POST` | `/api/workouts/exercises/{exerciseId}/sets` | Add set | Server |
| `DELETE` | `/api/workouts/sets/{id}` | Delete set | Server |
| `POST` | `/api/workouts/sessions/{sessionId}/activities` | Add activity (cardio or lifting) | Server |
| `PATCH` | `/api/workouts/activities/{id}` | Edit activity | Server |
| `DELETE` | `/api/workouts/activities/{id}` | Delete activity | Server |
| `GET` | `/api/exercises` | Exercise catalog (static list) | Server |
| `GET` | `/api/activities` | Activity catalog with MET values | Server |
| `GET` | `/api/me/training-load/{date}` | Load classification, ACWR, warnings | **Server** |
| `GET` | `/api/me/training/summary/{date}` | `{ isRestDay }` | Server |
| `POST` | `/api/me/rest-day/{date}` | Mark rest day | Server |
| `DELETE` | `/api/me/rest-day/{date}` | Remove rest day | Server |
| `GET` | `/api/training-blocks/active` | Active training block + days | Server |
| `POST` | `/api/me/training/load-override/{date}` | Save user's perceived classification | Server |
| `GET` | `/api/me/weight-cut` | Fight camp countdown chip | Server |

**What is server-side vs client-side:**
- `estimatedKcal` on each session/activity: **server-computed** and stored; formula is `MET × weight(kg) × durationHours` for cardio, and `sessionRpe × durationMinutes × regionMultiplier` for lifting (multipliers: upper=1.0, full=1.1, lower=1.25)
- `totalCalories` display on the page: **client-computed** as `Σ session.estimatedKcal` (just a sum of server values)
- Day classification badge: **server-computed** via `GET /api/me/training-load/{date}` — the client only does a client-side fallback computation if the API hasn't resolved yet
- ACWR and warnings: **server-computed** — never re-derived on the client
- Planned load for date: **client-computed** from the `activeBlock.days` array — no second API call
- "Fight night countdown" chip: **server-computed** (`daysUntil` in the weight-cut response)

---

### 20.7 Add Exercise dialog

Triggered by "Add Exercise" button on any session.

- `<Dialog>` with title `"Add Exercise"` (`font-display`), description `"Search for an exercise or enter a custom name"`
- Two paths:
  1. **Catalog search** — shadcn `<Popover>` + `<Command>` (combobox), `data-testid="button-exercise-search"`. Catalog items show name + `primaryMuscle` (`text-xs text-muted-foreground`). `CommandList` is `max-h-[320px] overflow-y-auto overscroll-contain touch-pan-y`.
  2. **Custom name** — `<Input>` with `data-testid="input-custom-exercise"`
- If catalog item selected, custom name clears (and vice versa)
- "Add Exercise" submit button: full width, `data-testid="button-submit-exercise"`, disabled when neither catalog item nor custom name

---

### 20.8 Add Set dialog

- `<Dialog>` with title `"Add Set"` (`font-display`)
- 2×2 grid: Reps (required) / Weight kg / RPE (1–10, step 0.5) / Rest seconds
- `data-testid` on each: `input-reps`, `input-weight`, `input-rpe`, `input-rest`
- Submit: `data-testid="button-submit-set"`, disabled when Reps empty

---

### 20.9 Add / Edit Activity dialog

Two dialog variants sharing the same UI structure (Add = empty state, Edit = pre-populated).

**Catalog-based path:**
- Same `<Popover>` + `<Command>` combobox as exercise search
- `data-testid="button-activity-search"` / `"button-edit-activity-search"`
- Catalog items show: name + MET badge (`variant="outline" text-xs`) for cardio; `Dumbbell` icon + `"Lifting"` badge (`variant="secondary"`) for lifting entries (identified by `metValue === 0`)
- Search aliases: `"Strength Training"` / `"Weight Lifting"` respond to keywords like `"strength"`, `"weights"`, `"lifting"`, `"resistance"`

**Lifting-specific section** (shown when `isLiftingActivity` — i.e. selected catalog item has `metValue === 0`):
- Section: `p-3 rounded-lg bg-secondary/30 border border-border/30`
- Header: `text-xs font-medium text-muted-foreground` — "Session RPE method — training load = duration × RPE × region multiplier"
- Session RPE input (1–10, step 0.5), `data-testid="input-session-rpe"` / `"input-edit-session-rpe"`
- Body region `<Select>`: Upper Body (×1.0), Lower Body (×1.25), Full Body (×1.1); `data-testid="select-body-region"` / `"select-edit-body-region"`

**Custom cardio path** (shown when no catalog item selected and not lifting):
- Custom name input + Intensity select (Light/Moderate/Vigorous) + MET value input (default 5.0)
- `data-testid="input-custom-activity"`, `"input-met"`

**Always-visible fields:**
- Duration (minutes): required, `data-testid="input-activity-duration"` / `"input-edit-activity-duration"`
- Effort (RPE): optional, shown for non-lifting only, `data-testid="input-add-activity-rpe"` / `"input-edit-activity-rpe"`

---

### 20.10 Training Load Warning modal (`TrainingLoadWarningModal`)

An intercept modal that fires **after adding a set or activity** when the server detects load anomalies. It is **non-dismissable** via outside click or Escape — only the "Continue" button closes it.

The modal state is stored in a **module-level variable** `_pendingLoadWarning` (not React state) — this means it survives component re-mounts. If the user navigates away and back, the modal re-opens.

**Structure:**
```
⚠ Training Load Insight
Here's what stands out from your recent training.

[Today: N load pts]  [Baseline: N (Xd avg)]  [ACWR: X.XX]

  ⚠ Warning text 1
  ↗ Spike warning text 2

System estimate:  [Hard ▼]

Does this match how the day felt?
[Use system estimate ▼]  ← dropdown

[Continue ✓]
[📊 View 28-day load trend]
```

- Dialog: `max-w-sm w-[calc(100%-2rem)] rounded-xl p-0 gap-0 overflow-hidden`
- Metrics grid: `grid grid-cols-3 gap-2 text-center`, each cell `rounded-lg bg-secondary/20 p-2` with `text-[10px] text-muted-foreground uppercase tracking-wide` label, `text-sm font-semibold` value, `text-[10px] text-muted-foreground` unit
- Warning rows: `flex items-start gap-2 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20`; icon chosen by content: `TrendingUp text-red-400` for "spike", `TrendingUp text-orange-400` for "elevated", `AlertTriangle text-yellow-400` otherwise
- Override dropdown: options `"keep"` (Use system estimate) / `"light"` / `"moderate"` / `"hard"` / `"very_hard"`
- If override saved: `POST /api/me/training/load-override/{date}` with `{ classification: override }`; then invalidates `training-load` query
- "View 28-day load trend" button does NOT close the modal — navigates but leaves `_pendingLoadWarning` intact so modal re-opens on return
- `data-testid` on key elements: `modal-load-warning`, `select-load-override`, `button-load-acknowledge`, `button-view-load-trend`

**Classification colour mapping:**

| Value | Badge classes |
|---|---|
| `light` | `bg-green-500/20 text-green-400 border-green-500/30` |
| `moderate` | `bg-yellow-500/20 text-yellow-400 border-yellow-500/30` |
| `hard` | `bg-orange-500/20 text-orange-400 border-orange-500/30` |
| `very_hard` | `bg-red-500/20 text-red-400 border-red-500/30` |

---

### 20.11 Training Block modal (`TrainingBlockModal`)

Multi-step modal for planning a weekly training block across N weeks. Full documentation is in `replit.md` §Core Features. Key UI notes:
- Opened by the "Plan Block / Edit Block" header button
- Computes projected ACWR via `POST /api/training-blocks/preview`
- Forces user to acknowledge if `acwr > 1.5` (overtraining risk) before saving
- Persists via `POST /api/training-blocks` creating `training_blocks` + `training_block_days` rows
- On success: fires `"Training block saved"` toast with description `"{name} is active — sessions created for each week."`

---

### 20.12 Disclaimer card (bottom of page)

- `<Card className="bg-muted/50">`, `p-4`
- `AlertTriangle h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground`
- Title: `"Disclaimer"` (`font-medium`)
- Text: calorie estimate disclaimer, `text-sm text-muted-foreground`

---

### 20.13 Toasts fired from training page

See §19.6 for the complete training toast reference. Summary:

| Action | Toast title |
|---|---|
| Session created | `"Session created"` |
| Session deleted | `"Session deleted"` |
| Exercise added | `"Exercise added"` |
| Set added | `"Set added"` |
| Activity added | `"Activity added"` |
| Activity updated | `"Activity updated"` |
| Rest day marked | `"Rest day marked"` |
| Rest day removed | `"Rest day removed"` |
| Training block saved | `"Training block saved"` |

All are variant `default`, no description except the training block toast.

---

## 21. Supplements Page — Full Element-by-Element Breakdown

**Route:** `/supplements` | **File:** `client/src/pages/supplements.tsx` (626 lines)

---

### 21.1 Page header

```
My Supplements                          [+ Add Supplement]
Track your personal supplement inventory
```

- `flex items-center justify-between pb-4 border-b`
- Title: `text-2xl font-display font-bold`
- Subtitle: `text-muted-foreground`
- "Add Supplement" button: primary (filled), `data-testid="button-add-supplement"`, `Plus h-4 w-4 mr-2`

---

### 21.2 Catalog error banner (conditional)

Only shown if the supplement catalog API call fails.

- `<Card className="border-destructive/50 bg-destructive/5">`, `p-4`
- `AlertTriangle h-5 w-5 text-destructive flex-shrink-0 mt-0.5`
- Title: `"Catalog Load Error"` (`font-medium text-destructive`)
- Body: `"Failed to load the supplement catalog. You can still add custom supplements."` + optional error message (`text-xs mt-1`)

**API:** `GET /api/supplement-catalog` (static reference data, `staleTime: 5 min`, `retry: 2`)

---

### 21.3 "How Supplements work" explainer

- `rounded-lg border border-border/40 bg-secondary/20 px-4 py-3 space-y-2`
- `data-testid="supplements-explainer"`
- Title: `text-xs font-semibold text-foreground` — `"How Supplements work"`
- Body: ordered list, `text-xs text-muted-foreground space-y-1 list-decimal list-inside`
  1. Add a supplement once (name, dose).
  2. Set an optional daily reminder time for each supplement.
  3. Scheduled supplements appear on the Dashboard — tick off as you take them.

---

### 21.4 Supplement list card

- Standard `<Card>` with `<CardHeader>` / `<CardContent>`
- CardTitle: `"Your Supplements"`
- CardDescription: dynamic — `"No supplements added yet. Add your first supplement to get started."` (0 items) or `"{N} supplement(s) in your inventory"` (N > 0)

**Loading state:** two `<Skeleton className="h-16 w-full">` stacked with `space-y-3`

**Empty state:**
- `text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg`
- `Pill h-12 w-12 mx-auto mb-3 opacity-50`
- Text: `"No supplements yet"` + `"Click 'Add Supplement' to get started"` (`text-sm`)

**Each supplement row** (animated via `AnimatePresence`):
- Wrapper: `motion.div` — `initial={{ opacity: 0, y: 10 }}` / `animate={{ opacity: 1, y: 0 }}` / `exit={{ opacity: 0, x: -20 }}`
- Container: `flex items-center justify-between p-4 rounded-lg border bg-secondary/30 group`
- `data-testid="supplement-item-{id}"`

**Left section (supplement info):**
- Name line: `font-medium`
- Inline badges (next to name):
  - Dose: `variant="outline" text-[10px]` — `"{doseAmount} {doseUnit}"` (only when both set)
  - Form: `variant="secondary" text-[10px] capitalize` — e.g. `"capsule"` (only when set)
  - AMQS tracked: `variant="default" text-[10px]` — `"AMQS tracked"` (only when `catalogId` is set, i.e. mapped to catalog)
- AMQS sub-label: `text-xs text-muted-foreground/60 mt-0.5` — `"Contributing to your AMQS score"` (only when `catalogId` set)
- Reminder line: `text-xs text-primary/70 mt-0.5` — `"⏰ Daily reminder at {reminderTime}"` (only when `reminderEnabled && reminderTime`)
- Brand: `text-sm text-muted-foreground` (only when set)
- Notes: `text-xs mt-1 italic text-muted-foreground` (only when set)

**Right section (action buttons):**
- Both `size="icon" variant="ghost"`
- On desktop: `opacity-0 group-hover:opacity-100 transition-opacity`; on mobile: always `opacity-100`
- Edit: `Pencil h-4 w-4`, `data-testid="button-edit-supplement-{id}"` — opens Edit dialog
- Delete: `Trash2 h-4 w-4 text-destructive hover:text-destructive`, `data-testid="button-delete-supplement-{id}"` — immediate delete (no confirm)

**Data source:** `GET /api/me/supplements` (`cache: "no-store"`, no stale time)

---

### 21.5 API endpoints consumed by supplements page

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/me/supplements` | User's supplement list |
| `POST` | `/api/supplements` | Create supplement |
| `PATCH` | `/api/supplements/{id}` | Update supplement |
| `DELETE` | `/api/supplements/{id}` | Delete supplement |
| `GET` | `/api/supplement-catalog` | Reference catalog (with micronutrient data) |

**What is server-side vs client-side:**
- All AMQS calculations: **server-side** — the client never reads micronutrient data from the catalog directly; it only reads `catalogId` to know whether to show the "AMQS tracked" badge
- Reminder time: **stored as a plain string** (`HH:MM`) in the database; no server-side scheduling — the `use-reminder-engine` hook on the client does the matching

**After any create/update/delete:** invalidates `me/supplements`, `me/stacks/scheduled`, `me/amqs/score`, and `me/amqs/score-range`.

---

### 21.6 Add / Edit Supplement dialogs

Both dialogs share the same field set. Dialog title uses `font-display`.

**Fields:**

| Field | Component | Notes |
|---|---|---|
| Catalog selector | `<Select>` `data-testid="select-catalog"` | First option: `"Custom Supplement"`; then catalog items. Selecting a catalog item auto-fills Name and Dose Unit. |
| Catalog info tooltip | `Info h-3 w-3` in `bg-secondary/50 p-2 rounded` | Shows `selectedCatalogItem.notes` or `"This supplement's micronutrients will be tracked for AMQS."` |
| Supplement Name * | `<Input>` `data-testid="input-supplement-name"` | Required |
| Dose Amount | `<Input type="number" step="any">` `data-testid="input-dose-amount"` | — |
| Dose Unit | `<Select>` `data-testid="select-dose-unit"` | Options: mcg / mg / g / IU / ml / serving / CFU |
| Brand | `<Input>` `data-testid="input-supplement-brand"` | Optional |
| Form | `<Select>` `data-testid="select-supplement-form"` | Options (capitalize): pill / capsule / powder / liquid / tablet / softgel / gummy / other |
| Notes | `<Textarea className="resize-none">` `data-testid="input-supplement-notes"` | Optional |
| Daily Reminder toggle | Custom `<button role="switch">` `data-testid="toggle-reminder-enabled"` | `h-5 w-9 rounded-full`; active: `bg-primary`; inactive: `bg-secondary`; thumb: `h-3.5 w-3.5 rounded-full bg-white` with `translate-x-4` (on) or `translate-x-1` (off) |
| Reminder time | `<Input type="time">` `data-testid="input-reminder-time"` | Only shown when reminder enabled; default `"08:00"` |

**Dose / brand grid:** `grid grid-cols-2 gap-3`

**Submit button:**
- Add: `"Add Supplement"` / `"Adding..."` when pending; `data-testid="button-save-supplement"`; disabled when name empty
- Edit form: same pattern (no testid shown in code but structure identical)

---

### 21.7 Disclaimer footer

- `text-xs text-muted-foreground/50 italic text-center pb-4`
- Text: `"For tracking purposes only — not medical advice. Consult a healthcare professional before starting any supplement regimen."`

---

### 21.8 Toasts fired from supplements page

See §19.7 for full reference. Summary:

| Action | Toast title |
|---|---|
| Supplement added | `"Supplement added"` |
| Supplement updated | `"Supplement updated"` |
| Supplement deleted | `"Supplement deleted"` |

All variant `default`, no description.

---

## 22. Playbook Page — Full Element-by-Element Breakdown

**Route:** `/playbook` | **File:** `client/src/pages/playbook.tsx` (121 lines)

The Playbook is a **fully static page** — no API calls, no queries, no mutations. All content is hardcoded. No toasts are fired.

---

### 22.1 Page header (centred)

```
The Playbook
Core principles for sustainable fat loss and health. No fluff, just science.
```

- Container: `text-center space-y-4`
- Title: `text-4xl font-display font-bold` (Space Grotesk, 36px+)
- Subtitle: `text-lg text-muted-foreground`

---

### 22.2 Content grid

- `div className="grid gap-6"` — single column, full-width cards, `gap-6` between them
- Max width of page: `max-w-3xl mx-auto space-y-8` (wider than other pages — 768px vs 672px on supplements/profile)

---

### 22.3 Card 1 — "Energy Balance is King"

- **Accent border card** — `border-l-4 border-l-accent` (orange left border, the only card on the page with this treatment)
- CardHeader: `flex flex-row items-center gap-4 pb-2`
- Icon container: `p-2 bg-accent/10 rounded-lg` with `Target h-6 w-6 text-accent`
- CardTitle: `text-xl` — `"Energy Balance is King"`
- CardContent: `text-muted-foreground` — plain text, one paragraph

---

### 22.4 Card 2 — "Macronutrients Matter" (with accordion)

- Standard `<Card>` (no accent border)
- CardHeader icon container: `p-2 bg-secondary rounded-lg` with `Utensils h-6 w-6 text-foreground`
- CardTitle: `"Macronutrients Matter"`
- CardContent contains a shadcn `<Accordion type="single" collapsible className="w-full">` with three items:

| AccordionItem value | Trigger text | Content summary |
|---|---|---|
| `"protein"` | `"Protein (The Builder)"` | 1.6–2.2 g/kg lean body mass, muscle retention, high satiety |
| `"fats"` | `"Fats (The Hormonal Regulator)"` | Hormone production, min 0.6 g/kg, healthy sources |
| `"carbs"` | `"Carbohydrates (The Fuel)"` | Preferred energy source, adjust by activity level |

- `AccordionContent className="text-muted-foreground"` (all three)
- The accordion is collapsible (one open at a time); none open by default

---

### 22.5 Card 3 — "Weight Fluctuations"

- Standard `<Card>`
- CardHeader icon: `Scale h-6 w-6 text-foreground` in `p-2 bg-secondary rounded-lg`
- CardTitle: `"Weight Fluctuations"`
- CardContent: `text-muted-foreground space-y-4`
  - Opening paragraph (daily fluctuation explanation)
  - `<ul className="list-disc pl-5 space-y-1">` with 3 bullet points:
    1. Weigh daily under the same conditions
    2. Focus on the **weekly average** trend (the word "weekly average" is wrapped in `<strong>`)
    3. If trend flat for 2+ weeks, slightly lower calories

---

### 22.6 Card 4 — "Actionable Habits"

- Standard `<Card>`
- CardHeader icon: `Lightbulb h-6 w-6 text-foreground` in `p-2 bg-secondary rounded-lg`
- CardTitle: `"Actionable Habits"`
- CardContent: `space-y-4` with three numbered habits

Each habit row: `flex gap-4`
- Number: `font-mono text-xl font-bold text-accent` — `"01"`, `"02"`, `"03"`
- Content div: habit name (`font-semibold`) + description (`text-sm text-muted-foreground`)

| # | Habit | Description |
|---|---|---|
| 01 | Track Accurately | Guesstimating underestimates intake 30–50%. Use a food scale. |
| 02 | Prioritize Sleep | Poor sleep increases ghrelin, decreases leptin. |
| 03 | Walk More | NEAT burns more than gym sessions for most. Aim 8–10k steps. |

---

### 22.7 Disclaimer footer

- `text-center text-xs text-muted-foreground py-8`
- Text: `"Disclaimer: This information is for educational purposes only and does not constitute medical advice. Consult a healthcare professional before starting any diet or exercise program."`

---

### 22.8 Mobile replication notes

- No API integration required — the Playbook is a fully static informational page.
- The accordion (`type="single" collapsible`) means tapping a trigger opens that item and closes any other open item. Replicate with your mobile accordion/expandable component.
- The `border-l-4 border-l-accent` on Card 1 is the only design differentiator — all other cards use the same surface. Preserve this visual hierarchy.
- The `max-w-3xl` container is intentionally wider than other pages — it's a reading-heavy page, so wider text columns are appropriate.

---

## 23. Profile Page — Full Element-by-Element Breakdown

**Route:** `/profile` | **File:** `client/src/pages/profile.tsx` (757 lines)

---

### 23.1 Page layout

- `max-w-2xl mx-auto space-y-6` — same max-width as supplements
- Page is a vertical stack of cards with `space-y-6` between them

---

### 23.2 Profile header (avatar + username + meta)

```
[avatar photo or icon]   username  ✏
                         Amateur • fat_loss
                         [Amateur Boxer badge]  [Fight Camp badge]
```

- Outer row: `flex items-center gap-4 pb-4 border-b`

**Avatar:**
- Container: `relative` wrapping a `h-20 w-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden`
- When `user.profilePhotoUrl` set: `<img src={url} alt="Profile" className="h-full w-full object-cover">`, `data-testid="img-profile-photo"`
- When not set: `<UserCircle className="h-12 w-12 text-muted-foreground" />`
- Upload button: `<ObjectUploader>` rendered as a camera button absolutely positioned `bottom-0 right-0` on the avatar — `Camera h-3.5 w-3.5`, `rounded-full`

**Photo upload flow:**
1. `POST /api/uploads/request-url` with `{ name, size, contentType }` → `{ uploadURL, objectPath }` (presigned PUT URL to object storage)
2. `ObjectUploader` (Uppy-based) does a direct `PUT` to `uploadURL` with the file
3. `PUT /api/me/profile-photo` with `{ photoUrl: objectPath }` to save the path on the user record
4. Invalidates `USER_ME_QUERY_KEY` to refresh the avatar

**Username area:**

*Display state:*
- `h1 className="text-2xl font-display font-bold"` — Space Grotesk
- Edit button: `variant="ghost" size="icon"`, `Pencil h-3 w-3`, `data-testid="button-edit-username"`

*Edit state (`isEditingUsername = true`):*
- `flex gap-2` row: `<Input>` + "Save" button + "Cancel" button
- `data-testid="input-new-username"`, `"button-save-username"`, `"button-cancel-username"`
- Live validation via `useUsernameValidation` hook (debounced, checks `/api/me/username/available`):
  - Checking: `Loader2 h-3 w-3 animate-spin` + `"Checking availability..."` (`text-xs text-muted-foreground`)
  - Available: `Check h-3 w-3 text-green-500` + `"Username available"`, `data-testid="text-username-available"`
  - Taken/invalid: `XIcon h-3 w-3 text-destructive` + error message, `data-testid="text-username-error"`
  - Server error: `text-xs text-destructive`, `data-testid="text-username-server-error"`
- Save action: `PATCH /api/me/username` with `{ username }` → on success: clears all query cache, stores new username in `localStorage`, fires `"Username updated"` toast, navigates to `/login?username={newName}`

**Sub-line badges:**
- `flex items-center gap-2 flex-wrap`
- Experience level + goal: `text-muted-foreground capitalize` — e.g. `"intermediate • fat loss"` (underscores replaced with spaces)
- Sport badge: `<SportBadge mainSport={user.mainSport} size="sm" />` (conditional, see §23.6)
- Fight Camp badge (conditional — when `weightCutPlan.daysUntil > 0` and goal is not `"maintenance"`):
  - `data-testid="badge-fight-camp-active"`
  - `text-[11px] flex items-center gap-1 bg-orange-500/15 text-orange-400 border-orange-500/30`
  - Icon: `Swords h-3 w-3`
  - Text: `"Fight Camp"`

---

### 23.3 Current Metrics card

```
Current Metrics                               [Update Weight button]
Based on your latest update

Height          Weight
{N} cm          {N} kg

Age             Activity
{N}             sedentary / lightly active / etc.

Body Fat % (used for EA scoring)
{N}% [✏]   or   Not set (default 15%) [✏]
```

- CardTitle: `"Current Metrics"`, CardDescription: `"Based on your latest update"`
- Header row: `flex flex-row items-center justify-between gap-1 space-y-0 pb-2`
- "Update Weight" button: `<WeightUpdateDialog>` component (opens a dialog to log today's weight)
- Content grid: `grid grid-cols-2 gap-4`
- Each metric cell: `space-y-1` with `<Label className="text-muted-foreground">` + `<div className="text-lg font-medium">`
- Activity level: `capitalize`, underscores replaced with spaces

**Body fat % field** (full `col-span-2`):
- Label: `text-xs text-muted-foreground` with nested `text-muted-foreground/60` span for `"(used for EA scoring)"`
- Display value: `text-lg font-medium` — `"{N}%"` or `<span className="text-muted-foreground text-sm">Not set (default 15%)</span>`
- Edit button: `Pencil h-3.5 w-3.5`, `h-7 px-2 variant="ghost"`, `data-testid="button-edit-body-fat"`

*Edit state:*
- `<Input type="number" min=3 max=55 step=0.5 className="w-24 h-8 text-sm">`, `data-testid="input-body-fat-pct"`
- `%` suffix span
- Save: `Check h-3.5 w-3.5 text-green-400` ghost button, `data-testid="button-save-body-fat"`
- Cancel: `XIcon h-3.5 w-3.5` ghost button, `data-testid="button-cancel-body-fat"`
- Validation: `pct < 3` or `pct > 55` → destructive toast `"Enter a value between 3 and 55"`
- API: `PATCH /api/me/body-composition` with `{ bodyFatPct: pct / 100 }` (stored as a decimal, e.g. 0.15 for 15%)

---

### 23.4 Nutrition Targets card

```
Nutrition Targets
Calculated daily goals

[Calories]  [Protein]  [Carbs]  [Fat]
  2,100       185g       230g    65g
```

- CardTitle: `"Nutrition Targets"`, CardDescription: `"Calculated daily goals"`
- Content: `grid grid-cols-2 sm:grid-cols-4 gap-4`
- Each cell: `p-4 bg-secondary/50 rounded-lg text-center`
- Value: `text-xl font-bold font-mono`
- Label: `text-xs text-muted-foreground`
- **Read-only** — values sourced from `user.targetCalories`, `user.targetProtein`, `user.targetCarbs`, `user.targetFat`
- These are **server-computed** during onboarding (Mifflin-St Jeor BMR → TDEE → goal adjustment) and stored on the user record

---

### 23.5 Sport Identity card — full deep-dive

```
🛡 Sport Identity                    [✏]
Your badge shown on the dashboard and profile

[Amateur Boxer badge]          (display state)
```

- CardTitle with `ShieldCheck h-4 w-4 text-primary` icon + `"Sport Identity"`
- CardDescription: `"Your badge shown on the dashboard and profile"`
- Edit button: `variant="ghost" size="icon" h-8 px-2`, `Pencil h-3.5 w-3.5`, `data-testid="button-edit-sport"`

**Display state (when not editing):**
- If `user.mainSport` set: `<SportBadge mainSport={user.mainSport} size="md" />` (see §23.6)
- If not set: `"No sport set"` text + `"Set sport"` button (`variant="outline" h-7 text-xs`, `data-testid="button-set-sport"`)

**Edit state (when `isEditingSport = true`):**

*Level toggle row:*
- `"Competition level"` label (`text-xs text-muted-foreground`)
- Three `<button>` buttons in a `flex gap-2`: `"Amateur"`, `"Pro"`, `"Custom"`
- `data-testid="button-level-{amateur|pro|custom}"`
- Each: `flex-1 py-2 rounded-lg text-sm font-semibold border transition-all`
- Selected: `bg-primary/15 border-primary text-primary`
- Unselected: `bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/40`
- When `"Custom"` selected: shows `<Input placeholder="e.g. Semi-pro, White collar, Hobbyist…">`, `data-testid="input-custom-level"`, auto-focused

*Sport grid:*
- `"Sport"` label (`text-xs text-muted-foreground`)
- `grid grid-cols-2 gap-2`
- 7 sports: Boxing, MMA, Muay Thai, Kickboxing, BJJ, Wrestling, Traditional martial arts
- Last sport (Traditional martial arts) gets `col-span-2` when it's the odd one out (7 items in 2-column grid)

Each sport button:
- `relative overflow-hidden rounded-xl border-2 h-16 transition-all duration-150 active:scale-95`
- Background: a sport photo (from Pexels or local asset for Wrestling) fills the button via `absolute inset-0 w-full h-full object-cover`
- Dark overlay: `absolute inset-0` — `bg-black/40` when selected, `bg-black/65` when unselected
- Primary tint: `absolute inset-0 bg-primary/15` — only when selected
- Sport name: `relative z-10 font-bold text-xs text-white drop-shadow-md text-center leading-tight`
- Selected state: `border-primary ring-2 ring-primary/40` border + checkmark: `absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center` with `Check h-2.5 w-2.5 text-white`
- Unselected state: `border-transparent hover:border-primary/30`
- `data-testid="button-sport-pick-{sport-slug}"` (e.g. `"button-sport-pick-boxing"`, `"button-sport-pick-muay-thai"`)

**Sport photos:**

| Sport | Image URL |
|---|---|
| Boxing | `https://images.pexels.com/photos/6699106/pexels-photo-6699106.jpeg?auto=compress&cs=tinysrgb&w=300&h=150&fit=crop` |
| MMA | `https://images.pexels.com/photos/5616798/pexels-photo-5616798.jpeg?auto=compress&cs=tinysrgb&w=300&h=150&fit=crop` |
| Muay Thai | `https://images.pexels.com/photos/11045334/pexels-photo-11045334.jpeg?auto=compress&cs=tinysrgb&w=300&h=150&fit=crop` |
| Kickboxing | `https://images.pexels.com/photos/13808098/pexels-photo-13808098.jpeg?auto=compress&cs=tinysrgb&w=300&h=150&fit=crop` |
| BJJ | `https://images.pexels.com/photos/8611381/pexels-photo-8611381.jpeg?auto=compress&cs=tinysrgb&w=300&h=150&fit=crop` |
| Wrestling | Local asset: `wrestling_2_1780663494759.jpg` (imported via `@assets/`) |
| Traditional martial arts | `https://images.pexels.com/photos/7045666/pexels-photo-7045666.jpeg?auto=compress&cs=tinysrgb&w=300&h=150&fit=crop` |

*Live preview:*
- When sport is selected: `"Preview:"` label + `<SportBadge mainSport={buildProfileMainSport(levelPick, sportPick)} size="md" />`
- `buildProfileMainSport(level, sport)` → `"{level} {display}"`, e.g. `"Amateur Boxer"`, `"Pro MMA"`, `"Semi-pro Kickboxer"`

*Action buttons:*
- Save: `Check h-3.5 w-3.5 mr-1` icon, `data-testid="button-save-sport"`, disabled when no sport or saving; shows `Loader2 animate-spin` when pending
- Cancel: `variant="ghost"`, `data-testid="button-cancel-sport"`
- Remove badge: `variant="ghost" text-destructive hover:text-destructive ml-auto`, `data-testid="button-remove-sport"` — only shown when `user.mainSport` is currently set

**Remove badge API:** `PATCH /api/me/sport` with `{ mainSport: null }` → fires `"Sport badge removed"` toast
**Save sport API:** `PATCH /api/me/sport` with `{ mainSport: "{level} {display}" }` → fires `"Sport identity updated"` toast

---

### 23.6 SportBadge component (`client/src/components/SportBadge.tsx`)

A self-contained badge that takes `mainSport` (the combined string, e.g. `"Pro Boxer"`) and renders with a sport icon and level-appropriate colour scheme.

**Level detection** (from `mainSport` string, case-insensitive):
- Starts with `"pro "` → level = `"pro"`
- Starts with `"amateur "` → level = `"amateur"`
- Any other prefix → level = `"custom"`

**Icon detection:** The `mainSport` string is checked against a dictionary to find which sport icon to show. Matching is by `mainSport.toLowerCase().includes(sportDisplayName.toLowerCase())`.

**Icon assets** (in `attached_assets/`, imported via `@assets/`):

| Sport | Asset filename |
|---|---|
| Boxer | `boxing_1780655404872.png` |
| MMA | `mma_1780655404872.png` |
| Muay Thai | `muay-thai_1780655404877.png` |
| Kickboxer | `kickboxing_1780655404872.png` |
| BJJ | `bjj_1780655404871.png` |
| Wrestler | `wrestling_1780655404878.png` |
| Martial Artist | `traditional_1780655404877.png` |

All icons are **CSS inverted**: `filter: invert(1) brightness(2); opacity: 0.9` — making them appear white on any background.

**Icon sizes:** `h-4 w-4` (`size="sm"`), `h-5 w-5` (`size="md"`)

**Badge colour schemes by level:**

| Level | Background gradient | Border | Text |
|---|---|---|---|
| `pro` | `bg-gradient-to-r from-amber-500/25 to-yellow-400/15` | `border-amber-400/50` | `text-amber-300` |
| `custom` | `bg-gradient-to-r from-slate-400/20 to-slate-300/10` | `border-slate-300/40` | `text-slate-200` |
| `amateur` | `bg-primary/15` | `border-primary/30` | `text-primary` |

**Padding/font sizes:**
- `size="sm"`: `px-2.5 py-1 text-[11px]`
- `size="md"`: `px-3.5 py-1.5 text-xs`

All badges: `inline-flex items-center gap-1.5 rounded-full font-semibold border`

`data-testid="badge-main-sport"` on the wrapping `<span>`.

**Where the badge appears:**
1. Profile header sub-line (`size="sm"`)
2. Sport Identity card display state (`size="md"`)
3. Sport Identity card edit preview (`size="md"`)
4. Dashboard header (§17.7) — if `user.mainSport` is set

---

### 23.7 Push Notifications card

```
🔔 Push Notifications
Receive reminders for supplements and workouts on your device

[Platform-specific content]
```

- CardTitle: `Bell h-5 w-5` + `"Push Notifications"`
- CardDescription: `"Receive reminders for supplements and workouts on your device"`

Four render paths based on `push.notificationStatus`:

| Status | Shown content |
|---|---|
| `"server_disabled"` | `XCircle h-4 w-4` + `"Push notifications are not configured on the server"` |
| `"ios_safari"` | Install instructions card with `Smartphone h-5 w-5 text-primary` + Share icon inline `Share h-3 w-3 inline`, step-by-step list |
| `"unsupported_browser"` | `XCircle h-4 w-4` + `"Push notifications are not supported in this browser"` |
| Default (normal) | Toggle between enabled/disabled state, with Enable/Disable button and optional Test button |

**Normal state — disabled:**
- `BellOff h-4 w-4 text-muted-foreground` + `"Notifications disabled"`
- `"Enable Notifications"` button (primary), `data-testid="button-enable-notifications"`

**Normal state — enabled:**
- `CheckCircle h-4 w-4 text-green-500` + `"Notifications enabled"`
- `"Disable"` button (`variant="outline"`), `data-testid="button-disable-notifications"`
- `"Send Test Notification"` button (`variant="outline" size="sm"`), `data-testid="button-test-notification"` — only shown when subscribed

**Permission denied fallback:**
- `text-sm text-destructive` — `"Notifications are blocked. Please enable them in your browser settings."`

**iOS PWA note:**
- `text-xs text-muted-foreground` — `"Running as installed app on iOS."` — only when `push.isIOSDevice && push.isInstalledPWA`

**Data source:** `usePushNotifications()` hook — wraps the Web Push API (`navigator.serviceWorker`, `PushManager`). No server query — all push state is determined from browser APIs at runtime.

**Mobile note:** On native iOS/Android apps this entire card should be replaced with a native push notification permission flow (e.g. `expo-notifications`). The "ios_safari" and "unsupported_browser" paths are web-only edge cases.

---

### 23.8 Recalculate Goals button (bottom)

- `flex justify-end pt-4`
- `variant="outline"` button
- Icon: `Settings h-4 w-4 mr-2`
- Text: `"Recalculate Goals"`
- Action: navigates to `/onboarding?recalculate` — re-runs the full onboarding wizard with existing values pre-filled

---

### 23.9 API endpoints consumed by profile page

| Method | Endpoint | Purpose | Who computes |
|---|---|---|---|
| `GET` | `/api/auth/me` (via `useUser`) | User record | Server |
| `GET` | `/api/me/weight-cut` | Fight camp status / daysUntil | Server |
| `POST` | `/api/uploads/request-url` | Get presigned upload URL | Server (Replit Object Storage) |
| `PUT` | `{uploadURL}` (external) | Direct file upload to object storage | Client → Object Storage |
| `PUT` | `/api/me/profile-photo` | Save object path to user record | Server |
| `PATCH` | `/api/me/username` | Update username | Server |
| `PATCH` | `/api/me/body-composition` | Save body fat % | Server |
| `PATCH` | `/api/me/sport` | Set or clear sport identity | Server |
| `GET` | `/api/me` (via `useLogs`) | Today's weight log (for WeightUpdateDialog) | Server |

**What is server vs client-side:**
- Nutrition targets displayed (`targetCalories`, `targetProtein`, `targetCarbs`, `targetFat`): **server-computed** (Mifflin-St Jeor + TDEE + goal modifier), stored on `users` table, read-only on this page
- Body fat displayed as percentage: **client-computed** — `Math.round(user.bodyFatPct * 100)` (stored as decimal)
- Fight camp badge visibility: **client-computed** — `weightCutPlan.daysUntil > 0 && user.goal !== "maintenance"`
- Sport level detection in `SportBadge`: **client-computed** from the stored string prefix
- Username availability: **server-checked** via `GET /api/me/username/available` (debounced from `useUsernameValidation` hook)
