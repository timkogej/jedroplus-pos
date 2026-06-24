# Jedro+ POS — Design Handoff Document

**Application:** Jedro+ Davčna Blagajna (Slovenian Tax-Compliant POS & Invoice System)  
**Stack:** Next.js 14.2.35 · React 18 · Tailwind CSS 3.4.1 · Framer Motion 12.38.0 · Supabase  
**Document date:** 2026-05-09

---

## 1. DESIGN SYSTEM

### 1.1 Color Palette

#### Brand Colors
| Name | Hex | Usage |
|------|-----|-------|
| Brand Purple | `#6D5EF7` | Primary actions, links, active states, gradient start |
| Brand Blue | `#2F80ED` | Gradient mid, FURS header accent |
| Brand Teal | `#2AD4C5` | Gradient end |

#### Gradient Definitions
```css
/* Primary gradient — used on buttons, sidebar active item, logo icon, upload dragging border */
background: linear-gradient(135deg, #6D5EF7, #2F80ED, #2AD4C5);

/* Subtle gradient banner — used on dashboard quick action strip */
background: linear-gradient(to right, #6D5EF7/10, #2F80ED/10, #2AD4C5/10);

/* gradient-text utility — used on hero text or highlights */
background: linear-gradient(135deg, #6D5EF7, #2AD4C5);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

CSS custom properties defined in `:root` (globals.css):
```css
--gradient-start: #6D5EF7;
--gradient-mid:   #2F80ED;
--gradient-end:   #2AD4C5;
```

#### Background & Surface
| Name | Hex / Tailwind token | Usage |
|------|----------------------|-------|
| Page background | `#f8f9fc` / `bg-gray-50` | `<body>` and all page wrappers |
| Surface (cards) | `#ffffff` / `bg-white` | All Card, Modal, Input backgrounds |
| Subtle surface | `#f9fafb` / `bg-gray-50` | Hover rows, table headers, code blocks |
| Glass overlay | `rgba(255,255,255,0.8)` + `backdrop-blur(12px)` | `.glass` utility class |

#### Text Hierarchy
| Role | Hex / Tailwind token |
|------|----------------------|
| Primary text | `#111827` / `text-gray-900` |
| Secondary text | `#374151` / `text-gray-700` |
| Body / supporting | `#4b5563` / `text-gray-600` |
| Meta / captions | `#6b7280` / `text-gray-500` |
| Disabled / placeholder | `#9ca3af` / `text-gray-400` |
| Monospace accent (invoice numbers) | `#6D5EF7` / `text-[#6D5EF7]` |

#### Semantic Colors
| State | Background | Text | Border |
|-------|-----------|------|--------|
| Success | `bg-green-50` `#f0fdf4` | `text-green-700` `#15803d` | `border-green-200` `#bbf7d0` |
| Warning | `bg-amber-50` `#fffbeb` | `text-amber-700` `#b45309` | `border-amber-200` `#fde68a` |
| Error | `bg-red-50` `#fef2f2` | `text-red-700` / `text-red-600` | `border-red-200` `#fecaca` |
| Info | `bg-blue-50` `#eff6ff` | `text-blue-700` | `border-blue-200` |
| Neutral | `bg-gray-50` | `text-gray-600` | `border-gray-200` |

#### Status Dot Colors (live indicator, inline in tables)
| Status | Color |
|--------|-------|
| Confirmed / Online | `bg-green-400` `#4ade80` |
| Pending / Unknown | `bg-amber-400` `#fbbf24` |
| Cancelled / Offline | `bg-red-400` `#f87171` |

#### Border Colors
| Usage | Value |
|-------|-------|
| Default card/input border | `border-gray-100` `#f3f4f6` — cards; `border-gray-200` `#e5e7eb` — inputs |
| Dividers | `divide-gray-50` `#f9fafb` |
| Active input | `border-[#6D5EF7]` |

---

### 1.2 Typography

**Font family:** Inter (loaded via `next/font/google`, subset: latin)  
**Rendering:** `antialiased` applied globally on `<body>`  
**No dark mode** currently implemented.

#### Type Scale in Use
| Role | Size class | Weight | Color |
|------|-----------|--------|-------|
| Page title (in header) | `text-base` (16px) | `font-semibold` (600) | `text-gray-900` |
| Login heading | `text-2xl` (24px) | `font-bold` (700) | `text-gray-900` |
| Stats value | `text-2xl` (24px) | `font-bold` (700) | `text-gray-900` |
| Card / section heading | `text-sm` (14px) | `font-semibold` (600) | `text-gray-700` |
| Table header | `text-xs` (12px) | `font-semibold` (600) | `text-gray-500` uppercase tracking-wide |
| Form label | `text-sm` (14px) | `font-medium` (500) | `text-gray-700` |
| Body / row text | `text-sm` (14px) | regular (400) | `text-gray-600` |
| Caption / meta | `text-xs` (12px) | regular (400) | `text-gray-400` or `text-gray-500` |
| Section label (uppercase) | `text-xs` (12px) | `font-medium` (500) | `text-gray-400` uppercase tracking-wide |
| Invoice number (mono) | `text-sm` (14px) | `font-medium` (500) | `text-[#6D5EF7]` font-mono |
| Error message | `text-xs` (12px) | regular (400) | `text-red-500` |
| Hint text | `text-xs` (12px) | regular (400) | `text-gray-400` |
| Footer sidebar | `text-xs` (12px) | regular (400) | `text-gray-400` |

