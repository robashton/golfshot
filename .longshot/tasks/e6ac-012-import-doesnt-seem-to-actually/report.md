# Task Report: Fix Overpass import for non-indexed relations

## Problem
`buildAreaQuery` used `map_to_area` which only works for OSM relations in Overpass's area index. Most golf course relations aren't indexed, causing HTTP 400 errors.

## Solution
Replaced `buildAreaQuery` with a three-strategy approach:

1. **Relations** (`buildRelationQuery`): Uses `rel(ID) >> ->.members; nwr.members["golf"];` to recurse into relation members and find golf-tagged elements directly, avoiding `map_to_area` entirely.

2. **Ways** (`buildWayQuery`): Fetches the way geometry, computes its centroid, then does a radius query around that centroid to find nearby golf features.

3. **Nodes**: Unchanged -- still uses radius query with provided coordinates.

**Fallback logic**: If a relation query returns no `golf=hole` elements, falls back to a radius query around the relation's centroid. If the way/relation query itself fails, falls back to radius query using provided lat/lon coordinates.

## Files changed
- `src/osm/overpass.ts` -- Replaced `buildAreaQuery` with `buildRelationQuery` + `buildWayQuery`, extracted `queryOverpass` helper, added `findCentroidFromElements` and `hasGolfElements` helpers, rewrote `fetchCourseData` with three-strategy approach and fallback logic.
- `tests/osm.test.ts` -- Updated way import test to mock two sequential fetch calls (way geometry + radius query).

## Test results
All 88 tests pass. Build is clean (no TypeScript errors).
