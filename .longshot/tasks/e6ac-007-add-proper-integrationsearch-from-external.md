# Add proper integration/search from external golf map sources for import reasons

## Goal

Replace the "coming soon" placeholder on `/courses/import` with a working search-and-import flow backed by OpenStreetMap data. Users search for a golf course by name, see results, preview available data, and import it as a new course with hole-level geometry where available.

## Data source: OpenStreetMap (Nominatim + Overpass API)

OSM is the only source that provides free hole-level geometry (tee/green coordinates, par, yardage). No API key required. ODbL license (requires attribution).

### Search step -- Nominatim

```
GET https://nominatim.openstreetmap.org/search
  ?q={user_query}+golf
  &format=jsonv2
  &limit=10
  &addressdetails=1
```

Returns: `display_name`, `lat`, `lon`, `osm_type`, `osm_id`, `address` object.

Requirements:
- Set a descriptive `User-Agent` header (e.g. `Golfshot/1.0`)
- Rate limit to max 1 request/sec (server-side, not a concern for single-user app but good practice)

### Detail step -- Overpass API

Once the user selects a course, query Overpass for all golf features within/near that course:

```
[out:json][timeout:30];
(
  {osm_type}({osm_id});
)->.course;
.course map_to_area ->.courseArea;
(
  nwr["golf"](area.courseArea);
);
(.course; _; );
out geom;
```

This returns `golf=hole` ways (with `ref`, `par`, `dist` tags and node geometry), `golf=tee` and `golf=green` areas/nodes, `golf=bunker`, `golf=water_hazard`, etc.

If the course is a `node` (not a `way` or `relation`), fall back to a radius search:
```
[out:json][timeout:30];
(
  nwr["golf"](around:1500,{lat},{lon});
  nwr["leisure"="golf_course"](around:1500,{lat},{lon});
);
out geom;
```

### Parsing Overpass response into course data

From the Overpass response, extract:
- **Course name**: from the `leisure=golf_course` element's `name` tag
- **Location**: from the Nominatim `address` fields (city/town + country)
- **Holes**: from `golf=hole` ways:
  - `ref` tag → `hole_number`
  - `par` tag → `par`
  - `dist` tag → `yardage` (may need unit conversion if in meters)
  - First node of way → `tee` coordinates
  - Last node of way → `green` coordinates
- **Tees/Greens**: if `golf=tee` or `golf=green` areas exist, compute centroids and match to nearest hole
- **Hazards**: `golf=bunker`, `golf=water_hazard` → extract centroids, match to nearest hole by proximity

Not all courses have hole-level data mapped. Handle gracefully:
- If holes found: import full course with geometry
- If no holes found: import course shell (name + location only, 0 holes) -- user can add holes manually

## New routes

All routes protected by `requireAuth`.

### `GET /courses/import/search?q={query}`

Server-side handler that:
1. Queries Nominatim with the search term
2. Filters results to `leisure=golf_course` type (or includes all if few results)
3. Renders a results page with course name, location, and an "Import" button per result

### `GET /courses/import/preview?osm_type={type}&osm_id={id}&name={name}&location={location}`

Server-side handler that:
1. Queries Overpass API for golf features within the selected course
2. Parses the response into course + holes structure
3. Renders a preview page showing:
   - Course name and location
   - Number of holes found
   - Table of holes with: number, par, yardage, tee coords, green coords
   - "Import this course" button
   - "Back to search" link
4. If no hole data found, shows message: "No hole data found in OpenStreetMap. Course will be imported with name and location only."

### `POST /courses/import/osm`

Server-side handler that:
1. Receives the parsed course data (from hidden form fields or re-queries Overpass)
2. Creates course record in DB
3. Creates hole records with geometry
4. Redirects to `/courses/{id}`

Decision: Re-query Overpass on POST rather than passing large geometry through hidden fields. Simpler and avoids stale data issues. The `osm_type`, `osm_id`, `name`, and `location` are passed as form fields.

## New modules

