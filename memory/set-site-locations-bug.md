---
name: set-site-locations-bug
description: Critical fix — setSiteLocations() was never called, breaking all site-proximity coverage
metadata:
  type: feedback
---

**The Bug:** `setSiteLocations()` was imported in both `useAircraft.ts` and `aircraftService.ts` but NEVER CALLED. This made `siteLocations` in `geography.ts` permanently empty, causing:

1. `isNearAnySite()` → always `false` (all site-proximity filtering was dead code)
2. `siteCells()` → always `[]` (no site-proximity query cells generated)
3. `computeSiteCoverage()` → always 0 aircraft per site
4. `getAllRadiusGridCells()` → never included site cells

**The Fix:** Added a `useEffect` in `DashboardPage.tsx` that calls `setSiteLocations()` whenever `liveSites` changes.

**Why:** Without this fix, any aircraft that are only near configured Sites (not inside the SA bbox) would be excluded. This was likely the root cause for the user's "Hafar Al Batin shows no aircraft" issue — if aircraft around a user's Site happened to be just outside the SA bbox but within the Site's 100nm radius, they'd be silently dropped.
