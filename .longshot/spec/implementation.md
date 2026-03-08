# Implementation

## Sequence
1. ~~Project skeleton, shell.nix, and user auth~~ (**done** -- Express server, SQLite, bcrypt auth, 23 tests)
2. ~~Golf course management~~ (**done** -- CRUD for courses + holes, seed data import, 17 tests)
3. ~~Golf bag management~~ (**done** -- CRUD for bags + clubs, set active, seed import, 18 tests)
4. Edit mode (satellite basemap, marker capture, JSON save/load)
5. Dispersion ellipses (projected shot ellipses aligned to hole direction)
6. Printable export (pocket cards, booklet pages, print CSS)
7. Public-data bootstrap (search/select course, approximate geometry from OSM/golf data)

## Test suite
58 tests total (vitest + supertest):
- Schema tests (4)
- Auth endpoint tests (13)
- Auth guard tests (3)
- Password hashing tests (3)
- Course + hole CRUD tests (17)
- Bag + club CRUD tests (18)

## File structure

```
shell.nix                           -- nix dev environment (node, sqlite)
package.json                        -- dependencies and scripts
vitest.config.ts                    -- test runner config
tsconfig.json                       -- TypeScript config
CLAUDE.md                           -- dev guide and conventions
src/
  index.ts                          -- server entry point (port 3000)
  app.ts                            -- Express app setup (exported for testing)
  db/
    schema.ts                       -- database schema (users, sessions, courses, holes, bags, clubs)
    connection.ts                   -- database connection management
    session-store.ts                -- SQLite-backed express-session store
  middleware/
    auth-guard.ts                   -- requireAuth middleware
  routes/
    auth.ts                         -- register, login, logout endpoints + HTML forms
    dashboard.ts                    -- protected dashboard page
    courses.ts                      -- course + hole CRUD, seed import, import stub
    bags.ts                         -- bag + club CRUD, set active, seed import
tests/
  helpers.ts                        -- test context with in-memory DB
  schema.test.ts                    -- database schema tests (4 tests)
  auth.test.ts                      -- auth endpoint tests (13 tests)
  auth-guard.test.ts                -- auth guard middleware tests (3 tests)
  password.test.ts                  -- bcrypt hashing tests (3 tests)
  courses.test.ts                   -- course + hole CRUD tests (17 tests)
  bags.test.ts                      -- bag + club CRUD tests (18 tests)
data/
  bag_profile.json                  -- player bag profile
  mearns_castle_geometry.json       -- seed hole geometry (Mearns holes 1 & 7)
```
