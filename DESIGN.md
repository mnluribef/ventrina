---
name: Ventrina SaaS
description: Plataforma SaaS multi-plantilla para catálogos digitales y pedidos directos a WhatsApp
colors:
  primary: "#c2410c"
  primary-hover: "#9a3412"
  primary-dark: "#7c2d12"
  primary-deep: "#431407"
  accent: "#d97706"
  accent-hover: "#b45309"
  whatsapp: "#059669"
  whatsapp-dark: "#047857"
  neutral-bg: "#faf7f2"
  neutral-bg-subtle: "#f5f0e8"
  neutral-bg-card: "#ffffff"
  neutral-text-heading: "#1c1917"
  neutral-text-body: "#44403c"
  neutral-text-muted: "#78716c"
  neutral-border: "rgba(28, 25, 23, 0.08)"
  neutral-border-subtle: "rgba(194, 65, 12, 0.08)"
  dark-bg: "#0c0a09"
  dark-bg-card: "rgba(28, 25, 23, 0.88)"
  dark-text-heading: "#fafaf9"
  dark-text-body: "#d6d3d1"
typography:
  display:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  caption:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  editorial:
    fontFamily: "Playfair Display, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.neutral-bg-card}"
    textColor: "{colors.neutral-text-heading}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  card-standard:
    backgroundColor: "{colors.neutral-bg-card}"
    textColor: "{colors.neutral-text-body}"
    rounded: "{rounded.md}"
    padding: "24px"
  input-standard:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text-heading}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
---

# Design System: Ventrina SaaS

## Overview

**Creative North Star: "The Boutique Atelier"**

Ventrina's visual identity balances the tactile elegance of an artisanal retail showroom with the ultra-fast, high-precision utility of a modern edge application. The system evokes quality through warm linen surfaces (`#faf7f2`), noble Terracotta accents (`#c2410c`), and deliberate touches of burnished bronze (`#d97706`), communicating warmth, dependability, and craftsmanship to Latin American merchants and their customers.

Rather than relying on sterile corporate monochrome or noisy, AI-generated design trends, the interface builds visual authority through meticulous typography, hairline boundaries, and subtle tonal depth. The shopping and administrative experiences feel deliberate, trustworthy, and fast.

The system explicitly rejects generic AI cliches—such as decorative gradient text, faux blueprint background grids, bouncy rubber-band easings, and gratuitous card borders. Surfaces speak through clear information hierarchy, authentic product imagery, and immediate responsiveness.

**Key Characteristics:**
- **Warm Atelier Foundations:** Natural linen and alabaster backgrounds layered with whisper-light interior bezels.
- **Terracotta & Burnished Bronze:** An authoritative primary terracotta grounded with restrained, high-value bronze accents.
- **Organic WhatsApp Conversational Flow:** High-contrast emerald accents reserved specifically for order confirmation and direct merchant chat.
- **Pure Native Motion:** Smooth, physics-grounded transitions driven by CSS Scroll-Driven Animations rather than heavy client JavaScript.

## Colors

The palette pairs a distinguished Terracotta primary with an organic Warm Amber accent, anchored over warm atelier neutrals and an emerald WhatsApp transaction layer.

### Primary
- **Terracotta Tostado** (`#c2410c`): The signature brand anchor. Used for primary calls-to-action, key navigation highlights, active tab states, and focused interactive states.
- **Terracotta Deep / Hover** (`#9a3412`): The hover and active counterpart to Terracotta, providing tactile feedback under pointer or press.
- **Warm Obsidian / Deep** (`#431407`): Deep grounding hue used for dark accents, high-contrast elements, and dark-theme boundaries.

### Secondary
- **Warm Amber / Burnished Bronze** (`#d97706`): Warm artisanal metallic accent. Used strictly for high-value triggers: VIP tier badges, pricing highlights, discount tags, and primary conversion signals.
- **Deep Amber** (`#b45309`): Pressed and hover variant of the amber accent.

### Tertiary
- **WhatsApp Boutique Emerald** (`#059669`): Dedicated conversion color. Used exclusively for WhatsApp order actions, verification badges, and positive payment status confirmations.

### Neutral
- **Atelier Linen** (`#faf7f2`): Continuous natural light background providing warmth and reducing eye strain.
- **Alabaster Subtle** (`#f5f0e8`): Secondary surface for grouped sections, table rows, and subtle container depth.
- **Pure Card White** (`#ffffff`): Elevated card and container background providing clean contrast for product imagery and text.
- **Warm Charcoal / Piedra** (`#1c1917`): Dominant high-contrast typography color for headlines, section titles, and primary metrics.
- **Stone Body** (`#44403c`): Readable neutral for paragraph prose, field values, and descriptive text.
- **Muted Stone** (`#78716c`): Secondary text for timestamps, table column headers, units, and secondary hints.
- **Hairline Border** (`rgba(28, 25, 23, 0.08)`): Subtle separation line that structures content without visual clutter.

