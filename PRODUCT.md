# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are small to medium business (SMB) merchants across Latin America operating in retail and local commerce (restaurants, fashion/boutiques, hardware stores, technology & electronics, autoparts, and grocery/bodegas). They need a simple, reliable online catalog without the administrative burden, high commission fees, or checkout barriers of traditional e-commerce platforms.

End customers are everyday mobile shoppers in Latin America who prefer or expect conversational commerce and direct communication via WhatsApp, paying with local bank transfers, Pago Móvil, Zelle, or Binance rather than international credit cards.

## Product Purpose

Ventrina SaaS exists to remove friction from digital commerce for Latin American merchants. It allows businesses to launch an edge-powered, multi-vertical digital catalog in minutes, manage their products and inventory, and receive structured orders directly into WhatsApp with proof of payment. Success means instantaneous page loads, zero checkout drop-off, and seamless order dispatch for merchants.

## Positioning

An edge-native, multi-template digital catalog platform built specifically for Latin American commerce dynamics: instant edge delivery via Cloudflare Pages and D1, zero-friction WhatsApp order routing, and native support for local payment workflows (Bank Transfer, Pago Móvil, Binance Pay, Zelle) without requiring credit cards or merchant gateway lock-in.

## Operating Context

- **Merchant Management**: Store owners manage products, categories, attributes, variants, and review orders via a lightweight web admin dashboard (`/admin`).
- **Shopper Journey**: Customers navigate store catalogs on mobile browsers, add items to a local basket, select delivery or pickup, and finalize orders by launching a pre-composed WhatsApp message to the merchant.
- **Payment Verification**: Customers submit payment references and receipts (stored securely via Cloudflare R2) alongside order details.
- **Multi-Tenant Edge Architecture**: Isolated tenant data via Cloudflare D1 (SQLite at the edge), resolved by subdomain or request headers.
- **Platform Management**: Super-administrators manage tenant provisioning, subscription tiers (Basic, Pro, Enterprise), and platform metrics via `/superadmin`.

## Capabilities and Constraints

- **Multi-Tenant Isolation**: Complete database and branding separation per tenant using `tenant_id`.
- **Vertical Templates**: Built-in specialized templates (Restaurant, Hardware, Fashion, Tech, Autoparts, Grocery).
- **Catalog Architecture**: Products with customizable types, attributes, variants, and categories.
- **Order Flow**: Direct WhatsApp order message composition with order persistence in D1.
- **Payment Methods**: Manual bank transfers, Pago Móvil, Zelle, and Binance Pay.
- **Storage**: Media and payment receipts hosted on Cloudflare R2.
- **Technical Constraints**:
  - Astro static generation combined with Cloudflare Pages Functions.
  - Strict separation of concerns: Zero inline CSS (`style="..."`) and zero inline JavaScript (`<script>` in templates).
  - Native CSS Scroll-Driven Animations (`animation-timeline: view()` / `scroll()`) for scroll effects; no JS scroll listeners.
  - Edge runtime compatibility (Cloudflare Workers/Pages Functions environment).

## Brand Commitments

- **Name**: Ventrina SaaS (ventrina.app).
- **Language**: Spanish as primary merchant and consumer interface language.
- **Voice**: Pragmatic, clear, professional, and accessible.
- **Visual & Code Cleanliness**: Zero inline styling or scripts; all design styling handled via TailwindCSS and external CSS stylesheets.

## Evidence on Hand

- Production web application deployed at https://ventrina.app.
- Canonical database schema defined in `schema.sql` and `migrations/`.
- Seed data for catalog templates in `seed_templates.sql` and attributes in `seed_attributes.sql`.
- Established project architecture and guidelines in `.kiro/steering/` and `.agents/rules/`.

## Product Principles

1. **Zero-Friction Checkout**: Eliminate artificial checkout barriers like mandatory user registration or cumbersome multi-step credit card gateways; route clean, structured order details straight to WhatsApp.
2. **Edge-First Speed**: Deliver catalogs instantly on mobile networks using edge caching, minimal JavaScript overhead, and Cloudflare Pages/D1 infrastructure.
3. **LatAm Commerce Realism**: Build directly around the daily payment and communication realities of Latin American businesses (WhatsApp, Pago Móvil, transfers, crypto) rather than imported e-commerce paradigms.
4. **Architectural Discipline**: Maintain clean standards across all surfaces with strict avoidance of inline CSS/JS and reliance on native web standards.

## Accessibility & Inclusion

- Responsive design prioritized for mobile screens across diverse budget devices.
- High visual contrast and legible typography for on-the-go and bright outdoor viewing environments.
- Semantic HTML tags ensuring accessibility for assistive technology and screen readers.

