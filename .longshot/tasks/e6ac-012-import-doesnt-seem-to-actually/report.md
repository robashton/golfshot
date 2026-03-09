# Task #e6ac-12: Fix Overpass import for non-indexed relations

## Summary

Replaced the broken `map_to_area`-based Overpass query with type-specific query strategies: member recursion for relations, centroid-based radius queries for ways, and direct radius queries for nodes. Added fallback logic so imports degrade gracefully when golf-tagged children aren't found.

## Changes

| File | Change |
|------|--------|
| `src/osm/overpass.ts` | Replaced `buildAreaQuery()` with `buildRelationQuery()` (member recursion) and `buildWayQuery()` (fetch geometry). Added `queryOverpass()`, `findCentroidFromElements()`, `hasGolfElements()` helpers. Rewrote `fetchCourseData()` with three-branch strategy (relation/way/node) and fallback logic. |
| `tests/osm.test.ts` | Updated test mocks to match new two-step query flow for ways (fetch geometry then radius query). Added comments clarifying mock setup. |

## Diff from plan

- The task spec suggested using `map_to_area` inside the relation query as a first attempt -- the implementation skipped this entirely and went straight to the member-recursion approach (`rel(ID) >> members`), which is the correct fix since `map_to_area` is the root cause of the failure.
- No other scope changes. All acceptance criteria met.

## Commits

- `cec7cec` -- agent work: Fixed Overpass import: replaced map_to_area with relation member recursion for relations and centroid-based radius queries for ways, with fallback logic
