# EOS AI UI review — "why it reads as a template, and what to build instead"

## 1. Verdict

It reads as a competent shadcn/Tailwind starter, not as a product: every piece of content, from a OMR 418k hero number to a 4% "Frozen" category, lives in the same white 1px-bordered `rounded-xl` card with the same `shadow-sm`, so the eye has nothing to rank and the dashboard becomes eleven equal boxes plus four more equal boxes. The only colour is a flat #3a4fe0 blue applied to everything that is "important" (button, active nav, chart line, every bar, links), while the one genuinely distinctive asset, the "dawn" gradient from `BrandArt.tsx`, is hidden on the login page and reduced to a 3px nav indicator inside the app. Type is one weight step apart everywhere (14px body, 15px semibold titles, 28–32px numbers in the same Geist), spacing is uniformly generous (`max-w-6xl`, `px-10 py-9`, `p-4` cards), charts are Recharts defaults with 2px monotone lines and solid bars, and there is no narrative layer at all — no "what changed", no anomalies, no AI, no annotation — which is exactly what Linear, Attio and Mercury use to feel powerful.

## 2. Ten most damaging problems

1. **Dashboard: eleven identical KPI cards in three rows** (`dashboard-desktop-light.png`, `Dashboard.tsx` `card(key, hero)`). The `hero` flag only bumps font size; it does not change the card's size, weight or position, so Net sales (the business) and Returns (a footnote) have equal visual rank. Mercury and Stripe show one or two hero figures with a chart under them and push secondary metrics into a dense strip or a table. Here the user scrolls 400px of cards before seeing a single trend.