### Named Rules
**The Precision Accent Rule.** Warm Amber (`#d97706`) is strictly reserved for high-value highlights, VIP badges, and key pricing triggers (<5% of any screen). It never carries large background cards or generic borders.
**The Solid Typography Rule.** Gradient text (`background-clip: text`) is prohibited across all headings, badges, and labels. Text is always rendered in solid, high-contrast ink to guarantee legibility.

## Typography

**Display Font:** Outfit (fallback: `-apple-system, BlinkMacSystemFont, sans-serif`)
**Body Font:** Inter (fallback: `-apple-system, BlinkMacSystemFont, sans-serif`)
**Label/Mono Font:** Inter / monospace for technical references and transaction hashes

**Character:** Outfit delivers geometric confidence and modern storefront character to headlines, while Inter provides clean, neutral legibility for product descriptions, administrative data, and mobile checkout forms.

### Hierarchy
- **Display** (800 weight, 3.5rem / clamp(2.5rem, 5vw, 4rem), 1.1 line-height, -0.03em tracking): Hero headline statements and prominent landing introductions.
- **Headline** (700 weight, 2rem / clamp(1.5rem, 3vw, 2.25rem), 1.2 line-height, -0.02em tracking): Section titles, template category headers, and major dashboard card headers.
- **Title** (600 weight, 1.25rem - 1.5rem, 1.3 line-height, -0.01em tracking): Product names, modal headings, and feature card titles.
- **Body** (400-500 weight, 1rem (16px), 1.6 line-height, 0em tracking): Product descriptions, administrative settings, and explanatory paragraphs. Maximum line length capped at 65–75ch for comfortable reading.
- **Label** (500-600 weight, 0.75rem - 0.85rem, 1.4 line-height, 0.02em tracking): Form labels, button captions, table column headers, and status badges.

### Named Rules
**The Distinct Family Rule.** All display and section headings use Outfit with negative tracking (`-0.02em` to `-0.03em`); all interactive controls, inputs, and dense catalog tables use Inter for maximum scanning clarity on mobile screens.

## Layout

The spatial model uses an 8px base rhythm with deliberate density variations across marketing, catalog, and administrative surfaces.

- **Containers:** Marketing landing pages and catalog storefronts cap at a centered max-width of 1280px (`max-w-7xl`) with generous horizontal padding (1.5rem mobile, 2rem desktop).
- **Catalog Grid:** Fluid responsive product grid starting at 1 column on mobile (<640px), 2 columns on tablet (640px–1024px), and 3 to 4 columns on desktop (1024px+).
- **Admin Dashboard Layout:** Left sidebar (240px desktop, off-canvas drawer on mobile) paired with a responsive fluid workspace and sticky header actions.
- **Spacing Rhythm:** Standard spacing scale based on multiples of 4 and 8 (`4px`, `8px`, `16px`, `24px`, `32px`, `48px`). Consistent 16px to 24px gutters between adjacent cards.

## Elevation & Depth

Ventrina employs a tactile tonal layering model rather than arbitrary drop shadows. Surfaces rest on soft atelier backgrounds, conveying physical depth through layered white cards, hairline borders, and an inner light reflection bezel.

### Shadow Vocabulary
- **Subtle Surface** (`0 1px 2px rgba(28, 25, 23, 0.04), 0 0 0 1px rgba(28, 25, 23, 0.04)`): Flat resting state for product cards, table containers, and search inputs.
- **Tactile Card** (`0 4px 16px -2px rgba(28, 25, 23, 0.06), 0 1px 3px rgba(28, 25, 23, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.95)`): Default elevated card shadow with an interior light bezel simulating physical craftsmanship.
- **Floating Hover** (`0 20px 40px -12px rgba(194, 65, 12, 0.16), 0 2px 8px -2px rgba(28, 25, 23, 0.04), inset 0 1px 0 #ffffff`): Lifted state for hovered cards and prominent callouts.
- **Primary Glow** (`0 4px 14px rgba(194, 65, 12, 0.28)`): Ambient color glow anchored under primary Terracotta action buttons.

### Named Rules
**The Tactile Bezel Rule.** Elevated cards in light mode feature an inner light reflection (`inset 0 1px 0 rgba(255, 255, 255, 0.95)`) combined with a hairline border (`rgba(28, 25, 23, 0.08)`) to create physical depth without heavy outlines.
**The Ambient Glow Rule.** Colored shadows are reserved exclusively for primary interactive buttons (`Terracotta` or `WhatsApp Emerald`), never for general content containers.

## Shapes

