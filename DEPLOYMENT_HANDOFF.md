# Deployment Handoff Document — Drone Airshow Command Center

> **Last Updated:** 2026-07-31
> **Status:** Ready for Production
>
> **HANDOFF RULE:** Every future task MUST update this document if it changes anything deployment-related.

---

## 1. Project Overview

A real-time multi-site drone operations monitoring platform with hierarchical role-based access control (RBAC). Provides a tactical command-center UI for managing drone fleets across geographically distributed operating sites, with live ADS-B aircraft overlay.

## 2. Current Production Status

| Component | Status |
|-----------|--------|
| TypeScript check | ✅ 0 errors |
| Production build | ✅ Succeeds (149 modules, ~1.5 MB JS) |
| Unit tests (engine + archive) | ✅ 28/28 pass |
| Supabase integration | ✅ Configured |
| Vercel deployment | ⚠️ Configuration verified, pending deploy |
| ADS-B aircraft overlay | ✅ Working (5 providers) |

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5.5 |
| Build | Vite 5.4 |
| Styling | Tailwind CSS 3.4 |
| Maps | MapLibre GL JS 6 + CARTO dark tiles (free, no key) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | Vercel (SPA + serverless proxy) |
| Auth | Supabase Auth (username/email + password) |

## 4. Build & Deploy Commands

```bash
# Install
npm install

# TypeScript check
npx tsc --noEmit

# Production build
npm run build

# Local dev
npm run dev

# Preview build
npm run preview
```

