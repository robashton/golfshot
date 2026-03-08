# Meta: Build server-side app skeleton (auth, courses, bags, strategy)

## Context

The existing project spec describes a client-side, file-backed app with no backend. This task pivots to a **server-side architecture** that supports multiple users, shared course data, personal golf bags, and per-hole strategy planning.

The existing seed data (`data/bag_profile.json`, `data/mearns_castle_geometry.json`) and design principles (separate geometry from strategy, separate authoring from consumption) carry forward. The core data model split (course geometry, bag profile, strategy plan) from `docs/architecture-notes.md` remains valid but now lives in a database behind an API rather than in flat JSON files.

## Why broken down

This is four distinct concerns with different data models and dependencies:

1. **Project skeleton + auth** -- foundational; everything else depends on it
2. **Golf courses** -- shared resource, independent of user bags
3. **Golf bags** -- per-user, independent of courses
4. **Hole strategy** -- depends on both courses and bags

## Planned sub-tasks

1. **Project skeleton, shell.nix, and user auth** -- Set up the repo with `package.json`, TypeScript, a web framework (Hono or Express), a database (SQLite via better-sqlite3 or Drizzle), session-based auth with registration/login. Create `shell.nix` providing Node.js, npm, and any native deps (sqlite). Establish project structure: `src/`, routes, middleware, DB schema.

2. **Golf course management** -- Courses are shared between users. A user can create a course by: (a) importing from open data (OSM/golf APIs -- stub the import for now), or (b) entering map coordinates and manually adding holes. Each course has a name, location, and a list of holes. Each hole has par, yardage, and geometry (tee, green, hazards, layups as lat/lng). The existing `mearns_castle_geometry.json` structure is the reference for hole geometry. CRUD API + basic UI/views.

3. **Golf bag ("My Bag")** -- Per-user bag profile. Each bag has a list of clubs with stock carry yardages (reference: `data/bag_profile.json`). A user can have one active bag. CRUD API + basic UI/views.

4. **Hole strategy planner** -- Given a hole (from a course) and a bag (user's clubs/yardages), plan a strategy: select clubs for each shot, see carry distances against hole geometry, set stock route, notes, preferred miss. References the strategy plan concept from `docs/architecture-notes.md` (stock route, aggressive option, no-go zones, preferred miss, notes). API + basic UI/views.

## Technical decisions

- **Runtime**: Node.js + TypeScript
- **Framework**: To be decided in sub-task 1 (likely Hono or Express)
- **Database**: SQLite (file-based, simple to set up, no external service)
- **Auth**: Session-based (cookie + server-side session store)
- **Nix**: `shell.nix` providing nodejs, npm, sqlite
- **No client-side SPA** -- server-rendered HTML (templates or JSX) for the skeleton. The edit-mode satellite map work comes later.

## Acceptance criteria

- All four sub-tasks have clear specs and can be implemented independently (except dependency ordering)
- Project spec updated to reflect the server-side architecture pivot
