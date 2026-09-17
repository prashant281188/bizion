# Bizion ERP - Detailed Project Memory & Handoff Document

This document serves as a comprehensive memory state for the Bizion project. It is intended to instantly onboard any developer or AI assistant, providing precise architectural context, current progress, and immediate next steps.

---

## 1. Project Overview & Architecture
**Bizion** is a full-stack, multi-tenant B2B/B2C ERP and catalog web application. It allows businesses (Organizations) to manage their inventory, products, orders, and users while simultaneously exposing a public-facing e-commerce storefront for customers to browse and buy products.

### Tech Stack
- **Frontend Framework:** Next.js 15 (App Router, Turbopack)
- **Frontend Libraries:** React 19, Tailwind CSS v4, Lucide React (icons), Sonner (toast notifications).
- **Backend Framework:** Node.js, Express.
- **Database & ORM:** PostgreSQL accessed via Drizzle ORM.
- **Monorepo Structure:** Two distinct directories at the root level: `/frontend` and `/backend`.

### Key Directories
- **`/frontend/src/app/(dashboard)`**: The authenticated internal ERP system. Contains modules like `/sales`, `/purchases`, `/inventory`, `/products`, etc.
- **`/frontend/src/app/(public)/[orgSlug]`**: The dynamically generated public storefront for each organization.
- **`/backend/src/db/schema/`**: Contains Drizzle ORM schemas defining the database structure (e.g., `products.ts`, `orders.ts`, `inventory.ts`).
- **`/backend/src/controllers/`**: Express route handlers exposing REST APIs consumed by the frontend.

---

## 2. Completed Milestones & Current State

### A. Internal Dashboard (`/dashboard`)
The ERP dashboard is functionally robust with the following features implemented:
- **Role-Based Access Control (RBAC):** Integrated into the sidebar navigation using `usePermissions` to conditionally render modules based on user roles (Admin, Manager, Staff).
- **Core Modules Built:**
  - **Masters:** Categories, Brands, Units of Measurement (UOM), HSN Codes, and Tax Rates.
  - **Products:** Detailed product creation with variant support, dynamic attributes, and image management.
  - **Inventory:** Stock management, adjustments, and replenishment tracking. *Note: Recently refined the Replenishment UI to remove confusing "(Loose)" text from table headers.*
  - **Sales & Purchases:** Order creation, management, and status tracking for both sales and procurement.
- **UI Componentization:** Converted raw HTML tables, inputs, and selects into highly reusable components (`DataTable`, `Button`, `Input`, `SearchableSelect`).

### B. Public Storefront (`/[orgSlug]`)
The customer-facing catalog has recently undergone a massive UI overhaul to achieve a **"Minimalist Corporate"** aesthetic.
- **Design Principles:** Monochrome palette (whites, stones) with subtle sage green (`emerald-700`) accents, crisp sans-serif typography, sharp borders (`rounded-sm`), and intentional use of negative space.
- **Componentized Architecture:**
  - All shared UI elements were extracted into `/frontend/src/app/(public)/[orgSlug]/_components/`.
  - Reusable components include `<StorefrontHeader>`, `<StorefrontFooter>`, `<HeroCarousel>`, `<ProductCard>`, and `<CategoryCard>`.
- **Advanced UI Features:**
  - Dynamic variant price calculations displayed on Product Cards.
  - Smooth page-load fade-in and slide-in animations (using Tailwind `animate-in`).
  - A subtle, slow-pulsing background animation in `layout.tsx` for a "live" feel.
  - Mobile responsiveness perfected (e.g., synchronized fixed heights `h-11` for mobile search inputs and select filters).

---

## 3. Pending Tasks & Immediate Next Steps

If you are picking up this project, these are the **exact tasks** that need to be addressed immediately:

### Priority 1: Order Mathematics & GST Calculation
**User Request:** *"in sale and purchase order final amount should be rounded off automatically and in purchase order gst also calculate"*
- **Objective:** Update the order creation logic for both Sales and Purchase orders.
- **Action Items:**
  1. Modify the frontend order creation forms (e.g., `/frontend/src/app/(dashboard)/purchases/orders/new/page.tsx` and the corresponding sales page).
  2. Implement logic to pull the correct GST/Tax rate based on the product's assigned HSN Code / Tax Profile.
  3. Automatically calculate the total GST amount and add it to the subtotal.
  4. Implement an automatic round-off function (e.g., `Math.round(totalAmount)`) for the final grand total before submission.
  5. Ensure the backend `/orders` endpoints properly receive, validate, and store these computed values.

### Priority 2: Dispatches Module Completion
- **Context:** A background subagent was previously tasked with building out the `/dispatches` API and corresponding frontend pages.
- **Objective:** Verify the status of the Dispatches module.
- **Action Items:**
  1. Check `/backend/src/routes/dispatches.ts` and related controllers.
  2. Verify the frontend pages under `/frontend/src/app/(dashboard)/inventory/dispatches`.
  3. Ensure the module integrates correctly with existing inventory tracking (deducting stock upon dispatch).

### Priority 3: Storefront Edge Cases
- **Objective:** Ensure the newly designed `ProductCard` and `CategoryCard` components handle missing data gracefully.
- **Action Items:** Test the storefront UI with products that have no images, no variants, or missing descriptions to confirm the UI does not break and displays appropriate fallbacks.

---

## 4. Developer Notes & Commands

- **Starting the Development Servers:**
  - Open two terminal tabs.
  - Terminal 1: `cd backend && npm run dev` (Runs on port `3000`)
  - Terminal 2: `cd frontend && npm run dev` (Runs on port `5173`)
- **Database Migrations:**
  - If schema changes are required, use Drizzle Kit commands configured in `backend/package.json` (e.g., `npm run db:generate`, `npm run db:push`).
- **Context Lookup:**
  - If you need exact database schema details, refer to `backend_tables_structure.md` or `db_schema_documentation.md` located in the `.gemini` brain directory.

---
*End of Document. You are now fully synced with the project state. Let's get to work.*