### `src/osm/nominatim.ts`

```typescript
interface NominatimResult {
  osm_type: string
  osm_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    county?: string
    country?: string
  }
}

export async function searchGolfCourses(query: string): Promise<NominatimResult[]>
```

Uses `fetch` (Node 18+ built-in). Sets `User-Agent: Golfshot/1.0`.

### `src/osm/overpass.ts`

```typescript
interface ParsedCourse {
  name: string
  location: string
  holes: ParsedHole[]
}

interface ParsedHole {
  number: number
  par: number
  yardage: number
  tee?: { lat: number; lng: number }
  green?: { lat: number; lng: number }
  hazards?: Array<{ name: string; lat: number; lng: number }>
}

export async function fetchCourseData(osmType: string, osmId: number, fallbackLat?: number, fallbackLon?: number): Promise<ParsedCourse>
```

Builds Overpass query, fetches, parses elements by `golf` tag value, matches tees/greens/hazards to holes.

## UI changes

### Import page (`/courses/import`)

Add a search form above the existing seed JSON import section:

```
<h2>Search OpenStreetMap</h2>
<form method="GET" action="/courses/import/search">
  <input type="text" name="q" placeholder="Course name..." required>
  <button type="submit">Search</button>
</form>
```

### Search results page (`/courses/import/search`)

List of results, each showing:
- Course name (bold)
- Location (from address)
- "Preview & Import" link → `/courses/import/preview?osm_type=...&osm_id=...`

### Preview page (`/courses/import/preview`)

- Course name, location
- Hole table (number, par, yardage, tee lat/lng, green lat/lng)
- Import button (POST form to `/courses/import/osm`)
- Attribution: "Data from OpenStreetMap contributors (ODbL)"

## Attribution

OSM ODbL requires attribution. Add a small footer note on any page showing imported data:
- On the preview page: "Data © OpenStreetMap contributors"
- On course detail page: not needed (data is now in our DB, attribution was shown at import time)

## Tests

Add tests in `tests/osm.test.ts`:
- **Nominatim response parsing**: mock fetch, verify `searchGolfCourses` returns structured results
- **Overpass response parsing**: mock fetch with realistic Overpass JSON, verify hole extraction (par, yardage, tee/green coords)
- **Overpass node fallback**: verify radius-based query is used when OSM element is a node
- **Empty course handling**: verify graceful handling when Overpass returns no `golf=hole` elements
- **Import route**: integration test -- mock OSM APIs, POST to `/courses/import/osm`, verify course + holes created in DB

## Scope boundaries

**In scope:**
- OSM search + preview + import flow
- Hole geometry extraction from `golf=hole` ways
- Tee/green matching from `golf=tee`/`golf=green` areas
- Hazard extraction from `golf=bunker`/`golf=water_hazard`
- Basic error handling (network errors, no results, malformed responses)

**Out of scope:**
- Google Places API integration (would need API key + billing)
- Commercial golf APIs (GolfAPI.io, GolfCourseAPI.com)
- Fairway polygon extraction (complex geometry, not needed for initial import)
- Satellite basemap display in preview (that's edit mode, a separate task)
- Caching of OSM responses
- Deduplication against existing courses in DB

## Acceptance criteria

1. User can search for a golf course by name from `/courses/import`
2. Search results show course names and locations from OSM
3. User can preview a selected course -- sees hole count, par, yardage, coordinates
4. User can import the course -- creates course + holes in DB with geometry
5. Courses with no hole data in OSM import as name+location only (0 holes)
6. OSM attribution shown on preview page
7. Existing seed JSON import continues to work unchanged
8. Tests pass for OSM parsing logic and import route

## Files to create/modify

- **Create** `src/osm/nominatim.ts` -- Nominatim search wrapper
- **Create** `src/osm/overpass.ts` -- Overpass query + response parser
- **Modify** `src/routes/courses.ts` -- add search/preview/import routes, update import page HTML
- **Create** `tests/osm.test.ts` -- tests for OSM integration
