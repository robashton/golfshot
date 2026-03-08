# Golfshot

A golf course strategy-card generator. Capture hole geometry on a satellite basemap, then render simplified printable strategy cards tuned to a player's bag.

## Product concept

Two distinct modes:

1. **Edit mode** -- satellite basemap with click/drag capture for tee, green, hazards, layups, and fairway structure. Outputs JSON geometry.
2. **Play mode** -- clean simplified overhead rendering with projected dispersion ellipses, stock route, and strategy notes. Optimized for print.

The satellite editor is the authoring tool; the printable strategy cards are the real product.

## Target courses
- **Mearns Castle Golf Academy** -- validation course (known, easy to verify). Holes 1 and 7 are golden fixtures with seed data.
- **Mijas Golf Club - Los Lagos** -- real use case (unfamiliar course, will need public-data bootstrap).

## Architecture

### Data model (three independent concerns)

| Layer | Purpose | File |
|-------|---------|------|
| **Course geometry** | Structural facts: tee, green, fairway, hazards, key points | `data/mearns_castle_geometry.json` |
| **Bag profile** | Player-specific stock carries per club | `data/bag_profile.json` |
| **Strategy plan** | Per-hole decisions: stock route, aggressive option, no-go zones, preferred miss, notes | Not yet created |

Key principle: **geometry, player model, and strategy are separated**. Multiple strategy plans can derive from the same geometry + bag profile (safe, normal, aggressive, windy-day).

### Rendering split

| Mode | Basemap | Purpose | Interaction |
|------|---------|---------|-------------|
| Edit | Satellite imagery | Create/refine geometry | Click/drag markers, save/load JSON |
| Play | None (simplified render) | Support on-course decisions | View only, print-optimized |

Play mode normalizes orientation: tee at bottom, green toward top.

### Technical stack
- **Server**: Express (TypeScript) with server-rendered HTML
- **Database**: SQLite via better-sqlite3 (stored at `data/golfshot.db`)
- **Auth**: bcrypt password hashing, cookie-based sessions (SQLite-backed session store)
- **Dev tooling**: tsx for dev server, vitest + supertest for testing, nix-shell for environment
- **Build**: TypeScript compiled to `dist/`, ES modules throughout

### Database schema

**users** table:
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| email | TEXT | NOT NULL UNIQUE |
| password_hash | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

**sessions** table:
| Column | Type | Constraints |
|--------|------|-------------|
| sid | TEXT | PRIMARY KEY |
| sess | TEXT | NOT NULL |
| expired | TEXT | NOT NULL (indexed) |

**courses** table:
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | NOT NULL |
| location | TEXT | NOT NULL DEFAULT '' |
| created_by | INTEGER | NOT NULL, FK → users(id) |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

**holes** table:
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| course_id | INTEGER | NOT NULL, FK → courses(id) ON DELETE CASCADE |
| hole_number | INTEGER | NOT NULL |
| par | INTEGER | NOT NULL |
| yardage | INTEGER | NOT NULL |
| geometry | TEXT | NOT NULL DEFAULT '{}' (JSON: tee, green, hazards, layups, fairway_points) |
| | | UNIQUE(course_id, hole_number) |

### Authentication

- **Registration**: `POST /register` -- email + password (min 8 chars), bcrypt hash (10 rounds), creates session, redirects to `/dashboard`. Rejects duplicate emails (409).
- **Login**: `POST /login` -- verifies email + bcrypt hash, creates session, redirects to `/dashboard`. Returns 401 on bad credentials.
- **Logout**: `POST /logout` -- destroys session, redirects to `/login`.
- **Session middleware**: cookie-based via express-session with custom `SqliteSessionStore`. Sessions stored in `sessions` table with expiry. 24-hour max age.
- **Auth guard**: `requireAuth` middleware redirects unauthenticated requests to `/login`. Protects `/dashboard` and all `/courses/*` routes.
- **Forms**: Server-rendered HTML forms at `GET /register` and `GET /login`. No SPA.

### Courses & holes

