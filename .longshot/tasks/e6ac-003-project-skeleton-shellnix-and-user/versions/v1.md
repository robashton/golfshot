# Project skeleton, shell.nix, and user auth

# Project skeleton, shell.nix, and user auth

## Scope

Bootstrap the server-side application from scratch. No application code exists yet -- only seed data in `data/` and docs in `docs/`.

## Deliverables

### shell.nix
- Provide Node.js (LTS), npm, and SQLite development headers
- User runs `nix-shell` to get a working dev environment

### Project skeleton
- `package.json` with TypeScript, a web framework (Hono or Express), and SQLite ORM (Drizzle or better-sqlite3)
- `tsconfig.json`
- `src/` directory structure: `src/index.ts` (entry), `src/routes/`, `src/db/`, `src/middleware/`
- Dev script (`npm run dev`) using tsx or ts-node
- Database schema file with at minimum a `users` table (id, email, password_hash, created_at)
- Database migration or init script

### User auth
- Registration endpoint: POST with email + password, hash password (bcrypt or argon2), create user
- Login endpoint: POST with email + password, verify hash, create session
- Logout endpoint: destroy session
- Session middleware: cookie-based sessions (express-session or equivalent)
- Auth guard middleware for protected routes
- Basic HTML forms for register/login (server-rendered, no SPA)

## Constraints
- SQLite database file stored locally (e.g. `data/golfshot.db`)
- Passwords hashed with bcrypt or argon2 (not plaintext)
- Sessions stored server-side (SQLite or in-memory for now)

## Acceptance criteria
- `nix-shell` drops into a shell with node, npm, sqlite available
- `npm install && npm run dev` starts the server
- Can register a new user, log in, see a protected page, log out
- Database schema includes users table
- Project structure is clean and idiomatic TypeScript
