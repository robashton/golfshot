# Dev seed script + migration infrastructure

## Context

The app currently creates tables via `CREATE TABLE IF NOT EXISTS` in `src/db/schema.ts:initializeDatabase()`. This works for fresh DBs but doesn't support schema changes on existing databases. Tests use in-memory SQLite via `tests/helpers.ts:createTestContext()`.

The dev database lives at `data/golfshot.db` (see `src/db/connection.ts:9`). There's no seed script -- developers must manually register a user and import seed data through the UI.

Seed data already exists in `data/bag_profile.json` and `data/mearns_castle_geometry.json`.

## Scope

Two deliverables:

### 1. Dev seed script (`scripts/seed.ts`)

A CLI script runnable via `npx tsx scripts/seed.ts` (add an `npm run seed` shortcut). Idempotent -- safe to run repeatedly.

Steps:
1. Create the DB file at `data/golfshot.db` if it doesn't exist
2. Run all migrations (see below)
3. Create a dev user (`dev@golfshot.local` / `password`) if not already present
4. Import `data/mearns_castle_geometry.json` as a course owned by the dev user, if that course doesn't already exist (match on course name)
5. Import `data/bag_profile.json` as a bag for the dev user, set it active, if no bag exists for the user
6. Print a summary of what was created vs skipped

### 2. Migration infrastructure (`src/db/migrations/`)

Replace the monolithic `schema.ts` with a numbered migration system:

- Each migration is a `.ts` file in `src/db/migrations/` named `001-initial-schema.ts`, `002-whatever.ts`, etc.
- A `schema_version` table tracks which migrations have been applied
- `src/db/migrate.ts` exports a `runMigrations(db)` function that applies pending migrations in order inside a transaction
- Migration 001 contains the current schema from `schema.ts` (the full `CREATE TABLE IF NOT EXISTS` block)
- `initializeDatabase()` in `schema.ts` is replaced with a call to `runMigrations()`
- Test helper continues to work -- `createTestContext()` should call `runMigrations()` on the in-memory DB

Each migration file exports `{ up(db): void }`. Down migrations are not needed -- this is a dev tool for SQLite, not a production ORM.

## Approach

1. Create `src/db/migrations/001-initial-schema.ts` -- move the existing SQL from `schema.ts` into it
2. Create `src/db/migrate.ts` -- migration runner that:
   - Creates `schema_version` table if not exists
   - Reads all migration files from the migrations directory
   - Applies any not yet recorded in `schema_version`, in order
   - Records each applied migration with a timestamp
3. Update `src/db/schema.ts` -- replace `initializeDatabase` body with a call to `runMigrations()`
4. Update `tests/helpers.ts` -- no change needed if `initializeDatabase` still works
5. Create `scripts/seed.ts` -- the seed script described above
6. Add `"seed": "tsx scripts/seed.ts"` to `package.json` scripts

## Key decisions

- Migration files are imported statically (a registry array in `migrate.ts`) rather than dynamically scanned from the filesystem -- simpler, works with both tsx and compiled JS, no dynamic import issues
- The seed script reuses the existing import logic patterns from `src/routes/courses.ts` and `src/routes/bags.ts` (same SQL insert patterns) rather than calling HTTP endpoints
- Idempotency is by name-check (`SELECT` before `INSERT`), not by `INSERT OR IGNORE`

## Acceptance criteria

- [ ] `npm run seed` creates the DB, schema, dev user, course, and bag on a clean slate
- [ ] Running `npm run seed` a second time prints "already exists" for each item and changes nothing
- [ ] `runMigrations()` is the single entrypoint for schema setup (used by seed, app startup, and tests)
- [ ] Existing tests pass without changes (79 tests)
- [ ] A new migration (e.g. `002-add-column.ts`) can be added and will apply on next `runMigrations()` call