- **List courses**: `GET /courses` -- shows all courses with name, location, hole count. Auth-protected.
- **Create course**: `POST /courses` -- name (required) + location. Redirects to course detail.
- **View course**: `GET /courses/:id` -- shows course details and all holes with geometry summary.
- **Edit course**: `GET /courses/:id/edit` + `POST /courses/:id` -- update name and location.
- **Delete course**: `POST /courses/:id/delete` -- cascading delete of course and all holes.
- **Add hole**: `GET /courses/:id/holes/new` + `POST /courses/:id/holes` -- hole number, par, yardage, tee/green coords, hazards, layups.
- **Edit hole**: `GET /courses/:courseId/holes/:holeId/edit` + `POST /courses/:courseId/holes/:holeId` -- update all hole fields.
- **Delete hole**: `POST /courses/:courseId/holes/:holeId/delete`.
- **Import stub**: `GET /courses/import` -- placeholder for open data import with "coming soon" message.
- **Seed import**: `POST /courses/import-seed` -- imports `mearns_castle_geometry.json` format. Parses tee/green/layup coords and unknown coordinate pairs as hazards.
- **Geometry JSON**: holes store `geometry` as a JSON column with keys: `tee` ({lat, lng}), `green` ({lat, lng}), `hazards` (array of {name, lat, lng}), `layups` (array of {name, lat, lng}), `fairway_points` (array of {lat, lng}).

## Current seed data

### `data/bag_profile.json`
Player bag with 4 clubs:
- 8i: 145y, 7i: 155y, 7w: 190y, Driver: 230y
- Conservative position golf philosophy: mostly 7i/7w, driver only on safe holes

### `data/mearns_castle_geometry.json`
Two holes with lat/lng coordinates:
- **Hole 1** "Brook decision" (par 4, 385y) -- brook crosses fairway at ~180-190y; 8i stock tee shot
- **Hole 7** "False aggression" (par 4, 394y) -- driver adds dispersion without strategic value; 7w+7w is the smart play

Each hole has: tee, layup, green coordinates, hazard points (brookA/B), stock plan, and strategy notes.

## Design principles
- Separate geometry from strategy
- Separate authoring from consumption
- Strategy view optimizes clarity, not visual realism
- Support multiple plans from same geometry
- Printable pocket cards are the primary deliverable

## Implementation sequence
1. ~~Project skeleton, shell.nix, and user auth~~ (**done** -- Express server, SQLite, bcrypt auth, 23 tests)
2. ~~Golf course management~~ (**done** -- CRUD for courses + holes, seed data import, 17 tests)
3. Edit mode (satellite basemap, marker capture, JSON save/load)
4. Strategy mode (simplified hole renderer, stock route, carry overlays)
5. Dispersion ellipses (projected shot ellipses aligned to hole direction)
6. Printable export (pocket cards, booklet pages, print CSS)
7. Public-data bootstrap (search/select course, approximate geometry from OSM/golf data)

## Project file structure

```
shell.nix                           -- nix dev environment (node, sqlite)
package.json                        -- dependencies and scripts
tsconfig.json                       -- TypeScript config (strict, ES2022, Node16 modules)
vitest.config.ts                    -- test runner config
CLAUDE.md                           -- dev guide and conventions
src/
  index.ts                          -- server entry point (port 3000)
  app.ts                            -- Express app setup (exported for testing)
  db/
    schema.ts                       -- database schema (users, sessions, courses, holes tables)
    connection.ts                   -- database connection management
    session-store.ts                -- SQLite-backed express-session store
  middleware/
    auth-guard.ts                   -- requireAuth middleware
  routes/
    auth.ts                         -- register, login, logout endpoints + HTML forms
    dashboard.ts                    -- protected dashboard page
    courses.ts                      -- course + hole CRUD, seed import, import stub
tests/
  helpers.ts                        -- test context with in-memory DB
  schema.test.ts                    -- database schema tests (4 tests)
  auth.test.ts                      -- auth endpoint tests (13 tests)
  auth-guard.test.ts                -- auth guard middleware tests (3 tests)
  password.test.ts                  -- bcrypt hashing tests (3 tests)
  courses.test.ts                   -- course + hole CRUD tests (17 tests)
  architecture-notes.md             -- data model and rendering design
  initial-longshot-backlog.md       -- 6-task implementation plan
  chat-handoff-2026-03-08.md        -- prior conversation context and decisions
data/
  bag_profile.json                  -- player bag profile
  mearns_castle_geometry.json       -- seed hole geometry (Mearns holes 1 & 7)
```