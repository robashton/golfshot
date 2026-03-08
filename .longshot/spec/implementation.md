# Implementation

## Sequence
1. ~~Project skeleton, shell.nix, and user auth~~ (**done** -- Express server, SQLite, bcrypt auth, 23 tests)
2. ~~Golf course management~~ (**done** -- CRUD for courses + holes, seed data import, 17 tests)
3. ~~Golf bag management~~ (**done** -- CRUD for bags + clubs, set active, seed import, 18 tests)
4. ~~Hole strategy planner~~ (**done** -- strategy CRUD with shots, clubs from bag, carry distances, no-go zones, 21 tests)
5. ~~Public-data bootstrap~~ (**done** -- OSM search via Nominatim, course preview via Overpass, import with hole geometry, 9 tests)
6. ~~Dev seed script + migrations~~ (**done** -- numbered migration system, idempotent seed script with dev user/course/bag)
7. Edit mode (satellite basemap, marker capture, JSON save/load)
8. Dispersion ellipses (projected shot ellipses aligned to hole direction)
9. Printable export (pocket cards, booklet pages, print CSS)
7. Dispersion ellipses (projected shot ellipses aligned to hole direction)
8. Printable export (pocket cards, booklet pages, print CSS)

## Test suite
88 tests total (vitest + supertest):
- Schema tests (4)
- Auth endpoint tests (13)
- Auth guard tests (3)
- Password hashing tests (3)
- Course + hole CRUD tests (17)
- Bag + club CRUD tests (18)
- Strategy CRUD tests (21)
- OSM integration tests (9)
## File structure
shell.nix                           -- nix dev environment (node, sqlite)
package.json                        -- dependencies and scripts
vitest.config.ts                    -- test runner config
tsconfig.json                       -- TypeScript config
CLAUDE.md                           -- dev guide and conventions
scripts/
  seed.ts                           -- idempotent dev seed script (npm run seed)
src/
  index.ts                          -- server entry point (port 3000)
  app.ts                            -- Express app setup (exported for testing)
  db/
    schema.ts                       -- initializeDatabase() delegates to runMigrations()
    migrate.ts                      -- migration runner (schema_version tracking, applies pending migrations)
    connection.ts                   -- database connection management
    session-store.ts                -- SQLite-backed express-session store
    migrations/
      001-initial-schema.ts         -- original schema (users, sessions, courses, holes, bags, clubs, strategies, strategy_shots)
    auth-guard.ts                   -- requireAuth middleware
  routes/
    auth.ts                         -- register, login, logout endpoints + HTML forms
    dashboard.ts                    -- protected dashboard page
    courses.ts                      -- course + hole CRUD, seed import, OSM search/preview/import
    bags.ts                         -- bag + club CRUD, set active, seed import
    strategies.ts                   -- strategy CRUD with shots, per-hole planning
  osm/
    nominatim.ts                    -- Nominatim search wrapper (golf course search)
    overpass.ts                     -- Overpass query builder + response parser (hole geometry extraction)
tests/
  helpers.ts                        -- test context with in-memory DB
  schema.test.ts                    -- database schema tests (4 tests)
  auth.test.ts                      -- auth endpoint tests (13 tests)
  auth-guard.test.ts                -- auth guard middleware tests (3 tests)
  password.test.ts                  -- bcrypt hashing tests (3 tests)
  courses.test.ts                   -- course + hole CRUD tests (17 tests)
  bags.test.ts                      -- bag + club CRUD tests (18 tests)
  strategies.test.ts                -- strategy CRUD tests (21 tests)
  osm.test.ts                       -- OSM parsing + import route tests (9 tests)
data/
  bag_profile.json                  -- player bag profile
  mearns_castle_geometry.json       -- seed hole geometry (Mearns holes 1 & 7)
```
