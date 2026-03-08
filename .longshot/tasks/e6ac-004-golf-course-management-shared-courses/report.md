# Completion Report: Golf course management (shared courses + holes)

## Summary

Implemented full CRUD for golf courses and their holes, including seed data import from `mearns_castle_geometry.json` and a placeholder import-from-open-data route. All routes are auth-protected. 17 new tests added (40 total pass).

## Changes

### Added
- `src/routes/courses.ts` -- Course + hole CRUD routes, seed import endpoint, import stub page. Server-rendered HTML forms for all operations.
- `tests/courses.test.ts` -- 17 tests covering course CRUD, hole CRUD, seed import, auth protection, and edge cases.

### Modified
- `src/app.ts` -- Registered course routes on `/courses`.
- `src/db/schema.ts` -- Added `courses` and `holes` table creation (with FK, cascading delete, unique constraint on course_id+hole_number).
- `src/routes/dashboard.ts` -- Added link to courses list from dashboard.

## Diff from plan

No significant divergence from the task spec:
- All planned features were implemented: create/view/edit/delete courses, add/edit/delete holes with geometry, seed import, import stub.
- Geometry stored as JSON column matching the spec (tee, green, hazards, layups, fairway_points).
- The seed importer parses `mearns_castle_geometry.json` format, mapping tee/green/layup coords and treating unknown coordinate pairs as hazards -- this interpretation was a reasonable design choice not explicitly specified.

## Commits

- `95e88e6` -- Implemented golf course management: CRUD for courses + holes, seed data import, import stub. 17 new tests, all 40 pass.
- `208e691` -- Updated project spec and wrote completion report for task #e6ac-4.
- `5db2890` -- pre-merge: save uncommitted changes.
- `00cde57` -- No merge conflicts found in working tree.