---

### 1.3 Spacing Scale

The app uses Tailwind's default 4px base unit. Most commonly used values:

| Tailwind class | px value | Context |
|----------------|----------|---------|
| `p-3` | 12px | Nav items, small component padding |
| `p-4` | 16px | Mobile page padding, card body |
| `p-5` | 20px | Card body (desktop), settings items |
| `p-6` | 24px | Login form card body |
| `px-4 py-3` | 16px / 12px | Table rows, section headers |
| `px-3 py-2.5` | 12px / 10px | Inputs, selects |
| `px-4 py-2.5` | 16px / 10px | Medium buttons |
| `px-6 py-3` | 24px / 12px | Large buttons |
| `gap-2` | 8px | Tight element groups |
| `gap-3` | 12px | Form field grids |
| `gap-4` | 16px | Card grids |
| `space-y-6` | 24px | Between page sections |
| `space-y-3` | 12px | Between settings list items |
| `space-y-2` | 8px | Between invoice total rows |
| `mb-4` | 16px | Below section headings |
| `mt-5 pt-4` | 20px / 16px | Discount section separator |

---

### 1.4 Border Radius Values

| Class | Value | Usage |
|-------|-------|-------|
| `rounded-lg` | 8px | Minor UI elements, tags, small inputs |
| `rounded-xl` | 12px | Inputs, selects, small buttons, premise list items, upload zone |
| `rounded-2xl` | 16px | Cards, modals, stat blocks, large buttons, logo icons |
| `rounded-full` | 9999px | Badges, status dots, circular icon backgrounds |

---

### 1.5 Shadow Styles

| Class | CSS value | Usage |
|-------|-----------|-------|
| `shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Cards (default state) |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)` | Cards (hover), focused inputs |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)` | Primary buttons (default) |
| `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Primary button hover |
| `shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,0.25)` | Modals |

---

## 2. COMPONENTS INVENTORY

### 2.1 `components/ui/Button.tsx`

**Purpose:** Primary interactive element for all actions.

**Props:**
| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Controls color scheme |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Controls padding and font size |
| `loading` | `boolean` | `false` | Shows spinner, disables interaction |
| `disabled` | `boolean` | `false` | `opacity-60 cursor-not-allowed` |
| `className` | `string` | — | Passed through for overrides |
| All native button props | — | — | forwardRef |

**Visual description:**
- **primary:** Full gradient background (`#6D5EF7 → #2F80ED → #2AD4C5`), white text, `shadow-lg`. Hover: `shadow-xl scale-[1.02]`. Press: `scale-[0.98]` via Framer Motion `whileTap`.
- **secondary:** `bg-white`, `border border-gray-200`, `text-gray-700`. Hover: `bg-gray-50 border-gray-300`.
- **ghost:** No background, no border, `text-gray-600`. Hover: `bg-gray-100 text-gray-900`.
- **danger:** `bg-red-50 border border-red-200 text-red-600`. Hover: `bg-red-100 border-red-300`.

**Size specs:**
- `sm`: `px-3 py-1.5 text-sm rounded-xl`
- `md`: `px-4 py-2.5 text-sm rounded-xl`
- `lg`: `px-6 py-3 text-base rounded-xl`

**Loading state:** Left-side spinner (`w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full`), button text remains visible.

**Status:** Working

---

### 2.2 `components/ui/Input.tsx`

**Purpose:** Labeled text input with error and hint support.

**Props:**
| Prop | Type | Notes |
|------|------|-------|
| `label` | `string` | Optional label above input |
| `error` | `string` | Optional red error message below |
| `hint` | `string` | Optional gray hint below (hidden when error present) |
| `className` | `string` | Applied to the input element |
| All native input props | — | forwardRef |

**Visual description:**
- Container: `flex flex-col gap-1`
- Label: `text-sm font-medium text-gray-700`
- Input: `w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400`
- Focus: `outline-none ring-2 ring-[#6D5EF7]/30 border-[#6D5EF7]`
- Error state: `border-red-300` + red ring on focus
- Error text: `text-xs text-red-500`
- Hint text: `text-xs text-gray-400`

**Status:** Working

---

### 2.3 `components/ui/Select.tsx`

**Purpose:** Labeled dropdown selector.

**Props:**
| Prop | Type | Notes |
|------|------|-------|
| `label` | `string` | Optional label |
| `options` | `{ value: string; label: string }[]` | Options array |
| `error` | `string` | Error text |
| All native select props | — | forwardRef |

**Visual description:** Identical styling to Input (same border, radius, focus ring, padding). Select arrow is browser-native.

**Known issue:** No custom styled select arrow; relies on browser default, which creates cross-browser visual inconsistency.

**Status:** Working, but lacks a custom dropdown arrow

---

### 2.4 `components/ui/Badge.tsx`

**Purpose:** Inline status indicator chip.

**Props:**
| Prop | Type | Notes |
|------|------|-------|
| `variant` | `'success' \| 'warning' \| 'error' \| 'info' \| 'neutral'` | Color scheme |
| `children` | `ReactNode` | Badge label |