2. **The chart line colour, bar colour, button colour, nav colour and link colour are all the same blue.** Blue means "brand", "clickable", "this period", "net sales" and "selected" simultaneously. Vercel and Linear keep the accent for interaction only; data gets its own neutral/semantic palette (Linear's charts are mostly grey with one highlighted series). The Top-products chart is ten identical blue bars — it says nothing except "ten bars".

3. **Change badges are the only colour semantics, and they are wrong for the metric.** Discounts +20.9% and Returns +4.7% are shown in red pills, COGS +11% red, Opex +2.8% red — but Gross sales +12.5% green. The direction mapping is there in code, but it is expressed as the same pill chip shape as the "Partial" warning and the status dots, so the eye cannot tell "good news" from "data quality warning". Stripe uses a tiny arrow + coloured delta text, never pills, and reserves pills for state.

4. **Cards within cards within cards.** `Card` → `CardHeader` (border-b) → `CardContent` → `CardFooter` (border-t, `bg-subtle/60`) with a "View records" link floating right in a tinted footer. Every chart card thus has three horizontal rules and a grey tray. Then the import wizard puts a card (step box) inside a card (page) with cards (count tiles) inside that, plus a bordered table. Raycast and Attio use at most one container level; everything else is separated by spacing or a single hairline.

5. **Type scale has no display register.** `index.css` has no size tokens above the Tailwind defaults; hero numbers are `text-[1.75rem] sm:text-[2rem] font-semibold` in the same Geist as the body, with the currency code shrunk to 12–14px muted text beside them. The 48,475 transactions figure looks identical in weight to the receipt-number cell in Sales records. There is no mono for receipt numbers, SKUs or branch codes (`R148212`, `SKU-0050`, `EOS-01` are all set in proportional Geist with `tabular-nums`). Linear/Vercel use a proper display size (36–48px, tight tracking, 500–600 weight) and mono for identifiers.

6. **Dark mode is light mode inverted, with the same chart.** `--surface: #14171c` vs `--canvas: #0e1014` is a 6-value difference, so cards barely separate; the blue line becomes #6b78f0 lavender; the net-sales area fill is a near-invisible wash. Vercel/Linear dark uses layered surfaces (base → raised → overlay) with a 1px `rgba(255,255,255,.06–.1)` inner stroke and higher-chroma data colours (`#7c86ff`-type) so lines read. Here the dark dashboard is a sea of flat charcoal rectangles.

7. **Charts are library defaults.** `Charts.tsx`: `type="monotone"` 2px lines, 4-dash previous period, full-width horizontal grid, no end-point value labels, no annotation of max/min or the current month, `Bar radius={[0,4,4,0]}` rounded-end bars, a per-category progress bar list where the fill is 2–20% of the track so bars are visually ~4px. The y-axis shows "60K" when the max is 42K, wasting 30% of the plot. Stripe's line charts: 1.5px, no horizontal grid or 2–3 faint ticks, dot + label on the last point, comparison as a lighter solid line not dashed, hover reveals a vertical rule + compact tooltip with delta.

8. **Filter bar is three detached pill buttons and a toggle floating to the far right** (`FilterBar.tsx`, visible on dashboard and records). "Compare with previous period" with a large iOS switch, 700px away from the date range it modifies, is the single biggest "admin template" tell on the page. Linear/Attio filter bars are a segmented control (7D / 30D / 90D / 12M / Custom) + compact chips with × to remove, all on one 32px line, with the comparison as a chip ("vs. previous period") attached to the range.

9. **Sidebar and top bar are a stock shell.** Sidebar: white active row with shadow + 3px gradient bar + ring, items at `min-h-9`, a `Soon` outline pill on disabled items, a full-width "Collapse sidebar" footer button with icon + label. Top bar: 56px, breadcrumb text left, 256px search box, theme toggle, avatar. Nothing in the shell indicates an org, a live import, an alert count, or the AI. Linear's sidebar is 220px, 28px rows, no active-shadow, keyboard hints, and its top area is used for context (team, filters), not a repeated page title ("Overview" appears three times on one screen: breadcrumb, h1, nav).

10. **Login brand art is on the wrong side of the door, and the brand dies at the threshold.** `BrandArt.tsx` is nicely built (SVG, themed, concentric dawn arcs) but it shows a dusky purple sky with a sunset-orange glow on a product named after dawn, the headline card is a translucent grey band pasted over the bottom, and once logged in the gradient appears only as a 3px nav sliver and a progress bar in the import wizard. Vercel/Raycast carry one signature material (grain, glow, grid) consistently from marketing into the app's empty states, loading states and AI surfaces.

Honourable mentions: `View records` text links in every footer instead of making the title/row clickable; "Partial" pill plus an `ⓘ` plus a popover is three affordances for one thing; the Members mobile page's `Invite member` button is as tall as a row; the import "Recommended order" list uses numbered circles even for completed steps (ticks for 1–2, numbers for 3–9, mixed).

## 3. Design direction for the rebuild

### Concept: "Ledger at first light"
EOS is a ledger for people who run shops: it should feel like a precise financial instrument (Mercury's calm, Stripe's typographic discipline) lit by a single warm source (the dawn). Everything is neutral, hairline and dense; colour appears exactly twice — a cool ink-blue for interaction, and a restrained warm "dawn" glow reserved for the AI and for the one insight the system wants you to notice. Numbers are the hero; cards are not.

### Palette

Light:
- Canvas `#F6F6F4` (warm paper-grey, not Tailwind slate), Surface `#FFFFFF`, Surface-2 `#F1F1EE` (table headers, inset wells), Overlay `#FFFFFF` + shadow.
- Hairline `#E6E6E2`, Hairline-strong `#D2D2CC`.
- Ink `#111210`, Ink-2 `#4A4C47`, Muted `#777A73`.
- Accent (interaction only) `#2E4BD8`, hover `#2740BE`, soft `#EAEDFB`.
- Dawn (AI + insight only): gradient `#F5A05A → #E0577A → #7A5AF0`; used as 1px border-glow, icon fill, and a 2px top rule — never as a button fill.
- Positive `#1B7F5B` / soft `#E5F3EC`; Negative `#C4392F` / soft `#FBEBE9`; Caution `#9A5B00` / soft `#FBF1DF`.
- Data: primary series `#2E4BD8`, comparison `#B8BBC4` (solid, lighter), secondary series `#0E8F86` (teal, not green — green is reserved for "good"), highlight `#E0577A`.

Dark (layered, not inverted):
- Canvas `#0C0D10`, Surface `#141519`, Surface-2 `#1B1D22`, Overlay `#22242A`; every raised surface gets `box-shadow: inset 0 0 0 1px rgba(255,255,255,.06)`.
- Hairline `rgba(255,255,255,.08)`, strong `.14`.
- Ink `#ECECE8`, Ink-2 `#B5B7B0`, Muted `#7E8079`.
- Accent `#7D8CFF` (text/links), fill `#3D56E6`; Data primary `#8A96FF`, comparison `#4B4E57`, teal `#3FC2B5`, highlight `#F27A97`; Positive `#4FD39C`, Negative `#FF7B72`.

### Type
Keep Geist for UI; add **Geist Mono** for identifiers and axis ticks. Scale (rem/px, weight, tracking):
- Display number: 40/44, 500, −0.02em, `font-variant-numeric: tabular-nums`; currency code 13px 500 muted set on the baseline.
- Section number (secondary KPIs): 22/28, 500, −0.015em.
- H1 page title: 20/28, 600, −0.01em (not 28px; the page title is not the hero, the number is).
- H2 card title: 14/20, 600.
- Body: 13/20, 400 (drop from 14; this is a dense tool).
- Caption/axis: 11.5/16, 400, Muted.
- Mono (receipt no, SKU, branch code, dates in tables): 12.5/20, 450.
- Deltas: 12/16, 600, coloured text with ▲▼ glyph, no pill.

### Spacing and density
4px base; row heights 32px (tables), 28px (nav), 36px (inputs). Page gutter 24px, max content width 1280px (not 1152) with charts allowed to span full width. Card padding 16px; gap between cards 12px. Vertical rhythm: 32px between page sections, 8px between a label and its value. Sidebar 224px; collapsed 56px.

### Border, shadow, elevation
Three levels only. **Flat**: hairline border, no shadow (all in-page cards). **Raised**: `0 1px 2px rgba(0,0,0,.04), 0 0 0 1px hairline` (popovers, dropdown). **Floating**: `0 16px 40px -12px rgba(0,0,0,.25)` + hairline (dialogs, sheet, palette). Radii: 6px controls, 8px cards, 12px dialogs; never 14px+. Remove `CardFooter` tinting entirely.

### Chart rules
Line 1.5px, `type="linear"` or gentle `natural`, no area fill except a 6% gradient under the hero line. Comparison period: solid 1.25px in Comparison grey, not dashed. Grid: 3 horizontal hairlines max, no axis line, ticks in mono 11.5px; y-domain = nice(max × 1.1), never a fixed 60K. Last point gets a 4px dot and an inline value label; max/min annotated with small text when the card is ≥ 560px wide. Hover: vertical rule + 1px dot, tooltip is a 8px-radius Overlay with title, two rows and a delta. Bars: 0 radius, 60% band width, highlight the selected/top bar in Accent and the rest in Comparison grey — so "which one matters" is the first thing read. Category and product lists become a compact table with a proportional bar *behind* the number cell (Attio style), not a progress track. Good/bad colour applies only to deltas, never to series.

### Dashboard layout as a story
```
[Filter strip: 7D 30D 90D 12M Custom | vs. prev ⌄ | All branches ⌄        Updated 42m ago · 2 partial]
[AI insight strip (dawn hairline): "Net sales up 12.5%; EOS-02 drove 60% of the gain. Discounts rose faster (+21%) — margin flat." ... Ask →]
[HERO  Net sales OMR 418,364.517 ▲12.5%          ][ What changed (vs prev)           ]
[  12-month line, prev period grey, last pt label ][ Gross profit   +15.2%  ▲ 20.4k   ]
[                                                 ][ Discounts      +20.9%  ▼ 2.2k    ]
[                                                 ][ Returns        +4.7%   ▼ 0.2k    ]
[                                                 ][ Avg ticket     +2.4%             ]
[Secondary KPI strip: Gross profit · Transactions · Avg ticket · Opex · Inventory  (22px nums, sparklines, one row)]
[Anomalies / needs attention: "EOS-03 Sat 18 Oct −38% vs typical" · "COGS partial: 6.3% of sales missing unit cost → fix"]
[Branches table (bar-behind-number)   ][ Categories table ]
[Top products table, toggle net/profit, bar-behind-number]
```
One hero, one narrative column, one strip of smalls, one attention row, then detail. Scroll depth halves.

### AI as integral
Not a page. Three surfaces: (1) the insight strip at the top of every analytics page, generated from the same verified KPIs, with "why?" expanding inline; (2) `⌘K` becomes ask-or-jump — typing a question routes to the assistant, answers render as a floating panel docked right (the same sheet component as the receipt), with every number chip clickable to the records that produced it (your ADR 0004 verifier makes this a feature: show the check mark); (3) each KPI card's details popover gets an "Explain this" action. The dawn gradient belongs to these three surfaces only — that is how the user learns "warm glow = EOS is speaking".

## 4. Component specs

**KPI card (hero and compact).** Anatomy: label (13px Ink-2) + optional status glyph (small triangle for partial, not a pill) → value (display/section size, currency code 13px muted on the baseline) → delta line (▲12.5% in Positive text + "vs 372,1k" muted) → sparkline (hero: full chart; compact: 56×20px 1.25px line, Comparison grey with last 1/4 in Accent). States: loading (value replaced by 22×... shimmer, no sparkline), partial (status glyph + coverage % in details), no comparison ("no earlier period" as caption, no delta), null ("—" + reason). Whole card is a link; hover = Hairline-strong border only, no lift.

**Chart card.** 14px title + 12px muted scope ("by month") on one line, legend inline right as 8px swatch + 12px label, overflow menu (⋯) for table view/CSV. No footer: the title is the link to records. Padding 16, chart bleeds to 12px from edges. Min height 280 (hero 320).

**Filter bar.** Single 36px row: segmented period control (7D/30D/90D/12M/Custom), chip "vs previous period ×" (click to change to previous year), branch chip with count ("3 branches"), right-aligned freshness ("Data updated 42 min ago") and a quiet "2 partial" link. Sticky under the top bar with `backdrop-blur`. On phone: horizontal scroll, no wrapping.

**Sidebar.** 224px, canvas background, no border on active item: 28px rows, 13px, active = Surface-2 fill + Ink text, icon 15px. Org switcher at top as 36px row with 20px mark. Groups: Analyse (Overview, Branches, Products), Data (Imports with a live count badge when one is running), Ask EOS (with dawn dot), Settings at bottom. Collapse via `[` hotkey and a 20px icon button in the header, not a footer row. Disabled items hidden, not greyed with "Soon".

**Top bar.** 44px. Left: breadcrumb only when depth > 1. Centre: nothing. Right: `⌘K Ask or jump…` 280px input with dawn-tinted icon, notifications (import done/failed), theme, avatar 24px. No page title duplication.

**Data table.** 32px rows, 12px padding, header 11.5px Muted uppercase-free, bottom hairline only (no header fill). Mono for ids/dates/codes, right-aligned tabular numbers with currency column header ("Net, OMR") instead of per-cell "OMR". Status as 6px dot + text, no pill fill. Row hover Surface-2; selected row Accent-soft. Sticky header, column resize, virtualised. Pagination footer: "1–50 of 48,475" + ‹ › at 28px.

**Dialog/sheet.** Sheet 440px, Overlay surface, 1px hairline left edge, no backdrop blur on desktop (dim 32%). Header: title 15px 600 + mono id + status dot row, close as 28px ghost. Sections separated by 24px and 12px section labels, not bordered boxes. Line items as a table with mono SKU and right-aligned money; total row with top hairline. Dialogs: 480px, 12px radius, Floating elevation, 20px padding, actions right-aligned, primary solid Accent.

**Empty state.** Left-aligned (not centred), 60ch max: 15px title stating what is missing in user terms, one sentence, one primary action, one secondary link. In the dashboard: the hero area shows a faint dawn-tinted sparkline silhouette and "Import your first sales file to light this up". No four skeleton cards with "Awaiting data" pills.

**AI insight callout.** 1px hairline card with a 2px dawn rule on the start edge, 10px dawn icon, 13px Ink text, max 2 sentences, numbers rendered as mono chips (hover → source records, ✓ "checked against 111,977 rows"). Actions: "Why?" (expands inline), "Ask a follow-up" (opens the panel). Dismissable per-insight; never animated on load.

## 5. Keep

- The token architecture in `index.css`: separate light/dark tuning, semantic names, `@theme inline` mapping, `color-scheme`, the `.focus-field` halo. Rebuild values, not structure.
- Geist with `ss01`/`cv11`, `tabular-nums` discipline, logical properties and RTL handling throughout (`start/end`, `rtl:-scale-x-100`) — rare and correct for an Oman product.
- Motion discipline: short, purpose-bound animations with a real `prefers-reduced-motion` block.
- The data honesty: "Partial" coverage popover, "Based on / Records counted / Updated 42 min ago", "No earlier figure to compare", the import review's rows = imported + rejected + duplicate tiles and the "Worth knowing" notes. The content is already better than most benchmarks; the presentation is what undersells it.
- The ⌘K palette structure (Go to / Actions, keyboard hint footer) — extend it into Ask.
- `BrandArt.tsx`'s construction (SVG, per-instance ids, themeable) — recolour it toward an actual dawn and reuse the arc motif at small scale for the AI surfaces.
- The wizard's three-step logic and the error-rows table with row/column/problem — just flatten the nesting and switch ids to mono.
