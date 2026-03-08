# Completion Report: Add OSM golf course search and import

## Summary

Implemented a full search-and-import flow for golf courses backed by OpenStreetMap data. Users can search for courses by name via Nominatim, preview hole-level geometry from Overpass API (par, yardage, tee/green coordinates, hazards), and import courses with full hole data into the database.

## Changes

### Created
- `src/osm/nominatim.ts` -- Nominatim search wrapper. Queries OSM for golf courses by name, returns structured results with address details. Sets `User-Agent: Golfshot/1.0`.
- `src/osm/overpass.ts` -- Overpass API query builder and response parser. Builds area-based queries for way/relation courses, radius-based queries for node courses. Parses `golf=hole` ways into hole data (par, yardage with meter→yard conversion, tee/green from way endpoints). Matches standalone `golf=tee`/`golf=green` elements and `golf=bunker`/`golf=water_hazard` to nearest holes.
- `tests/osm.test.ts` -- 9 tests covering Overpass response parsing (hole extraction, fallback names, empty courses, tee/green matching, hazard matching, hole sorting) and import route integration (full import, empty import, validation).

### Modified
- `src/routes/courses.ts` -- Added three new routes: `GET /courses/import/search` (Nominatim search results page), `GET /courses/import/preview` (Overpass-powered course preview with hole table), `POST /courses/import/osm` (re-queries Overpass and creates course + holes in DB). Updated import page to include OSM search form above existing seed JSON import. Removed "coming soon" placeholder.
- `tests/courses.test.ts` -- Minor adjustment (4 lines changed).

## Diff from plan

The implementation closely followed the task spec. Minor differences:

- **Overpass re-query on POST**: As specified, the import POST re-queries Overpass rather than passing geometry through hidden form fields. The `osm_type`, `osm_id`, `name`, `location`, `lat`, and `lon` are passed as form fields.
- **`fetchCourseData` signature**: Added `fallbackName` and `fallbackLocation` as direct parameters (spec had them implicit). This avoids a second Nominatim lookup on the detail/import steps.
- **No separate `src/osm/` index file**: The two modules are imported directly by the courses router. No barrel export needed.
- **All acceptance criteria met**: search, preview, import with holes, import without holes, OSM attribution on preview page, existing seed import unchanged, 88/88 tests passing.

## Commits

- `4e32582` -- agent work: Implemented OSM golf course search and import: Nominatim search, Overpass preview with hole geometry, and import to DB. 88/88 tests passing.