**Visual description:**
- Base: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border`
- Variants map to semantic color pairs (see §1.1 Semantic Colors table)

**Status:** Working

---

### 2.5 `components/ui/Card.tsx`

**Purpose:** Container surface for grouped content.

**Props:**
| Prop | Type | Notes |
|------|------|-------|
| `onClick` | `() => void` | Optional — adds hover cursor and shadow |
| `className` | `string` | — |
| `children` | `ReactNode` | — |

**Visual description:**
- Base: `bg-white rounded-2xl shadow-sm border border-gray-100`
- Clickable: `cursor-pointer hover:shadow-md transition-shadow`

**Status:** Working

---

### 2.6 `components/ui/Modal.tsx`

**Purpose:** Overlay dialog for confirmation, forms, and info panels.

**Props:**
| Prop | Type | Notes |
|------|------|-------|
| `isOpen` | `boolean` | Controls AnimatePresence visibility |
| `onClose` | `() => void` | Called on backdrop click or close button |
| `title` | `string` | Optional header title |
| `size` | `'sm' \| 'md' \| 'lg'` | `sm=max-w-sm`, `md=max-w-lg`, `lg=max-w-2xl` |
| `children` | `ReactNode` | Body content |

**Visual description:**
- Overlay: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm`
- Dialog: `bg-white rounded-2xl shadow-2xl w-full`
- Header (if title): `flex items-center justify-between p-5 border-b border-gray-100`
  - Title: `text-base font-semibold text-gray-900`
  - Close button: `p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600`
- Body: `p-5`

**Animations:**
- Backdrop: `opacity: 0 → 1` (`duration: 0.2`)
- Dialog: `opacity: 0, scale: 0.95, y: 10` → `opacity: 1, scale: 1, y: 0` (spring: `stiffness 300, damping 30`)

**Known issue:** ESC key does not close modal — no `useEffect` listening for `keydown`.

**Status:** Working (ESC close missing)

---

### 2.7 `components/layout/Sidebar.tsx`

**Purpose:** Primary navigation rail, desktop only (`hidden md:flex`). Fixed to the left edge; full viewport height; no collapse/expand toggle.

---

#### Layout & Dimensions

| Property | Value |
|----------|-------|
| Width | `w-56` = **224 px** |
| Height | `min-h-screen` (grows with content; sticky scroll behaviour handled by parent layout) |
| Direction | `flex flex-col` (vertical stack: Header → Nav → Footer) |
| Background | `bg-white` |
| Right border | `border-r border-gray-100` (`1px solid #f3f4f6`) |
| Visibility | `hidden` below `md` breakpoint (768 px), `flex` at `md+` |

---

#### Section 1 — Header (logo + company name)

Container: `p-5 border-b border-gray-100`

| Element | Classes / Spec |
|---------|----------------|
| Row wrapper | `flex items-center gap-3` |
| **Logo icon box** | `w-8 h-8` (32 × 32 px) · `rounded-xl` (12 px radius) · `gradient-bg` (`linear-gradient(135deg, #6D5EF7, #2F80ED, #2AD4C5)`) · `flex items-center justify-center flex-shrink-0` |
| Logo icon glyph | White `+` cross SVG · `width="16" height="16"` · `strokeWidth 3.5` · `strokeLinecap="round"` |
| Text wrapper | `min-w-0` (enables truncation in a flex child) |
| **Company name** | `text-sm font-semibold text-gray-900 truncate` · bound to `companyName` prop |
| **Subtitle** | `text-xs text-gray-400` · static string `"Davčna blagajna"` |

> The `flex-shrink-0` on the icon box prevents the gradient square from being crushed when the company name is long.

---

#### Section 2 — Navigation

Container: `flex-1 p-3 space-y-0.5`

`space-y-0.5` = **2 px vertical gap** between nav items.

**Per nav item wrapper:**
```
<Link href="...">
  <div class="relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 [state classes]">
    ...
  </div>
</Link>
```

| Property | Value |
|----------|-------|
| Item height | `py-2` = 8 px top + 8 px bottom + ~20 px line-height ≈ **~36 px** total |
| Horizontal padding | `px-3` = 12 px each side |
| Icon–label gap | `gap-3` = 12 px |
| Border radius | `rounded-lg` = 8 px |
| Font | `text-sm` (14 px) |
| Transition | `transition-all duration-150` |

**Active state** (`pathname === item.href || pathname.startsWith(item.href + '/')`):
| Property | Value |
|----------|-------|
| Background | `bg-gray-100` (`#f3f4f6`) |
| Text color | `text-gray-900` |
| Font weight | `font-medium` (500) |
| Icon color | `text-[#6D5EF7]` |
| **Active indicator bar** | `absolute left-0 top-2 bottom-2 w-0.5 bg-[#6D5EF7] rounded-r-full` |
| Bar animation | Framer Motion `layoutId="sidebar-active"` shared layout · `type: 'spring', bounce: 0.2, duration: 0.35` |

The active indicator is a **2 px (`w-0.5`) purple left bar** anchored to the left edge of the item, vertically inset 8 px from top and bottom. It slides smoothly between items via the shared layout animation — only one bar exists in the DOM at a time.

**Inactive state:**
| Property | Value |
|----------|-------|
| Text color | `text-gray-500` |
| Hover text | `hover:text-gray-900` |
| Hover background | `hover:bg-gray-50` |