The form language is warm and modern, defined by smooth rounded rectangles and consistent radii across interactive and structural elements.

- **Micro Controls (Badges, Pills):** `9999px` (full pill radius) for product unit badges, category chips, and status indicators.
- **Interactive Controls (Inputs, Buttons):** `10px` (`--radius-sm`) providing comfortable thumb targets on touch screens.
- **Cards & Surfaces:** `14px` (`--radius-md`) for product cards, summary panels, and modal containers.
- **Large Regions:** `18px` to `24px` (`--radius-lg` to `--radius-xl`) for pricing containers and hero showcase banners.
- **Hairline Borders:** Uniform 1px solid stroke across all bordered components.

## Components

### Buttons
- **Primary Button (`.btn-action`, `.btn-primary-hero`):**
  - Shape: 10px radius (inputs/admin) or 12px radius (hero).
  - Background: Linear gradient from `#c2410c` to `#9a3412`. Text: Solid `#ffffff`, font-weight 600.
  - Hover: `transform: translateY(-1px)`, brightness 1.05, shadow `0 6px 18px rgba(154, 52, 18, 0.38)`.
  - Padding: `0.6rem 1.2rem` (admin/catalog) or `1rem 2.2rem` (hero).
- **Secondary Button (`.btn-secondary-hero`, `.btn-action.secondary`):**
  - Shape: 10px-12px radius.
  - Background: Solid `#ffffff` with 1px border `rgba(28, 25, 23, 0.08)`.
  - Text: Warm Charcoal (`#1c1917`), font-weight 600.
  - Hover: Background `#f5f0e8`, border-color `rgba(194, 65, 12, 0.25)`, text color `#c2410c`.
- **WhatsApp Direct Button (`.btn-whatsapp`):**
  - Shape: 10px-12px radius.
  - Background: Solid `#059669`. Text: Solid `#ffffff`, font-weight 600.
  - Hover: Background `#047857`, shadow `0 4px 14px rgba(5, 150, 105, 0.25)`.

### Cards / Containers
- **Product & Feature Cards:**
  - Corner Style: 14px radius.
  - Background: `#ffffff` in light mode; subtle translucent slate in dark mode.
  - Border: 1px solid `rgba(28, 25, 23, 0.08)`.
  - Elevation: Tactile Card shadow with `inset 0 1px 0 rgba(255, 255, 255, 0.95)`.
  - Padding: 1.25rem (20px) to 1.5rem (24px).

### Inputs / Fields
- **Form Controls (`.form-control`):**
  - Shape: 10px radius.
  - Background: `#faf7f2` (Atelier Linen).
  - Border: 1px solid `rgba(28, 25, 23, 0.12)`.
  - Typography: Outfit, 0.9rem (14.5px), color `#1c1917`.
  - Focus: Border-color `#c2410c`, box-shadow `0 0 0 3px rgba(194, 65, 12, 0.15)`.

### Navigation
- **Glass Header (`.glass-nav`):**
  - Background: Translucent frosted glass with backdrop blur.
  - Scroll Interaction: Native CSS scroll animation smoothly transitions background opacity from transparent to solid on scroll.
  - Logo: Outfit 800 weight, `#1c1917` in light mode or `#ffffff` on dark banners, paired with Terracotta accent mark.

### Chips & Badges
- **Unit & Status Badges (`.product-unit-badge`):**
  - Shape: Full pill (`border-radius: 9999px`).
  - Background: `#ffffff` with 1px border `rgba(28, 25, 23, 0.08)`.
  - Typography: Inter 500, 0.75rem (12px), text color `#686475`.

## Do's and Don'ts

### Do:
- **Do** use native CSS Scroll-Driven Animations (`animation-timeline: view()` / `scroll()`) for scroll effects; never attach JavaScript scroll listeners.
- **Do** place all CSS rules and `@keyframes` in dedicated stylesheet files (`src/styles/*.css`); keep zero inline CSS attributes and zero inline `<script>` tags.
- **Do** use solid, opaque colors for text to maintain strict WCAG AA contrast against backgrounds.
- **Do** maintain the 10px radius for interactive controls (buttons, inputs) and 14px radius for surface containers.
- **Do** reserve WhatsApp Emerald (`#059669`) strictly for WhatsApp checkout, chat triggers, and payment confirmations.

### Don't:
- **Don't** use gradient text (`background-clip: text`) on headings, metrics, or badges.
- **Don't** use decorative multi-axis grid-line backgrounds tiled with linear gradients.
- **Don't** apply thick side-tab accent borders (e.g. `border-left: 3px solid`) on cards.
- **Don't** use bouncy, elastic easing curves (`cubic-bezier` with overshoots > 1.0); use smooth deceleration (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Don't** use inline `style="..."` attributes or inline JavaScript in templates.

