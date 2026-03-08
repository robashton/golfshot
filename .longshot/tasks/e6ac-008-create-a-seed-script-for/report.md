# Completion Report: Dev seed script + migration infrastructure

## Summary

Implemented a numbered migration system (`src/db/migrate.ts` + `src/db/migrations/`) replacing the monolithic schema setup, and an idempotent dev seed script (`scripts/seed.ts`) that bootstraps the database with a dev user, course geometry, and bag profile.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/db/migrate.ts` | Added | Migration runner -- creates `schema_version` table, applies pending migrations in order inside a transaction |
| `src/db/migrations/001-initial-schema.ts` | Added | Initial schema migration (moved from `schema.ts`) -- all table DDL |
| `src/db/schema.ts` | Modified | `initializeDatabase()` now delegates to `runMigrations()` (body replaced, ~80 lines removed) |
| `scripts/seed.ts` | Added | Idempotent dev seed script -- creates DB, runs migrations, seeds dev user/course/bag |
| `package.json` | Modified | Added `"seed": "tsx scripts/seed.ts"` script |

## Diff from plan

No significant divergences from the task spec:

- Migration registry uses a static array as specified (no filesystem scanning)
- Idempotency uses SELECT-before-INSERT as specified
- `initializeDatabase()` delegates to `runMigrations()` as specified
- Test helper unchanged -- continues to work via `initializeDatabase()` → `runMigrations()`
- Down migrations omitted as specified

## Commits

- `6302402` -- agent work: Implemented migration infrastructure and idempotent dev seed script