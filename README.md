# Drone Airshow Command Center

A real-time multi-site drone operations monitoring platform with hierarchical RBAC.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Map:** MapLibre GL JS (CARTO dark_all tiles — free, no API key required)
- **Icons:** Material Symbols
- **Deployment:** Vercel

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cp .env.example .env.local  # or just use .env as-is
npm install
npm run dev
```

By default, `.env` has `VITE_DEMO_MODE=true`, so the app runs with simulated data and no backend required.

### Demo Mode Accounts

| Username | Role | Password |
|---|---|---|
| `masterofeyes` | Master Admin | `demo123` |
| `815avenger` | Admin | `demo123` |
| `817avenger` | Admin | `demo123` |
| `821avenger` | Admin | `demo123` |
| `586pechora` | Admin | `demo123` |
| `smartguard` | Admin | `demo123` |

---

## Production Deployment

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Go to **SQL Editor** and run all migrations from `supabase/migrations/` in order.

### Step 2: Run Database Migrations

In the Supabase SQL Editor, run each migration file:

```sql
-- 1. Run supabase/migrations/20260726000000_initial_schema.sql
-- 2. Run supabase/migrations/20260727000000_gps_location_fields.sql
-- 3. Run supabase/migrations/20260728000000_rbac_roles_audit.sql
-- 4. Run supabase/migrations/20260729000000_create_production_accounts.sql (setup section only)
```

### Step 3: Create 6 Auth Users in Supabase Dashboard

Go to **Authentication → Users → Add User** and create **6 users** with these EXACT credentials:

| Username | Email | Password | Role |
|---|---|---|---|
| `masterofeyes` | `masterofeyes@system.mil` | **[SET IN SUPABASE]** | `master_admin` |
| `815avenger` | `815avenger@system.mil` | **[SET IN SUPABASE]** | `admin` |
| `817avenger` | `817avenger@system.mil` | **[SET IN SUPABASE]** | `admin` |
| `821avenger` | `821avenger@system.mil` | **[SET IN SUPABASE]** | `admin` |
| `586pechora` | `586pechora@system.mil` | **[SET IN SUPABASE]** | `admin` |
| `smartguard` | `smartguard@system.mil` | **[SET IN SUPABASE]** | `admin` |

**Passwords must be set directly in Supabase Auth Dashboard — NEVER stored in source code.**

### Step 4: Assign Usernames and Roles

After creating the auth users, run the setup SQL from the migration:

```sql
UPDATE profiles SET username = 'masterofeyes', role = 'master_admin', full_name = 'Master Admin', is_active = true
WHERE email = 'masterofeyes@system.mil';

UPDATE profiles SET username = '815avenger', role = 'admin', full_name = 'Admin 1', is_active = true
WHERE email = '815avenger@system.mil';

UPDATE profiles SET username = '817avenger', role = 'admin', full_name = 'Admin 2', is_active = true
WHERE email = '817avenger@system.mil';

UPDATE profiles SET username = '821avenger', role = 'admin', full_name = 'Admin 3', is_active = true
WHERE email = '821avenger@system.mil';

UPDATE profiles SET username = '586pechora', role = 'admin', full_name = 'Admin 4', is_active = true
WHERE email = '586pechora@system.mil';

UPDATE profiles SET username = 'smartguard', role = 'admin', full_name = 'Admin 5', is_active = true
WHERE email = 'smartguard@system.mil';
```

Verify with:
```sql
SELECT p.username, p.role, p.full_name, p.email, p.is_active FROM profiles p ORDER BY p.role, p.username;
```

### Step 5: Deploy to Vercel

1. Push the project to GitHub.
2. Go to [vercel.com](https://vercel.com) and **Add New Project**.
3. Import your GitHub repository.
4. Configure **Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_MAPTILER_KEY` | Optional — for higher tile rate limits |
| `VITE_DEMO_MODE` | `false` |

5. Click **Deploy**.
6. Wait for the build to complete (about 1-2 minutes).

### Step 6: Verify Production

1. Open the Vercel production URL.
2. Login as `masterofeyes` + password.
3. Verify the Master Admin Dashboard with full access.
4. Login as `815avenger` + password.
5. Verify the Admin Dashboard shows global map/sites/drones but NO user/site management.
6. Test all 6 accounts.

---

## RBAC Permission Matrix

| Action | Master Admin | Admin |
|---|---|---|
| Login | ✅ | ✅ |
| View global map | ✅ | ✅ |
| View all sites | ✅ | ✅ |
| View all drones | ✅ | ✅ |
| Add/register drone | ✅ | ✅ |
| Update drone data | ✅ | ✅ |
| Delete drone | ✅ | ✅ |
| View telemetry/events | ✅ | ✅ |
| **Create site** | ✅ | ❌ |
| **Edit site** | ✅ | ❌ |
| **Delete site** | ✅ | ❌ |
| **Set site GPS** | ✅ | ❌ |
| **Create admin accounts** | ✅ | ❌ |
| **Change roles** | ✅ | ❌ |
| **Manage users** | ✅ | ❌ |
| **Manage permissions** | ✅ | ❌ |
| **Manage system settings** | ✅ | ❌ |

---

## Architecture

```
src/
  components/ui/     — Reusable UI primitives (Button, Card, Modal, etc.)
  features/
    auth/            — Authentication context and guards
    drones/          — Drone components and service
    sites/           — Site management components
    alerts/          — Alert system
    map/             — Mapbox map and fallback
    simulation/      — Geographic simulation engine
  layouts/           — Page layout components
  hooks/             — React hooks for data and simulation
  lib/
    supabase/        — Supabase client, queries, auth service
    simulation/      — Engine, runner, freshness, archive
  pages/             — Route page components
  types/             — TypeScript type definitions
  utils/             — Utilities, validation, mock data
supabase/
  migrations/        — Database migration files
```

## Key Design Decisions

- **Confirmed vs Estimated**: The database stores only confirmed user-submitted drone positions. Estimated positions are calculated client-side by the simulation engine using haversine geographic calculations.
- **Simulation Engine**: Runs at 250ms intervals without database writes. Positions are purely client-side estimates derived from confirmed state.
- **Archival**: Each drone update archives the current simulation segment with the calculated estimated end position, preserving complete movement history.
- **Username Login**: Production uses username → `profiles.username` → linked Supabase Auth identity → password verification. No passwords stored in application database.
- **RBAC**: Four-level hierarchy enforced at both frontend (route guards) and backend (Supabase RLS policies).
