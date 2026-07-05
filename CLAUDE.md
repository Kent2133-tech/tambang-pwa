# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (Vite)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No lint or test scripts are configured.

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_KEY` — Supabase publishable (anon) key
- `VITE_OWNER_PIN` — 6-digit PIN for the Owner Dashboard

## Architecture

**Tambang System — GRAPERS** is a React 18 PWA for managing heavy equipment (vehicles and machinery) at a sand mining operation. It is built with Vite and uses Dexie (IndexedDB) for offline-first local storage and Supabase for cloud sync.

### Data Flow

1. All writes go to the local Dexie database first (`src/services/db.js`) — 9 tables including `units`, `svc_logs`, `solar_logs`, `ritase_logs`, `inspections`, `spare_parts`, `spare_stock`, `daily_notes`, `cost_logs`.
2. Every mutation enqueues a record in `sync_queue` with `synced: 0`.
3. `src/hooks/useSync.js` polls every 30 seconds, pushing queued changes to Supabase and pulling remote changes back. Each row tracks a `synced` flag and `cloud_id` for bidirectional reconciliation.

### Key Files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Top-level router; navigation state drives which page renders; no URL routing |
| `src/services/db.js` | Dexie schema (3 migrations, 9 tables + sync_queue + operators) |
| `src/services/dataServices.js` | All business logic — CRUD for every entity type |
| `src/services/exportService.js` | Excel (xlsx) and PDF (jsPDF + autotable) export |
| `src/services/supabase.js` | Supabase client initialisation |
| `src/hooks/useSync.js` | Cloud sync orchestration |
| `src/pages/` | One file per domain area (see navigation below) |
| `src/components/UI.jsx` | Shared UI primitives reused across pages |
| `vite.config.js` | Vite + vite-plugin-pwa; service worker caches Google Fonts and Supabase API responses |

### Navigation / Pages

The app has two distinct shells:

- **Operator view** (`App.jsx`) — 11 pages accessed via a sidebar: Dashboard, Kendaraan (vehicles), Mesin Produksi (machinery), Kalender Service, Riwayat Service, Input Solar (fuel), Ritase/Produksi (haul tracking), Inspeksi, Catatan Harian (daily notes), Stok Spare (parts inventory), Pengaturan (settings).
- **Owner Dashboard** (`OwnerDashboard.jsx`) — PIN-protected high-level analytics view. PIN is set via `VITE_OWNER_PIN`.

### Styling

Global design tokens are in `src/index.css`. Key brand colors: primary `#775537` (brown), accent `#FBE29D` (gold), sidebar background `#2C1A0E`. Status classes: `.healthy` (green), `.warning` (orange), `.critical` (red), `.info` (blue).

### Authentication

`LoginPage.jsx` and `src/hooks/useAuth.jsx` exist but are **not active** — the app defaults all sessions to the "Operator" role. Do not introduce auth flows without enabling the auth hook first.

### Adding a New Data Entity

1. Add the table to the Dexie schema in `db.js` (increment version, add migration).
2. Add CRUD functions in `dataServices.js` following existing service patterns (include `synced: 0` and `updated_at` on every write).
3. Create the matching Supabase table and add push/pull logic in `useSync.js`.
4. Build the page in `src/pages/` and wire it into the sidebar in `App.jsx`.