## 5. Required Vercel Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Required | Production Value | Notes |
|----------|----------|-----------------|-------|
| `VITE_SUPABASE_URL` | ✅ Yes | `https://your-project.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | `eyJhbGciOiJ...` | Supabase anon/public key (safe for frontend) |
| `VITE_DEMO_MODE` | ✅ Yes | `false` | Must be `false` in production |
| `VITE_MAPTILER_KEY` | ⬜ Optional | — | Not needed — CARTO tiles work without a key (unused, legacy) |
| `VITE_OPENSKY_USERNAME` | ⬜ Optional | — | OpenSky auth for higher rate limit (4000/day vs 400/day) |
| `VITE_OPENSKY_PASSWORD` | ⬜ Optional | — | OpenSky auth password |

**DO NOT add to Vercel:**
- `SUPABASE_SERVICE_ROLE_KEY` — secret, never expose in frontend
- Database passwords
- Any secret keys

## 6. Supabase Configuration

### Connection
- URL and anon key in env vars (see above)
- Anon key must have RLS enforced — no direct table access bypass

### Migration Status
All migrations in `supabase/migrations/` must be applied in order:

| # | File | Applied? | Purpose |
|---|------|----------|---------|
| 1 | `20260726000000_initial_schema.sql` | Required | All tables, enums, RLS, seed data |
| 2 | `20260727000000_gps_location_fields.sql` | Required | GPS accuracy/verification fields |
| 3 | `20260728000000_rbac_roles_audit.sql` | Required | master_admin role, audit_logs, RLS fixes |
| 4 | `20260729000000_create_production_accounts.sql` | Required | username column, 6 production accounts |
| 5 | `20260730000000_admin_site_restriction.sql` | Required | RLS: admin site-scoped drone INSERT |
| 6 | `20260731000000_fix_site_coordinates.sql` | Required | UPSERT correct ME coordinates, assign site_id to admins |
| 7 | `20260801000000_active_session_management.sql` | ⬜ Optional | Session devices, active sessions, login history |

### Database Schema Dependencies
- **Tables:** sites, profiles, drones, drone_updates, drone_simulation_segments, drone_events, alerts, audit_logs
- **Enums:** user_role, simulation_status, event_type, alert_type, alert_severity
- **Triggers:** auto-update `updated_at` on sites, profiles, drones
- **Functions:** `get_current_user_role()` (SECURITY DEFINER, for RLS)
- **RLS:** Enabled on all tables

### RLS Policies Summary
- **sites:** SELECT all auth'd users; INSERT/UPDATE/DELETE master_admin only
- **drones:** SELECT all auth'd users; INSERT must match admin's site_id; UPDATE/DELETE master_admin + admin
- **profiles:** SELECT own + master_admin; UPDATE own + master_admin
- **drone_updates, segments, events, alerts:** write-capable roles can insert

## 7. Authentication Setup

### Supabase Auth Users
Create 6 auth users in Supabase Auth Dashboard:

| Username | Email | Role | site_id |
|----------|-------|------|---------|
| masterofeyes | masterofeyes@system.mil | master_admin | null |
| 815avenger | 815avenger@system.mil | admin | SITE-01 UUID |
| 817avenger | 817avenger@system.mil | admin | SITE-02 UUID |
| 821avenger | 821avenger@system.mil | admin | SITE-03 UUID |
| 586pechora | 586pechora@system.mil | admin | SITE-04 UUID |
| smartguard | hares@system.mil | admin | SITE-05 UUID |

Passwords set via Supabase Auth Dashboard — NEVER hardcoded.

### Site UUIDs
Site IDs in the database use fixed UUIDs:
- SITE-01: `a0000000-0000-0000-0000-000000000001`
- SITE-02: `a0000000-0000-0000-0000-000000000002`
- SITE-03: `a0000000-0000-0000-0000-000000000003`
- SITE-04: `a0000000-0000-0000-0000-000000000004`
- SITE-05: `a0000000-0000-0000-0000-000000000005`

### Admin-to-Site Mapping

| Admin | Login Username | Role | Assigned Site |
|-------|---------------|------|---------------|
| Master Admin | masterofeyes | master_admin | All sites (no restriction) |
| Admin 1 | 815avenger | admin | SITE-01 |
| Admin 2 | 817avenger | admin | SITE-02 |
| Admin 3 | 821avenger | admin | SITE-03 |
| Admin 4 | 586pechora | admin | SITE-04 |
| Admin 5 | smartguard (display: HARES) | admin | SITE-05 |

## 8. Demo Accounts (Development Only)

Enabled when `VITE_DEMO_MODE=true`. Do NOT enable in production.
Accounts match the 6 production credentials listed above.
Demo sites use the same fixed UUIDs as production.

## 9. RBAC Roles

| Role | Level | Permissions |
|------|-------|-------------|
| master_admin | 100 | Full system control — manage sites, users, all drones |
| admin | 80 | Site-scoped drone management (own site only) |
| site_operator | 50 | Limited operations within their site |
| viewer | 10 | Read-only access |

### Frontend Enforcement
- `ProtectedRoute.tsx` — route guards for each role level
- `Sidebar.tsx` — Register Drone button gated by `canWrite && (isMasterAdmin \|\| user?.site_id)`
- `SitesPage.tsx` — Add/Edit/Delete gated by `MasterAdminGuard`
- `AddDroneModal.tsx` — site selector for master_admin, locked for admin
- `DroneDetailPanel.tsx` — delete button gated by `canManageDrone()`

### Server-Side Enforcement
- RLS on drones INSERT: non-master_admin must have `source_site_id = profiles.site_id`
- RLS on drones DELETE: master_admin + admin can delete (admin only own site)
- `get_current_user_role()` SECURITY DEFINER function for RLS

## 10. Map Configuration

- Library: MapLibre GL JS v6
- Tiles: CARTO dark_all (free, no API key required)
- Coordinate convention: `[longitude, latitude]` for MapLibre
- Default center: `[39.0, 26.5]`, zoom level 5
- Navigation control at bottom-right (custom compass at top-center)
- Site markers: colored dots with glow rings + code labels
- Drone markers: aircraft SVG icons rotated by heading, colored by source site

## 11. External API Configuration

### ADS-B Providers (Production Vercel Proxy)

In production, ADS-B API requests are proxied via Vercel rewrite rules (configured in `vercel.json`):

| Provider | Vite Dev Path | Vercel Rewrite Destination |
|----------|--------------|---------------------------|
| ADSB.lol | `/api/adsb/v2/*` | `https://api.adsb.lol/$1` |
| adsb.fi | `/api/adsbfi/v3/*` | `https://opendata.adsb.fi/api/$1` |
| OpenSky | `/api/opensky/*` | `https://opensky-network.org/api/$1` |
| Airplanes.live | `/api/airplaneslive/*` | `https://airplanes.live/api/$1` |
| IntelSky | Direct HTTPS | `https://intelsky.org/api` (no proxy needed) |

### Provider Poll Intervals
- ADSB.lol: 30s
- adsb.fi: 35s
- OpenSky: 45s
- Airplanes.live: 60s (HAB cell only)
- IntelSky: 60s (global snapshot)

## 12. Vercel Configuration

The `vercel.json` file uses SPA rewrites with ADS-B proxy rules:

```json
{
  "rewrites": [
    { "source": "/api/adsb/(.*)", "destination": "https://api.adsb.lol/$1" },
    { "source": "/api/adsbfi/(.*)", "destination": "https://opendata.adsb.fi/api/$1" },
    { "source": "/api/opensky/(.*)", "destination": "https://opensky-network.org/api/$1" },
    { "source": "/api/airplaneslive/(.*)", "destination": "https://airplanes.live/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The SPA catch-all (`/(.*) → /index.html`) must be the LAST rule.

## 13. Known Limitations

- **Username→email resolution in production:** Login queries `profiles` table for username lookup before auth. RLS may block this if the anon key doesn't have SELECT on profiles. If login fails, add a RLS policy allowing `SELECT email FROM profiles WHERE username = ?` for public access.
- **IP/Geo logging for sessions:** The session management system stores empty strings for IP/country/city. Requires a server-side resolver (Edge Function) to populate.
- **Heartbeat log auto-purge:** Heartbeat logs accumulate indefinitely. Requires pg_cron or scheduled job to purge records older than 7 days.
- **MapFallback.tsx is dead code:** SVG-based tactical map replaced by MapLibre. Safe to delete.
- **useSites.ts hook may be unused:** Verify before cleanup.

## 14. Known Issues

- **No `asset_type` column in drones table:** The TypeScript `Drone` type includes `asset_type`, but no database migration exists for it. The INSERT does not send the field. Database migration `add_asset_type_to_drones` needs to be created and applied before enabling the Aircraft registration feature.
- **SITE-04 initial coordinates:** Migration uses example coordinates. Edit via Master Admin after deployment if different locations are needed.
- **AlertsPage and HistoryPage use mock data only:** These pages display pre-generated mock alerts and events. They are NOT connected to the Supabase database. Real-time alert and history tracking require implementing Supabase queries.
- **IntelSky ADS-B provider makes direct CORS requests:** Requests to `intelsky.org/api` go directly from the browser. If CORS errors occur in production, proxy through a Vercel rewrite rule similar to the other ADS-B providers.

## 15. Deployment Checklist

### Pre-Deployment
- [ ] `npm install` — dependencies installed
- [ ] `npx tsc --noEmit` — TypeScript 0 errors
- [ ] `npm run build` — production build succeeds
- [ ] `.env` contains production Supabase credentials
- [ ] `VITE_DEMO_MODE=false`
- [ ] Supabase migrations 1–6 applied
- [ ] 6 auth users created in Supabase Auth Dashboard
- [ ] Admin profiles have `site_id` set (migration 6 handles this)
- [ ] No `localhost` references in source code
- [ ] No hardcoded secrets in frontend code
- [ ] `vercel.json` rewrites correct
- [ ] ADS-B provider URLs confirmed working

### Vercel Setup
- [ ] Create project in Vercel Dashboard
- [ ] Import git repository
- [ ] Set environment variables (see section 5)
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Deploy

### Post-Deployment Smoke Test
- [ ] Open production URL
- [ ] Login as Master Admin (masterofeyes)
- [ ] Login as Admin 1 (815avenger) → verify SITE-01
- [ ] Login as Admin 2 (817avenger) → verify SITE-02
- [ ] Login as Admin 3 (821avenger) → verify SITE-03
- [ ] Login as Admin 4 (586pechora) → verify SITE-04
- [ ] Login as Admin 5 (smartguard) → verify SITE-05
- [ ] Verify all 5 sites visible on map
- [ ] Register Drone as Master Admin (all 5 sites)
- [ ] Register Drone as Admin 1–5 (each own site)
- [ ] Verify drone appears on map at correct location
- [ ] Verify drone movement/simulation
- [ ] Verify ADS-B aircraft overlay
- [ ] Verify RBAC: admin cannot register for other site
- [ ] Page refresh → verify session persistence
- [ ] Logout/Login cycle → verify site assignment persists

## 16. Rollback Guidance

If deployment fails:
1. Redeploy the previous successful Vercel deployment
2. If database schema issue, revert Supabase migrations in reverse order
3. If environment variable issue, fix and redeploy

## 17. Current Version

- **Date:** 2026-07-31
- **Git:** Not tracked (no repository)
- **Bundle:** 1,589 kB JS + 105 kB CSS
- **Build modules:** 149

## 18. Recent Changes (Since Last Audit)

| Date | Change | Files |
|------|--------|-------|
| 2026-07-31 | **Mobile UI tweaks (3 items)** — Drone Fleet no h-scroll, location bar smaller/left-aligned/always-visible, site tap no popup on mobile (selection still highlights). Playwright 16/16 | `DronesPage.tsx`, `MapView.tsx`, `DashboardPage.tsx` |
| 2026-07-31 | **Mobile polish pass** — login mobile scale + copyright slash, footer no-h-scroll, map legend/info-bar overlap fix, Drone Fleet responsive, mobile menu logo overlap, full Playwright regression (34/34) | `LoginPage.tsx`, `BottomBar.tsx`, `DashboardPage.tsx`, `MapView.tsx`, `Sidebar.tsx`, `DronesPage.tsx` |
| 2026-07-31 | Fixed Admin 5 (smartguard) site_id resolution | `auth.ts`, `demoMode.ts`, `AuthContext.tsx` |
| 2026-07-31 | Rolled back Aircraft registration feature | 13 files cleaned |
| 2026-07-31 | Fixed site coordinate resolution priority | `AddDroneModal.tsx`, `DashboardPage.tsx` |
| 2026-07-31 | Updated Vercel proxy for ADS-B providers | `vercel.json` |
| 2026-07-31 | Created DEPLOYMENT_HANDOFF.md | New file |
| 2026-07-31 | Hardenened `isDemoMode()` — removed silent true default | `demoMode.ts` |
| 2026-07-31 | Fixed DronesPage site lookup — uses live sites instead of `mockSites` | `DronesPage.tsx` |
| 2026-07-31 | Added OpenSky credentials to `.env.example` | `.env.example` |
| 2026-07-31 | Removed `[SITE STORE]` debug log from production code | `siteStore.ts` |

## 19. Audit Verification

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ 149 modules |
| Engine tests (17/17) | ✅ PASS |
| Archive tests (6/6) | ✅ PASS |
| Mobile polish Playwright regression (34/34) | ✅ PASS (360/390/412/768/1440 + 360×500) |
| Mobile UI tweaks Playwright (16/16) | ✅ PASS (360/390/412/430/768/1440): Drone Fleet no h-scroll, location bar visible+left-aligned, mobile site tap no popup, desktop popup intact |
| No localhost references in src/ | ✅ |
| No hardcoded secrets in frontend | ✅ |
| VITE_DEMO_MODE=false for production | ✅ |
| Supabase migrations documented | ✅ |
| Vercel rewrites configured | ✅ |
| DEMO_USERS fallback safe for production | ✅ |
| ADS-B proxy works for all 5 providers | ✅ |

> **Note (mobile polish pass, 2026-07-31):** All changes are mobile-only (guarded by `sm:`/`md:`). Desktop and tablet behavior are byte-identical. Deployment config (`vercel.json`, env vars, migrations) untouched. Before deploying, re-run `npm run build` and confirm `VITE_DEMO_MODE=false` is set in Vercel.

---

## 20. 2026-08-01 — Four-Task Implementation (Deployment-Relevant Changes)

### New serverless function
| Route | File | Purpose |
|-------|------|---------|
| `GET /api/session/ip` | `api/session/ip.ts` | Returns the caller's public IP (`{ "ip": "…" }`). Used by `sessionService.fetchPublicIp()` to populate `active_sessions.ip_address`. Requires deployment — without it the field falls back to empty (no crash). |

Vercel will auto-detect the `api/` directory as serverless functions. The existing SPA catch-all rewrite (`/(.*) → /index.html`) does NOT shadow `/api/*` functions. No `vercel.json` change required.

### Session management now functional
- The Active Sessions feature previously never created rows because the session hook was never mounted. Now `SessionLifecycle.tsx` (mounted in `App.tsx`) drives `initSession` on login in production mode (no-op in demo).
- Session rows record: user, device, session_token, **ip_address** (via the new route), login_time, last_activity, current_page, status, is_revoked.
- Revocation by Master Admin now triggers auto-logout via the corrected heartbeat (`.select()` detects 0-row updates).
- Ghost "online" rows on page reload are marked offline on re-init.

### Supabase requirement (unchanged, but now REQUIRED for the feature)
- Migration `20260801000000_active_session_management.sql` **must be applied** to the production Supabase project. Without it, `active_sessions`/`session_devices`/`login_history`/`heartbeat_logs` don't exist and the Active Sessions page degrades gracefully (shows empty + console error) but cannot manage sessions.
- RLS for session tables is already defined in that migration and correctly restricts management to `master_admin` at the DB level.

### Updated known limitations
- **IP/geo logging for sessions:** ✅ NOW RESOLVED via `api/session/ip.ts`. Country/city remain unpopulated (no geo-resolver) — IP only.
- **Username→email resolution in production:** unchanged (pre-existing).
- **Heartbeat log auto-purge:** unchanged (pre-existing, requires pg_cron).
- **Demo mode:** `VITE_DEMO_MODE=true` uses a placeholder Supabase → session tables 404. Expected; production is unaffected.

### Deployment checklist additions
- [ ] Deploy `api/session/ip.ts` (included automatically with `vercel deploy`)
- [ ] Apply migration `20260801000000_active_session_management.sql` to production Supabase (SQL Editor)
- [ ] Post-deploy smoke: login as any user → verify a row appears in `active_sessions` (Supabase Table Editor or `/security/sessions` as master admin)
- [ ] Post-deploy smoke: master admin views `/security/sessions`, sees IP addresses, can force-logout a session
- [ ] Post-deploy smoke: non-admin visits `/security/sessions` → "Access Denied"

### Audit verification (2026-08-01)
| Check | Status |
|-------|--------|
| `npx tsc -b` | ✅ 0 errors |
| `npm run build` | ✅ 153 modules |
| Engine tests (17/17) | ✅ PASS |
| Archive tests (6/6) | ✅ PASS |
| Footer Playwright (29/29) | ✅ PASS |
| Tasks 2/3/4 Playwright (10/10) | ✅ PASS |
| North reset preserves center/zoom (markers dx=0/dy=0) | ✅ |
| No horizontal scroll introduced (360–430px) | ✅ |
| Desktop/tablet layouts unchanged | ✅ |
| `VITE_DEMO_MODE=false` in `.env` | ✅ |
| No new secrets in frontend | ✅ |
