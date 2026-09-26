# ADR 0001: Initial Repository Scaffold & Template Harvesting

- **Status**: Accepted
- **Date**: 2026-09-26
- **Authors**: Antigravity AI & StockSense Engineering
- **Context**: StockSense Phase 1 + 2 (Repository scaffolding and local infrastructure)

---

## 1. Context and Problem Statement

StockSense is an event-sourced, document-driven Inventory Management System (Receipts, Delivery Orders, Internal Transfers, Adjustments, Multi-Warehouse, and immutable Stock Ledger). To accelerate development while avoiding low-level boilerplate, `architecture.md` specifies harvesting foundation patterns from two battle-tested GitHub repositories:

1. `Kiranism/next-shadcn-dashboard-starter` (Next.js App Router, shadcn/ui, TanStack Table/Query, Tailwind CSS, URL-state via `nuqs`).
2. `andrechristikan/ack-nestjs-boilerplate` (NestJS, Prisma ORM, modular architecture, OpenAPI/Swagger).

Section 8 of `architecture.md` explicitly warns against creating a "Frankenstein" codebase where conflicting configs, competing auth systems, and disparate error envelopes co-exist. This ADR documents what was preserved, what was excised, and why.

---

## 2. Decision Log: Frontend Foundation (`frontend/`)

### 2.1 Preserved Components & Patterns (Adapted from `Kiranism/next-shadcn-dashboard-starter`)

- **Sidebar & Header Layout Shell**: Adapted into `frontend/src/components/layout/app-sidebar.tsx`, `frontend/src/components/layout/header.tsx`, `SidebarProvider`, and `PageContainer`. Configured with StockSense domain navigation (Overview, Products, Receipts, Deliveries, Transfers, Adjustments, Move History, and Warehouses).
- **Data Table + URL-State Pattern**: Adapted into `frontend/src/hooks/use-data-table.ts`, TanStack Table (`@tanstack/react-table`), and `nuqs` URL state caching hooks (faceted filters, pagination, debounced search).
- **Feature-Sliced Architecture**: Standardized on `frontend/src/features/<domain>/{api,components,schemas}` across all business domains (`auth`, `products`, `documents`, `dashboard`).
- **TanStack Query Setup**: Server prefetch and client query hydration boundaries (`@tanstack/react-query`).
- **Form Patterns**: React Hook Form with Zod schema resolvers (`react-hook-form`, `@hookform/resolvers`, `zod`).

### 2.2 Excised Components & Rationale

- **Clerk Authentication, Organizations & Billing**: Excised completely. StockSense is an internal/operational inventory system utilizing its own PostgreSQL-backed User, Role (Inventory Manager vs Warehouse Staff), and OTP password-reset mechanisms.
- **Demo Applications**: Excised demo Kanban board (`@dnd-kit`), chat messaging, scripted AI chat, and notification center.
- **Multiple Third-Party Themes**: Pruned redundant themes (retained standard modern design system with dark/light mode toggle).
- **Sentry Hooks**: Removed Sentry nextjs wrapper in error boundaries in favor of standard exception handlers until centralized Phase 11 observability is integrated.
- **Mock APIs**: Replaced demo mock API calls with typed API client stubs (`frontend/src/lib/api-client.ts`) pointing to `NEXT_PUBLIC_API_URL` with standard error envelope handling.

---

## 3. Decision Log: Backend Foundation (`backend/`)

### 3.1 Preserved Components & Patterns (Referenced from `andrechristikan/ack-nestjs-boilerplate`, adapted into `backend/`)

- **NestJS Modular Architecture**: Standard modular layout (`backend/src/modules/*`, `backend/src/common/*`, `backend/src/config/*`).
- **Global Config Module with Env Validation**: Built using Zod (`backend/src/config/env.schema.ts`) to fail-fast on invalid runtime environment variables.
- **Standardized Error Envelope**: Implemented global exception filter (`GlobalExceptionFilter` in `backend/src/common/filters/http-exception.filter.ts`) producing `{ error: { code, message, fieldErrors? } }` matching `architecture.md` Section 12.
- **Swagger / OpenAPI Documentation**: Wired at `/api/docs` from day one for typed API contract verification.
- **Health Check Endpoint**: `GET /api/v1/health` responding with service status and timestamp.
- **Prisma Schema**: Located in `backend/prisma/schema.prisma` matching `architecture.md` Section 11, including models for `User`, `OtpCode`, `Product`, `Category`, `UnitOfMeasure`, `Location`, `Document`, `DocumentLine`, `StockLedger`, and `StockBalance`.

### 3.2 Deferred Components

- Business logic modules (`products`, `documents`, `ledger`, `auth`) are deferred to Phases 3–9 per roadmap to maintain clean milestone progression.

---

## 4. Decision Log: Workers Foundation (`workers/`)

- Initialized a standalone TypeScript worker runner using BullMQ and `ioredis`.
- Skeletons prepared for:
  - `low-stock-alert.worker.ts` (Phase 5)
  - `email-otp.worker.ts` (Phase 9)
  - `report-export.worker.ts` (Phase 8)

---

## 5. Monorepo Standardization (`configs/`)

To prevent divergence:

1. **ESLint**: Single shared flat config (`configs/eslint.base.mjs`) used by root, `frontend/`, `backend/`, and `workers/`.
2. **Prettier**: Single shared formatting rules (`configs/.prettierrc.json`).
3. **TypeScript**: Single base compiler options (`configs/tsconfig.base.json`) extended across all packages.
