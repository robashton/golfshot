# Fix: Overpass import fails with map_to_area on non-indexed relations

## Problem

Course import fails at preview stage with HTTP 400 from the Overpass API. The error occurs in `src/osm/overpass.ts:buildAreaQuery()` (line 40) which generates a query using `map_to_area`:

```
.course map_to_area ->.courseArea;
```

`map_to_area` only works for OSM relations that have been pre-processed into Overpass's area index (primarily administrative boundaries and well-known multipolygons). Most `leisure=golf_course` relations are **not** in that index, so the query returns HTTP 400.

Observed with: `relation/16381783` (Mijas Golf, Spain).

## Approach

Replace `buildAreaQuery` with a two-strategy approach:

1. **For relations**: Query the relation directly and fetch all its members + nearby golf features using the relation's bounding box, rather than trying to convert to an area. Something like:

```
[out:json][timeout:30];
rel(OSMID);
out geom;
rel(OSMID);
map_to_area ->.a;
(
  nwr["golf"](area.a);
);
out geom;
```

This won't work either since the same `map_to_area` issue applies. Instead, use:

```
[out:json][timeout:30];
rel(OSMID)->.course;
.course out geom;
.course >> ->.members;
nwr.members["golf"];
out geom;
```

This fetches the relation geometry and then recurses down (`>>`) to get all member elements, filtering for those with a `golf` tag.

2. **Fallback**: If the relation itself doesn't yield golf-tagged children (some courses are mapped as a single polygon without sub-features), fall back to a radius query around the relation's centroid -- reusing the existing `buildRadiusQuery`.

3. **For ways**: Ways can't use `map_to_area` either in most cases. Apply the same radius-based fallback using the way's centroid coordinates.

## Files to change

- `src/osm/overpass.ts` -- Replace `buildAreaQuery` with a relation-member-based query. Add fallback logic in `fetchCourseData` to retry with radius query if the first attempt returns no golf elements.

## Acceptance criteria

- Importing a relation-based golf course (e.g. `relation/16381783`) successfully returns a preview with holes
- Importing a way-based golf course still works
- Node-based imports (radius query) are unaffected
- If a relation has no golf-tagged children, the system falls back to a radius query using the centroid
- No regression for courses that previously imported successfully
