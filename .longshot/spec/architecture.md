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
| Edit | Satellite imagery | Create/refine geometry | Click/drag markers, save/load JSON |
| Play | None (simplified render) | Support on-course decisions | View only, print-optimized |

Play mode normalizes orientation: tee at bottom, green toward top.

## Technical stack
- **Server**: Express (TypeScript) with server-rendered HTML
- **Database**: SQLite via better-sqlite3 (stored at `data/golfshot.db`)
- **Auth**: bcrypt password hashing, cookie-based sessions (SQLite-backed session store)
- **External data**: OpenStreetMap (Nominatim search + Overpass API for hole geometry). ODbL license, no API key required.
- **Dev tooling**: tsx for dev server, vitest + supertest for testing, nix-shell for environment
- **Build**: TypeScript compiled to `dist/`, ES modules throughout