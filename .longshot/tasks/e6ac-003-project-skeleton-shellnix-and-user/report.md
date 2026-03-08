# Completion Report: Project skeleton, shell.nix, and user auth

## Summary

Bootstrapped the full server-side application from scratch: Express/TypeScript project skeleton with nix-shell dev environment, SQLite database with users and sessions tables, cookie-based authentication (register/login/logout with bcrypt), and 23 passing tests covering all endpoints, middleware, and business logic.

## Changes

### New files
- `shell.nix` -- nix dev environment providing Node.js 22 and SQLite
- `package.json` -- project deps (express, better-sqlite3, bcrypt, express-session) and dev deps (typescript, tsx, vitest, supertest)
- `tsconfig.json` -- strict TypeScript config, ES2022 target, Node16 modules
- `vitest.config.ts` -- test runner configuration
- `CLAUDE.md` -- development guide documenting quality requirements, conventions, directory structure, and workflow
- `src/index.ts` -- server entry point (port 3000, graceful shutdown)
- `src/app.ts` -- Express app factory (exported for testing)
- `src/db/schema.ts` -- database schema (users + sessions tables, WAL mode, foreign keys)
- `src/db/connection.ts` -- database connection management (singleton + factory)
- `src/db/session-store.ts` -- custom SQLite-backed express-session store
- `src/middleware/auth-guard.ts` -- `requireAuth` middleware + session type augmentation
- `src/routes/auth.ts` -- register, login, logout endpoints with server-rendered HTML forms
- `src/routes/dashboard.ts` -- protected dashboard page
- `tests/helpers.ts` -- test context factory (in-memory DB + app instance)
- `tests/schema.test.ts` -- 4 tests (table structure, constraints, idempotency)
- `tests/auth.test.ts` -- 13 tests (register, login, logout happy paths + error cases)
- `tests/auth-guard.test.ts` -- 3 tests (redirect, allow, email display)
- `tests/password.test.ts` -- 3 tests (hash, verify, reject)

### Modified files
- `.gitignore` -- added `data/*.db`, `data/*.db-wal`, `data/*.db-shm`
- `.longshot/spec.md` -- updated with technical stack, auth details, database schema, file tree

## Diff from plan

No significant divergences. All deliverables from the task spec were implemented:
- CLAUDE.md written first (as specified)
- shell.nix with Node.js and SQLite
- Full project skeleton with correct directory structure
- All auth endpoints (register, login, logout) with validation
- Session middleware with SQLite store
- Auth guard middleware
- Server-rendered HTML forms
- Comprehensive test suite (23 tests)

Minor implementation details not specified in the plan:
- Used Node.js 22 (current LTS) in shell.nix
- Added `dashboard.ts` as the protected route (spec said "protected page" generically)
- Session store implements `touch()` for session expiry extension
- Password minimum length set to 8 characters

## Commits

- `9e7b1ac` -- agent work: Bootstrapped project skeleton with Express server, SQLite database, user auth (register/login/logout), and 23 passing tests
- `e18ddf3` -- agent work: Reviewed project spec (already accurate from implementation phase) and wrote completion report for task #e6ac-3
