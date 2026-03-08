# Seed data & dev setup

## Dev seed script (`npm run seed`)

Runs `scripts/seed.ts` via tsx. Idempotent -- safe to run repeatedly. Steps:

1. Creates `data/golfshot.db` if it doesn't exist
2. Runs all migrations via `runMigrations()`
3. Creates dev user (`dev@golfshot.local` / `password`) if not present
4. Imports `data/mearns_castle_geometry.json` as a course (matched by name)
5. Imports `data/bag_profile.json` as an active bag for the dev user (skipped if user already has a bag)
6. Prints summary of created vs skipped items

## Migration infrastructure

- Migration files live in `src/db/migrations/`, named `001-initial-schema.ts`, `002-whatever.ts`, etc.
- Each exports `{ up(db): void }`
- `src/db/migrate.ts` exports `runMigrations(db)` -- creates `schema_version` table, applies pending migrations in order inside a transaction
- Migrations are registered statically in a registry array (no dynamic filesystem scanning)
- `initializeDatabase()` in `schema.ts` delegates to `runMigrations()` -- single entrypoint for app startup, tests, and seed script

## Seed JSON files

### `data/bag_profile.json`
Player bag with 4 clubs:
- 8i: 145y, 7i: 155y, 7w: 190y, Driver: 230y
- Conservative position golf philosophy: mostly 7i/7w, driver only on safe holes

### `data/mearns_castle_geometry.json`
Two holes with lat/lng coordinates:
- **Hole 1** "Brook decision" (par 4, 385y) -- brook crosses fairway at ~180-190y; 8i stock tee shot clears it
- **Hole 7** (par 3, 155y) -- short par 3 with direct tee-to-green geometry

## OpenStreetMap import (`/courses/import/search`)

Search-and-import flow for discovering real courses. Searches Nominatim, previews hole data from Overpass API (par, yardage, tee/green coordinates, hazards), and imports into DB. Courses without hole-level mapping in OSM import as name+location only.