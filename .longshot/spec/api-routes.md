# API routes

All routes serve server-rendered HTML. No SPA. All routes except auth forms are protected by `requireAuth` middleware.

## Authentication

- `GET /register` -- registration form
- `POST /register` -- email + password (min 8 chars), bcrypt hash (10 rounds), creates session, redirects to `/dashboard`. Rejects duplicate emails (409).
- `GET /login` -- login form
- `POST /login` -- verifies email + bcrypt hash, creates session, redirects to `/dashboard`. Returns 401 on bad credentials.
- `POST /logout` -- destroys session, redirects to `/login`.
- `GET /` -- redirects to `/login`
- `GET /dashboard` -- protected dashboard page

Session middleware: cookie-based via express-session with custom `SqliteSessionStore`. Sessions stored in `sessions` table with expiry. 24-hour max age.

## Courses & holes

- `GET /courses` -- list all courses with name, location, hole count
- `POST /courses` -- create course (name required, location optional). Redirects to course detail.
- `GET /courses/:id` -- view course details and all holes
- `GET /courses/:id/edit` + `POST /courses/:id` -- update name and location
- `POST /courses/:id/delete` -- cascading delete of course and all holes
- `GET /courses/:id/holes/new` + `POST /courses/:id/holes` -- add hole (number, par, yardage, tee/green coords, hazards, layups)
- `GET /courses/:courseId/holes/:holeId/edit` + `POST /courses/:courseId/holes/:holeId` -- update all hole fields
- `POST /courses/:courseId/holes/:holeId/delete` -- delete hole
- `GET /courses/import` -- import page with OSM search form and seed JSON textarea
- `POST /courses/import-seed` -- imports `mearns_castle_geometry.json` format. Parses tee/green/layup coords and unknown coordinate pairs as hazards.
- `GET /courses/import/search?q={query}` -- searches Nominatim for golf courses, renders results with preview links
- `GET /courses/import/preview?osm_type=...&osm_id=...&name=...&location=...&lat=...&lon=...` -- queries Overpass for course detail, shows hole table with geometry, import button
- `POST /courses/import/osm` -- re-queries Overpass, creates course + holes in DB with tee/green/hazard geometry, redirects to course detail

## Golf bags (My Bag)

Per-user bag management. All bag routes enforce user isolation (can only see/edit own bags).

- `GET /bags` -- list user's bags with name, club count, active status
- `GET /bags/new` -- new bag form
- `POST /bags` -- create bag (name required). Redirects to bag detail.
- `GET /bags/:id` -- view bag with all clubs (sorted by carry_yards DESC). Inline add-club form.
- `GET /bags/:id/edit` + `POST /bags/:id` -- edit bag name and all clubs (delete-and-replace strategy on save)
- `POST /bags/:id/delete` -- cascading delete of bag and all clubs
- `POST /bags/:id/set-active` -- marks bag as active, deactivates all others for the user
- `POST /bags/:id/clubs` -- add club (name + carry yardage)
- `POST /bags/:bagId/clubs/:clubId/delete` -- remove individual club
- `GET /bags/import` -- import form (paste JSON)
- `POST /bags/import-seed` -- imports `bag_profile.json` format (player name → bag name, stock_carries_yards → clubs)

## Hole strategies

Per-user strategy planning for holes. Strategies are scoped to a hole and use clubs from a bag. All routes enforce user isolation.

- `GET /courses/:courseId/holes/:holeId/strategies` -- list user's strategies for a hole
- `GET /courses/:courseId/holes/:holeId/strategies/new` -- new strategy form (uses active bag's clubs with carry distances)
- `POST /courses/:courseId/holes/:holeId/strategies` -- create strategy with shots, preferred miss, no-go zones, notes. Requires bag_id.
- `GET /courses/:courseId/holes/:holeId/strategies/:strategyId` -- view strategy with shots, club names, carry distances
- `GET /courses/:courseId/holes/:holeId/strategies/:strategyId/edit` + `POST .../:strategyId` -- edit strategy metadata and shots (delete-and-replace on save)
- `POST /courses/:courseId/holes/:holeId/strategies/:strategyId/delete` -- delete strategy and all shots
