# barangay-waste-management-system
Mobile-first PWA for barangay waste collection scheduling, route planning, missed-pickup reports, and RA 9003 segregation compliance monitoring. Built with Next.js, TypeScript, PostgreSQL, Drizzle ORM, and Leaflet.

# Barangay Waste Collection Scheduling System
**Client:** Barangay San Isidro, City of Malolos, Bulacan, Philippines (Fictional Sample Barangay)

A complete, responsive, mobile-first civic-tech PWA for **Waste Collection Scheduling, Route Planning, Missed Pickup Reports, and RA 9003 Segregation Compliance Monitoring**, built with Next.js App Router, React, TypeScript, Tailwind CSS, Drizzle ORM, PostgreSQL, Leaflet + OpenStreetMap, and Recharts.

## Demo Accounts (All Fictional)
Shared password for all demo accounts: `Password123!`

| Role | Name | Email | Access Scope |
| :--- | :--- | :--- | :--- |
| **Barangay Admin** | Elena Villanueva | `admin@sanisidro.ph` | Full access across all modules |
| **Collector / Driver** | Rico Santos | `rico.santos@sanisidro.ph` | Assigned routes, offline queue sync, inspections |
| **Resident** | Maria Cruz (Purok 1) | `maria.cruz@sanisidro.ph` | Own household schedule, reports & compliance |
| **Barangay Captain / Official** | Roberto Bautista | `captain@sanisidro.ph` | Read-only dashboards, audit logs & exports |

## Modules Implemented
- **A. Public Pages**: Landing page, live weekly schedule by purok, bilingual (EN/FIL) RA 9003 Segregation Guide, Announcements, Data Privacy Notice (RA 10173), Login, and Resident Registration (with Admin Approval workflow).
- **B. Collection Scheduling**: Month, Week, and List calendar views; recurring schedules; real-time truck & driver double-booking prevention; delay/cancel alerts.
- **C. Route Planning & Collector View**: Click-on-map stop creation, drag-and-drop reordering, Nearest-Neighbor suggested ordering with straight-line distance estimate, live admin progress tracking, large mobile-first Collector buttons (`Collected` / `Skipped` / `Blocked`) with reason & photo upload, and local offline queue with auto-sync.
- **D. Missed Pickup Reports**: Map-pinned reporting, photo uploads, auto-generated tickets (`MPR-YYYYMMDD-XXXX`), duplicate prevention, >48h overdue flagging, status timeline & comments, and Resident Resolution Confirmation.
- **E. Segregation Compliance Monitoring**: Household inspections, purok & monthly trend charts, automatic repeat-violator flagging, education & warning notices (strictly no automatic fines), and resident contest workflow.
- **F. Admin Dashboard & Exports**: KPI cards, problem-area map, user approvals, puroks/households/trucks/announcements management, filterable CSV & PDF exports, and Audit Log.

## Local Setup Instructions
1. **Prerequisites**: Node.js 20+ and PostgreSQL 15+.
2. **Environment Variables**: Create `.env` in project root:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/app_db"
   ```
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Push Database Schema**:
   ```bash
   npx drizzle-kit push
   ```
   *(Sample data — 5 puroks, 50 households, 2 trucks, 1 month of schedules, routes, reports, compliance records, and demo accounts — seeds automatically on first request.)*
5. **Run Development Server**:
   ```bash
   npm run dev
   ```
6. **Production Build & Start**:
   ```bash
   npx next typegen
   npm exec tsc -- --noEmit
   npm run build
   npm run start
   ```

## Deployment Notes
- Configure `DATABASE_URL` pointing to your managed PostgreSQL instance (e.g., Supabase Postgres, Neon, or RDS).
- If serving behind HTTPS in production, set `FORCE_SECURE_COOKIE=true` in environment variables so session cookies set the `Secure` attribute.
- Run `npx drizzle-kit push` during release deployment.
- Healthcheck endpoint available at `GET /api/health`.
