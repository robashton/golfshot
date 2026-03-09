# Architecture

## Data model (three independent concerns)

| Layer | Purpose | File |
|-------|---------|------|
| **Course geometry** | Structural facts: tee, green, fairway, hazards, key points | `data/mearns_castle_geometry.json` |
| **Bag profile** | Player-specific stock carries per club | `data/bag_profile.json` |
| **Strategy plan** | Per-hole decisions: stock route, aggressive option, no-go zones, preferred miss, notes | `src/routes/strategies.ts` |


Key principle: **geometry, player model, and strategy are separated**. Multiple strategy plans can derive from the same geometry + bag profile (safe, normal, aggressive, windy-day).

## Rendering split

| Mode | Basemap | Purpose | Interaction |
|------|---------|---------|-------------|
| Edit | ESRI World Imagery (satellite) | Create/refine hole geometry | Toolbar mode selection (tee/green/hazard/layup/fairway), click to place, drag to reposition, right-click to rename/delete |
| Play | None (simplified render) | Support on-course decisions | View only, print-optimized |

Play mode normalizes orientation: tee at bottom, green toward top.

## Technical stack
- **Server**: Express (TypeScript) with server-rendered HTML
- **Static assets**: `public/` directory served via `express.static` (CSS, future JS/images)
- **Styling**: Single `public/styles.css` -- golf-themed colour palette (forest green, fairway green, cream/off-white, gold accents), mobile-first responsive layout with breakpoints at 768px and 1024px
- **Layout**: Shared `src/layout.ts` exports `layout(title, body, opts?)` wrapper used by all page functions -- provides consistent `<head>`, nav bar (Dashboard/Courses/Bags + logout), and `<main>` container. `opts` accepts `{ nav?: boolean, extraHead?: string }` for injecting per-page CSS/JS (e.g. Leaflet CDN tags on map editor pages).
- **Database**: SQLite via better-sqlite3 (stored at `data/golfshot.db`)
- **Auth**: bcrypt password hashing, cookie-based sessions (SQLite-backed session store)
- **Map editor**: Leaflet.js (loaded via CDN from unpkg), ESRI World Imagery tiles (free, no API key). Self-contained vanilla JS component (`public/map-editor.js` + `public/map-editor.css`) writes hidden form fields to sync with server-side form handling.
- **Static files**: `express.static('public')` serves client-side assets
- **External data**: OpenStreetMap (Nominatim search + Overpass API for hole geometry). ODbL license, no API key required.
- **Dev tooling**: tsx for dev server, vitest + supertest for testing, nix-shell for environment
- **Build**: TypeScript compiled to `dist/`, ES modules throughout
- **Migrations**: Numbered migration files in `src/db/migrations/`, tracked via `schema_version` table, run by `src/db/migrate.ts`
- **Dev seed**: `npm run seed` (`scripts/seed.ts`) -- idempotent setup of DB, dev user, course, and bag