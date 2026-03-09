# Add file-based logging for request errors and import diagnostics

## Problem

There is no logging in the app. The only `console.log` is the server startup message (`src/index.ts:10`). When course imports fail (OSM search, preview, or import), errors are passed to Express's default error handler via `next(err)` with no logging -- they vanish. The user sees a generic 500 page with no way to diagnose what went wrong.

## Current state

- **No logging library or module** -- nothing in `src/` handles logging
- **No Express error handler** -- `src/app.ts` registers routes but has no error-handling middleware, so `next(err)` hits Express's built-in handler
- **Three async import routes** silently swallow errors via `next(err)`:
  - `GET /courses/import/search` -- calls Nominatim (`src/osm/nominatim.ts`)
  - `GET /courses/import/preview` -- calls Overpass (`src/osm/overpass.ts`)
  - `POST /courses/import/osm` -- calls Overpass + DB transaction
- **External API calls** (`fetch` to Nominatim/Overpass) throw on non-OK responses but the error message/status is not captured anywhere persistent

## Approach

### 1. Create `src/logger.ts` -- a simple file-based logger

No external dependencies. Write a small module that:
- Appends log lines to `data/golfshot.log` (alongside the existing `data/golfshot.db`)
- Format: `[ISO timestamp] [LEVEL] message` (one line per entry, multi-line details indented)
- Levels: `info`, `warn`, `error`
- Exports a `logger` object with `.info()`, `.warn()`, `.error()` methods
- Also writes to `console.error`/`console.log` so dev server output still works
- Synchronous append via `fs.appendFileSync` -- simple, no buffering complexity, fine for this traffic level

### 2. Add Express error-handling middleware in `src/app.ts`

Register a 4-argument `(err, req, res, next)` handler at the end of the middleware chain that:
- Logs the error (method, URL, status, message, stack) via the logger
- Renders a user-friendly error page instead of Express's raw HTML dump
- Uses the existing `layout()` for consistent styling

### 3. Add request logging for import routes

In the three import route handlers in `src/routes/courses.ts`, log:
- Incoming request details (search query, OSM type/id)
- External API call results (success/failure, response status)
- Import outcomes (course created, hole count)

This gives diagnostic context when imports fail -- the log will show what was requested, what the external API returned, and where it broke.

### 4. Replace startup `console.log` with logger

Swap the `console.log` in `src/index.ts` to use the new logger for consistency.

## Files to modify

- **`src/logger.ts`** -- new file, the logger module
- **`src/app.ts`** -- add error-handling middleware at end of chain
- **`src/routes/courses.ts`** -- add logging in import route handlers
- **`src/index.ts`** -- use logger for startup message
- **`src/osm/overpass.ts`** -- log Overpass query details on failure
- **`src/osm/nominatim.ts`** -- log Nominatim query details on failure

## Acceptance criteria

- [ ] `data/golfshot.log` is created on first log write and appended to thereafter
- [ ] All unhandled Express errors are logged with timestamp, method, URL, and stack trace
- [ ] A user-friendly error page is shown instead of Express's default HTML stack dump
- [ ] Import search/preview/import actions log their parameters and outcomes
- [ ] Overpass and Nominatim failures log the query and HTTP status
- [ ] Server startup is logged to file
- [ ] No new dependencies added -- uses Node built-in `fs`