**Icon wrapper:**
```tsx
<NavIcon>   {/* w-5 h-5 flex-shrink-0 */}
  <span class="[text-[#6D5EF7] when active]">
    {item.icon}   {/* inline SVG */}
  </span>
</NavIcon>
```
Icons are inline SVGs, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}`, `viewBox="0 0 24 24"`. Size is controlled by the `NavIcon` wrapper: `w-5 h-5` (20 × 20 px).

**Navigation items — in DOM order:**

| # | Label | Route | Icon path description |
|---|-------|-------|-----------------------|
| 1 | Pregled | `/{slug}/dashboard` | House outline (home) |
| 2 | Termini | `/{slug}/appointments` | Calendar with date lines |
| 3 | Računi | `/{slug}/invoices` | Document with lines |
| 4 | Nov račun | `/{slug}/invoices/new` | Plus cross `M12 4v16m8-8H4` |
| 5 | Nastavitve | `/{slug}/settings` | Gear / cog outline |

> Note: "Nov račun" active matching is intentionally broad — it also activates when `pathname` starts with `/{slug}/invoices/new/`. This means visiting `/{slug}/invoices` and `/{slug}/invoices/new` could both highlight their respective items simultaneously if not careful. The current `startsWith` logic handles this correctly because `/invoices/new` is checked before `/invoices` matches.

---

#### Section 3 — Footer (logout)

Container: `p-3 border-t border-gray-100 space-y-0.5`

Single button:

```
<button class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all duration-150">
  [arrow-right-from-door icon]  Odjava
</button>
```

| Property | Value |
|----------|-------|
| Width | `w-full` |
| Icon | Logout SVG · `w-5 h-5 flex-shrink-0` · `strokeWidth={1.8}` |
| Label | `"Odjava"` · `text-sm text-gray-500` |
| Hover | `text-gray-900 bg-gray-50` |
| Action | Calls `supabase.auth.signOut()`, clears Zustand store, redirects to `/login` |

---

#### Interaction summary

| Trigger | Behaviour |
|---------|-----------|
| Click nav item | Next.js `<Link>` navigation, no page reload |
| Active item changes | Purple left-bar indicator animates via Framer Motion `layoutId` spring |
| Hover inactive item | `bg-gray-50` fill + `text-gray-900` in 150 ms |
| Click logout | Async sign-out → store clear → push to `/login` |
| Viewport < 768 px | Entire sidebar is `display: none` — no fallback nav exists |

---

#### Known design issues

1. **No mobile equivalent** — Below `md` (768 px) the sidebar vanishes with no bottom nav or hamburger menu. Users on mobile cannot navigate between sections.
2. **Active bar covers `rounded-lg` corner** — The `absolute left-0` bar starts at the item container edge, not inset to match the `rounded-lg` (8 px) corner. On close inspection the bar clips through the rounding at the top-left and bottom-left corners.
3. **"Nov račun" is a direct link, not a POS badge variant** — The DESIGN_HANDOFF previously noted a "POS" badge on this item; no badge exists in the current implementation.
4. **No section labels / grouping** — All five nav items appear as a flat list with no group separators (e.g., "Main" vs. "Admin"). Adding a divider between Nastavitve and the others would improve scannability as the nav grows.
5. **Logout in footer, not nav** — The logout button is visually identical to nav items but lives in the footer section. A user scanning the nav list will not see it there.

**Status:** Working. No mobile nav equivalent — mobile has only a header bar without any navigation controls.

---

### 2.8 `components/layout/Header.tsx`

**Purpose:** Sticky top bar with page title, FURS status, optional action slot, and logout button.

**Props:**
| Prop | Type | Notes |
|------|------|-------|
| `title` | `string` | Page title shown in center/left |
| `action` | `ReactNode` | Optional right-side action (e.g., "+ Nov račun" button) |

**Visual description:**
- `sticky top-0 z-30 h-14 bg-white border-b border-gray-100 px-4 md:px-6`
- Left: Mobile logo (`w-8 h-8 rounded-lg gradient-bg`, hidden on `md+`) + title (`text-base font-semibold text-gray-900`)
- Center-right: 
  - FURS status pill (`hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full border border-gray-100`)
    - Status dot: `w-2 h-2 rounded-full` (green/red/amber)
    - Label: `text-xs text-gray-500`
  - Optional action slot
  - Logout: `p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50`

**Known issue:** FURS status is hidden on mobile (`hidden sm:flex`), so users on small screens have no visibility into connectivity status.

**Status:** Working

---

### 2.9 `components/invoice/InvoiceForm.tsx`

**Purpose:** Full invoice creation form — the core workflow component.

**Visual description:**

The form is composed of four styled card sections, each `bg-white rounded-2xl border border-gray-100 shadow-sm p-5`:

**Section 1 — Stranka (Client info)**
- `grid grid-cols-1 sm:grid-cols-2 gap-3`
- Fields: Ime in priimek / naziv, E-pošta, Telefon, Davčna / ID številka

**Section 2 — Podatki o računu (Invoice details)**
- `grid grid-cols-1 sm:grid-cols-3 gap-3` for Date, Payment method, Poslovni prostor
- Full-width: Naprava (device)

**Section 3 — Postavke (Line items)**
- Item row grid: `grid grid-cols-12 gap-2 items-end`
  - Description: `col-span-12 sm:col-span-5`
  - Quantity: `col-span-3 sm:col-span-2`
  - Price: `col-span-4 sm:col-span-2`
  - VAT: `col-span-4 sm:col-span-2` (select: 22%, 9.5%, 0%)
  - Remove button: `col-span-1`
- Add item: `text-sm font-medium text-[#6D5EF7] hover:underline`
- Item rows have enter animation: `initial={{ opacity: 0, y: -5 }}, animate={{ opacity: 1, y: 0 }}`

**Discount section** (within Section 3, `mt-5 pt-4 border-t border-gray-100`):
- Discount input + toggle buttons (%) or (€): `text-xs px-2 py-1 rounded-lg border`

**Notes:** `textarea` full-width, no label, `placeholder="Opomba..."`

**Section 4 — Skupaj (Totals)**
- `space-y-2` list of: Subtotal, Discount, VAT, **Grand total** (larger text, colored)
- Grand total: `text-base font-bold text-[#6D5EF7]`

**Error/warning banners** (above submit button):
- `p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600`
- `p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700`

**Submit button:** `Button size="lg" variant="primary" className="w-full"` — label changes with loading state.

**Delivery modal** (after successful FURS submission):
- Appears as a `Modal` with three options: E-pošta, Natisni, Potrdi (without delivery)
- Each option is a button styled as a full-width outlined row

**Status:** Working. Known visual issue: on mobile, the 12-column item grid collapses awkwardly — the remove button can end up on its own row.

---

### 2.10 `components/invoice/InvoicePDF.tsx`

**Purpose:** Client-side PDF render via `@react-pdf/renderer`.

**Layout (A4, 40pt padding):**
- Header: Company name (18pt bold, black) + Invoice number (14pt, `#6D5EF7`)
- Metadata block: two columns — Client info left, Payment info right; 9pt text, 7.5pt labels
- Divider line: `#e5e7eb`
- Items table:
  - Header row: `bg-#f8f9fc`, 8pt bold gray labels
  - Data rows: alternating white / `#f8f9fc`, 9pt text
  - Columns: Opis (flex:3), Kol (center flex:1), Cena (right flex:1.5), DDV% (center flex:1), Skupaj (right flex:1.5)
- Totals box: `bg-#f8f9fc`, 12pt padding, right-aligned rows
  - Grand total: 11pt bold, color `#6D5EF7`
- FURS confirmation box: `bg-#f0f7ff`, 8-10pt, blue title `#2F80ED`
  - ZOI and EOR in monospace, 7.5pt
- QR code: bottom-right, 80×80 pt, label "Preverite EOR" (7.5pt)
- Footer: 7.5pt centered gray, legal disclaimer

**Status:** Working. Visual issue: the PDF design is functional but basic — lacks logo, company branding, and visual polish compared to the web UI.

---

### 2.11 `components/invoice/AppointmentInvoiceCard.tsx`

**Purpose:** Card in the Termini page representing one appointment pending invoicing.

**Visual description:**
- Container: `bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4`
- Left column:
  - Client name: `font-semibold text-gray-900 truncate`
  - Service: `text-sm text-gray-600 truncate`
  - Date · Time · Person: `text-xs text-gray-400`
  - Already-invoiced badge (Badge component, variant="success")
- Right column:
  - Price: `font-bold text-gray-900`
  - Original price (if discount): `text-xs text-gray-400 line-through`
  - "Izstavi" button: `Button size="sm" variant="primary"` (disabled if already invoiced)

**Animation:** `initial={{ opacity: 0, y: 5 }}, animate={{ opacity: 1, y: 0 }}, transition={{ duration: 0.2 }}`

**Status:** Working

---

### 2.12 `components/settings/CertificateUpload.tsx`

**Purpose:** Drag-and-drop upload for `.p12` FURS certificate.

**Visual description:**
- Existing cert info block: `bg-green-50 border border-green-200 rounded-xl p-4` (or amber if expiring)
  - Icon, cert name, tax number, expiry date
- Upload area: `border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors`
  - Default: `border-gray-200 hover:border-gray-300 hover:bg-gray-50`
  - Drag-over: `border-[#6D5EF7] bg-[#6D5EF7]/5`
  - Icon: `w-12 h-12 bg-gray-100 rounded-xl mx-auto mb-3`
  - Title: `text-sm font-medium text-gray-700`
  - Hint: `text-xs text-gray-400 mt-1`
- Hidden file input (programmatically triggered)
- Password Input component below upload area
- Error/success messages: respective semantic background
- Security note: `text-xs text-gray-400 text-center mt-4`

**Status:** Working

---

### 2.13 `components/settings/PremisesForm.tsx`

**Purpose:** Manage business premises and electronic devices registered with FURS.

**Visual description:**

**Premises list:**
- Each item: `flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl`
  - Left: Name `text-sm font-semibold text-gray-900`, Address `text-xs text-gray-500`
  - Right: Active/inactive toggle button (`text-xs px-3 py-1 rounded-full border`)
    - Active: `bg-green-50 border-green-200 text-green-700`
    - Inactive: `bg-gray-50 border-gray-200 text-gray-500`

**Add premise form:** `p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3`
- Grid `grid-cols-2 gap-3` for Premise ID + Type
- Full width: Address, then `grid-cols-2` for City / Postal code

**Devices:** Identical structure to premises.

**Status:** Working

---

### 2.14 `components/settings/CompanySettingsForm.tsx`

**Purpose:** Edit company-level POS configuration (invoice prefix, VAT status, email settings, etc.)

**Visual description:** Form card with Input and Select components; same card styling pattern as InvoiceForm sections.

**Status:** Needs review — branding/color fields may not have a preview, making it hard to see how brand color selections apply.

---

## 3. PAGE BY PAGE BREAKDOWN

### 3.1 Login Page
**Route:** `/login`  
**Purpose:** Email + password authentication via Supabase.

**Layout:**
- Full viewport: `min-h-screen flex items-center justify-center p-4 bg-gray-50`
- Card: `w-full max-w-md`

**Key UI elements:**
- Animated logo: `w-16 h-16 rounded-2xl gradient-bg` with white Plus icon
- Title "Jedro+" (`text-2xl font-bold text-gray-900`) + subtitle "Davčna blagajna" (`text-gray-500`)
- Form card: `bg-white rounded-2xl shadow-sm border border-gray-100 p-6`
- Email + Password inputs (Input component)
- Error banner: `p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600`
- Submit: `Button variant="primary" size="lg" className="w-full"`

**Staggered entrance animation:**
- Logo: `{ opacity: 0, y: -20 } → { opacity: 1, y: 0 }`, duration 0.5
- Form: `{ opacity: 0, y: 20 } → { opacity: 1, y: 0 }`, duration 0.5, delay 0.1

**What works well:** Clean, minimal, well-animated entry experience. Good use of whitespace.

**Visual issues:**
- No "forgot password" link
- No company branding differentiation (all companies get the same login)
- Password field has no show/hide toggle

---

### 3.2 Dashboard Page
**Route:** `/[slug]/dashboard`  
**Purpose:** Overview of business metrics and recent invoices.

**Layout:**
- Header: Title "Pregled" + "+ Izstavi račun" button
- Stats row: `grid grid-cols-2 md:grid-cols-4 gap-3`
- Quick action banner
- Recent invoices table
- Setup checklist (shown until all tasks done)

**Key UI elements:**

**StatCard:**
- `bg-white rounded-2xl border border-gray-100 shadow-sm p-5`
- Label: `text-xs text-gray-400 uppercase tracking-wide font-medium`
- Value: `text-2xl font-bold text-gray-900 mt-1`
- Sub-label: `text-xs text-gray-400 mt-1`

**Quick action banner:**
- `bg-gradient-to-r from-[#6D5EF7]/10 via-[#2F80ED]/10 to-[#2AD4C5]/10 border border-[#6D5EF7]/20 rounded-2xl p-4`
- Icon + text + button

**Recent invoices:**
- Table with `divide-y divide-gray-50`
- Row: `flex items-center justify-between px-4 py-3 hover:bg-gray-50`
- Status dot: `w-2 h-2 rounded-full`
- Invoice number: `font-mono text-[#6D5EF7] font-medium`
- Date: `text-xs text-gray-400`
- Amount: `font-medium text-gray-900`

**Setup checklist:**
- Done item: `w-5 h-5 bg-green-400 border-green-400 rounded-full` with white checkmark
- Pending item: `w-5 h-5 border-2 border-gray-200 rounded-full hover:border-[#6D5EF7]`

**What works well:** Stats grid is clean. Color-coded status dots are easy to scan. Setup checklist is motivational.

**Visual issues:**
- StatCards on mobile sit 2-per-row — at very small widths the `text-2xl` values can overflow their containers
- No empty state for the recent invoices section (shows empty table structure)
- Quick action banner is visually low-contrast — the 10% opacity gradient on `bg-gray-50` is almost invisible

---

### 3.3 Invoices List Page
**Route:** `/[slug]/invoices`  
**Purpose:** Full list of all issued invoices with filtering/status.

**Layout:**
- Header: "Računi" + "+ Nov račun" button
- Full-width table card

**Table:**
- Container: `bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`
- `thead`: `border-b border-gray-100`, cells `px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide`
- `tbody`: rows `hover:bg-gray-50 border-b border-gray-50`
- Columns: Račun (invoice# link), Datum, Stranka, Znesek (right-aligned), Plačilo, Status
- Status: `Badge` component

**Empty state:**
- `py-16 text-center`
- Icon container: `w-16 h-16 bg-gray-100 rounded-2xl mx-auto`
- "Ni izstavljenih računov" `text-sm text-gray-500`
- Link to create first invoice

**What works well:** Table structure is clean, empty state is friendly.

**Visual issues:**
- Table is not responsive — on mobile it will overflow horizontally with no horizontal scroll affordance
- No search or filter UI (may be planned but absent)
- Invoice number link color (`text-[#6D5EF7]`) lacks underline on hover in the table context
- No pagination or load-more for long lists

---

### 3.4 New Invoice / Invoice Form Page
**Route:** `/[slug]/invoices/new`  
**Purpose:** Create and submit a new fiscally-confirmed invoice.

**Layout:**
- Header: "Nov račun"
- Single column `max-w-2xl mx-auto` with `space-y-4`
- Four card sections + totals card + action button

**What works well:** Clear section separation. Totals update live. Error/warning banners are prominent. Delivery modal is a clean post-submit flow.

**Visual issues:**
- Item rows on mobile: the `col-span-12` description wraps to full width, then quantity/price/vat squeeze into 3 of 12 columns. Remove button ends up alone on a narrow column — tap target is too small on mobile.
- No visual affordance that item rows are draggable/reorderable (if that feature exists)
- Discount toggle buttons (% / €) are very small (`text-xs px-2 py-1`) and close together — usability issue on touch
- Notes textarea has no label visible in the form flow — it's easy to miss
- No visual confirmation of which premise/device is selected until you open the dropdown

---

### 3.5 Appointments Page
**Route:** `/[slug]/appointments`  
**Purpose:** List appointments from external booking system, ready to be invoiced.

**Layout:**
- Header: "Termini" + button
- Groups by section: "Za izstavitev (N)" with `AppointmentInvoiceCard` list
- Already-invoiced appointments shown below in a separate group

**What works well:** Card layout is scannable. Framer Motion animations feel snappy. Price is clearly visible.

**Visual issues:**
- No date grouping (e.g., "Today", "This week") — all appointments are in one flat list
- If appointment list is long, there's no pagination or infinite scroll
- The "already invoiced" badge on a card with a disabled button may not be obvious enough — users might wonder why the button doesn't work

---

### 3.6 Settings Page
**Route:** `/[slug]/settings`  
**Purpose:** Hub for all configuration sub-sections.

**Layout:**
- Header: "Nastavitve"
- `max-w-2xl mx-auto space-y-3`
- Each setting row is a full-width clickable card

**Settings rows:**
1. Podjetje in računi (Company & invoices)
2. Prostori in naprave (Premises & devices)
3. Certifikat (FURS certificate)
4. Naročnina (Subscription/Stripe)

**Row structure:**
- `bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer`
- Icon area: `w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400` (hover: `bg-[#6D5EF7]/10 text-[#6D5EF7]`)
- Title: `font-semibold text-gray-900`
- Description: `text-sm text-gray-500`
- Chevron: `w-5 h-5 text-gray-300 ml-auto`

**What works well:** Menu-style list is clean and easy to scan. Hover reveals the brand color accent nicely.

**Visual issues:**
- No active/selected state when a sub-section is open (if settings use an accordion or modal pattern)
- Icon hover color transition is missing a CSS transition class (may be abrupt)

---

### 3.7 Certificate Settings Sub-page
**Route:** `/[slug]/settings/certificate` (or modal)  
**Purpose:** Upload and manage FURS `.p12` certificate.

See component description §2.12. Fully functional with good drag-and-drop UX.

**Visual issues:**
- The upload zone is generous in height (`p-8`) but on small screens can push the password field off-screen
- File name of uploaded certificate is not shown in the input label

---

### 3.8 Premises & Devices Sub-page
**Route:** `/[slug]/settings/premises`  
**Purpose:** Register/manage FURS premises and electronic devices.

See component description §2.13.

**Visual issues:**
- Inline "add" form uses `bg-gray-50` background — low contrast against page background (`#f8f9fc`), making the boundary unclear
- No inline delete/remove button on premise items (requires a separate action)

---

## 4. KNOWN DESIGN ISSUES

### Critical Issues

1. **No mobile navigation** — The sidebar is `hidden md:flex`. On mobile, there is no bottom navigation bar, hamburger menu, or any way to navigate between sections from the header. Users on mobile can only see the current page.

2. **Invoice form item rows break on mobile** — The `grid-cols-12` layout in InvoiceForm collapses poorly below `sm` breakpoint. The remove button (`col-span-1`) becomes a ~30px-wide tap target that is unusable on touch devices.

3. **Table overflow on mobile** — The invoices list table (`/invoices`) has no horizontal scroll wrapper. On narrow screens it will overflow and clip, hiding columns.

### Moderate Issues

4. **Quick action dashboard banner is nearly invisible** — The gradient uses 10% opacity on an already light page background. The border `border-[#6D5EF7]/20` is also very faint. The CTA is visually weak.

5. **Select component uses browser-default arrow** — The dropdown arrow is not styled, causing visual inconsistency on Chrome (grey triangle) vs. Safari (system arrow) vs. Firefox.

6. **Notes textarea has no visible label** — In InvoiceForm the textarea for "Opomba" (note) only has a placeholder. If a note is entered and the user scrolls up and back, the context is lost.

7. **ESC key does not close Modal** — No `keydown` listener is registered for the `Escape` key. Users expect this interaction.

8. **FURS status hidden on mobile** — `hidden sm:flex` hides the FURS connectivity indicator from mobile users. This is important system state information.

9. **Discount toggle buttons are too small on touch** — `text-xs px-2 py-1` produces ~28px height — below Apple's recommended 44px minimum touch target.

10. **Invoice PDF lacks company branding** — The PDF header shows only the company name as plain text. No logo, no brand color application. Compared to the polished web UI this is a significant gap.

### Minor Issues

11. **No skeleton loaders** — Pages show a spinner (`border-[#6D5EF7] border-t-transparent`) during data fetch but no skeleton screens, causing layout shift when content loads.

12. **Settings icon hover has no CSS transition** — The icon in settings rows changes from `text-gray-400` to `text-[#6D5EF7]` on hover, but no `transition-colors` is applied, making it a harsh jump.

13. **Empty state in invoices table** shows the table structure (thead) before the empty state message, adding unnecessary visual noise.

14. **Invoice number links** in the invoices table have no `:hover` underline — they look like plain text, not clickable links, except for the color.

15. **StatCard values** can overflow their containers at `text-2xl` on mobile 2-column grid if numbers are long (e.g., "1.234,56 €").

16. **Appointment cards** show date/time/person in `text-xs text-gray-400` — three different data points separated by `·` with no visual hierarchy between them.

17. **Login page** has no "forgot password" or "register" link — dead end if auth fails.

18. **Modal body padding** (`p-5`) is inconsistent with some forms that use `p-6` — minor but visible when forms open in modals.

19. **The "ZDavPR · Jedro+ POS" sidebar footer** (`text-xs text-gray-400`) is overly technical/developer-facing for end users.

20. **No print stylesheet** for the web invoice view — printing from the browser (not via the PDF) would produce an unstyled result.

---

## 5. WHAT NEEDS REDESIGN — PRIORITY LIST

### Priority 1 — Functional Blockers (Must Fix Before Launch)

**1. Mobile navigation**
- Add a bottom tab bar for mobile (`fixed bottom-0 w-full`) with icons for Pregled, Termini, Računi, Nov račun, Nastavitve
- This is the highest impact change — the app is currently non-navigable on phone

**2. Invoice form line item rows on mobile**
- Replace the `grid-cols-12` layout with a stacked card approach on mobile:
  - Description input spans full width
  - Qty + Price + VAT in a 3-column row below
  - Remove button as a small `×` icon in the top-right corner of the card

**3. Invoice list table on mobile**
- Add `overflow-x-auto` wrapper OR switch to a card-based list layout on mobile, showing only: Invoice#, Client, Amount, Status badge

### Priority 2 — High Impact UX Issues

**4. Dashboard quick action banner**
- Increase gradient opacity to at least 20–25% OR use a solid light-purple background (`bg-[#6D5EF7]/8`)
- Make the border `border-[#6D5EF7]/40`

**5. Modal ESC key support**
- Add `useEffect` with `keydown` listener in `Modal.tsx`

**6. FURS status on mobile**
- Remove `hidden sm:flex` — always show the FURS status indicator, but make it compact (dot only, no text) on mobile

**7. Notes textarea label**
- Add a proper label "Opomba (neobvezno)" above the textarea, consistent with other form fields

**8. Discount toggle tap targets**
- Increase to `px-3 py-2` minimum; ensure at least 36–40px height

### Priority 3 — Visual Polish

**9. Invoice PDF branding**
- Add company logo (if stored in settings)
- Apply brand primary color from `brand_primary` company setting to PDF header bar and totals accent
- Add a thin colored header bar (similar to the email template)

**10. Select component custom arrow**
- Replace browser-default with a custom SVG chevron icon using `appearance-none` + background-image or an icon overlay

**11. Skeleton loaders**
- Add `animate-pulse` skeleton screens for the dashboard stats grid and invoices table while data loads

**12. Settings icon hover transition**
- Add `transition-colors duration-200` to icon wrapper in settings row

**13. StatCard overflow**
- Cap value at `truncate` or reduce to `text-xl` on mobile breakpoint for long currency values

**14. Invoice link styling**
- Add `hover:underline` to invoice number links in the table

**15. Login page password field**
- Add show/hide password toggle (eye icon button inside the input)

### Priority 4 — Enhancements

**16. Appointment card date hierarchy**
- Use separate lines or stronger visual weight for date vs. time vs. staff member instead of `·` separator

**17. Empty state in invoices table**
- Hide `<thead>` when showing the empty state

**18. Sidebar footer text**
- Change "ZDavPR · Jedro+ POS" to something more user-friendly, or remove

**19. PDF invoice — add QR placement note**
- The QR code is bottom-right, but for FURS compliance, ensure it's visible above any footer cut-off when printing on A4

**20. Email template brand color**
- The email template already supports dynamic `brand_primary` — ensure the company settings form shows a live preview of the resulting email header color when editing

---

## APPENDIX: QUICK REFERENCE TOKENS

```css
/* Colors */
--brand-purple:   #6D5EF7;
--brand-blue:     #2F80ED;
--brand-teal:     #2AD4C5;
--surface:        #ffffff;
--page-bg:        #f8f9fc;
--text-primary:   #111827;
--text-secondary: #6b7280;
--border:         #e5e7eb;
--border-light:   #f3f4f6;

/* Gradient */
background: linear-gradient(135deg, #6D5EF7, #2F80ED, #2AD4C5);

/* Border radius */
--radius-sm:  8px;   /* rounded-lg  */
--radius-md:  12px;  /* rounded-xl  */
--radius-lg:  16px;  /* rounded-2xl */
--radius-full: 9999px;

/* Typography */
--font-family: 'Inter', sans-serif;

/* Shadows */
--shadow-card:       0 1px 2px 0 rgba(0,0,0,0.05);
--shadow-card-hover: 0 4px 6px -1px rgba(0,0,0,0.1);
--shadow-modal:      0 25px 50px -12px rgba(0,0,0,0.25);
```

---

*Document generated from static analysis of source code at `/Users/timkogej/Documents/Jedroplus-pos`. Last updated: 2026-05-09.*
