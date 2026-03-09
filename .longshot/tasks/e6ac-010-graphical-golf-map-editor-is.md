# Graphical satellite map editor for hole geometry

## Context

The app currently captures hole geometry (tee, green, hazards, layups) via raw lat/lng text fields in `src/routes/courses.ts` (lines ~649-742). There is no visual editing -- users must know GPS coordinates. The project spec (architecture.md) calls for an "Edit mode" with satellite imagery and click/drag markers, but nothing has been built yet.

The user wants a self-contained graphical editor, inspired by the kind of thing ChatGPT produces as a single HTML file -- a Leaflet-based satellite map with interactive marker placement.

## Scope

Build an inline satellite map editor that replaces the text-field geometry input on the hole create/edit forms. The editor should be a self-contained JavaScript component served as a static file, embedded into the existing server-rendered HTML pages.

### What to build

1. **Static JS/CSS file** (`public/map-editor.js` + `public/map-editor.css`) -- a Leaflet-based map editor component
2. **Satellite tile layer** -- use a free satellite imagery provider (ESRI World Imagery or similar, no API key required)
3. **Interactive marker placement** for:
   - **Tee** (single marker, green colour)
   - **Green** (single marker, red/flag colour)
   - **Hazards** (multiple markers, yellow/warning, each with a name label)
   - **Layups** (multiple markers, blue, each with a name label)
   - **Fairway outline** (polyline/polygon from clicked points -- this field exists in the schema but has no UI yet)
4. **Integration with existing forms** -- the editor reads/writes hidden form fields matching the current field names (`tee_lat`, `tee_lng`, `green_lat`, `green_lng`, `hazard_name_N`, `hazard_lat_N`, `hazard_lng_N`, etc.) so the existing POST handler works unchanged
5. **Serve static files** -- add `express.static('public')` to `src/app.ts`
6. **Update hole forms** -- replace the raw coordinate fields in courses.ts with a `<div id="map-editor">` container and a `<script>` tag that initialises the editor

### Map editor features

- Map centres on existing geometry if editing, or on a sensible default (course location / Scotland) if creating
- Click map in a mode to place markers: toolbar/buttons to select what you're placing (tee, green, hazard, layup, fairway point)
- Drag markers to reposition
- Click existing marker to delete or rename (for hazards/layups)
- Fairway points form a polyline showing the fairway shape
- All changes sync to hidden form fields in real-time
- When editing an existing hole, the editor initialises from the current geometry JSON

### Out of scope

- Play mode / simplified rendering (separate future task)
- Dispersion ellipses
- Strategy shot target placement on the map
- Mobile-optimised touch interactions (desktop-first is fine)

## Key files to modify

- `src/app.ts` -- add static file serving
- `src/routes/courses.ts` -- replace text-field geometry in hole new/edit forms with map editor div
- **New**: `public/map-editor.js` -- the Leaflet map editor
- **New**: `public/map-editor.css` -- editor styling

## Dependencies

- **Leaflet** -- loaded via CDN (`<link>` and `<script>` tags in the HTML), no npm install needed
- **ESRI World Imagery** tiles (free, no API key) -- `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`

## Geometry JSON contract

Must match the existing `holes.geometry` schema (database.md):

```json
{
  "tee": { "lat": 55.770297, "lng": -4.2894959 },
  "green": { "lat": 55.7717575, "lng": -4.2844963 },
  "hazards": [{ "name": "Brook A", "lat": 55.7706712, "lng": -4.2860842 }],
  "layups": [{ "name": "Layup", "lat": 55.770768, "lng": -4.2879295 }],
  "fairway_points": [{ "lat": 55.7705, "lng": -4.2890 }, ...]
}
```

The form POST handler in `courses.ts` (`buildGeometryFromBody`, line ~491) already parses `tee_lat`, `tee_lng`, `hazard_name_N`, `hazard_lat_N`, `hazard_lng_N` (indices 0-19), `layup_name_N`, `layup_lat_N`, `layup_lng_N` (indices 0-19). The map editor must write to these same field names.

**Fairway points** need a new parsing addition to `buildGeometryFromBody` since no form fields exist for them today. Add `fairway_lat_N` / `fairway_lng_N` fields.

## Acceptance criteria

- [ ] Opening hole create form shows a satellite map instead of raw coordinate fields
- [ ] Opening hole edit form shows the map with existing markers pre-placed
- [ ] Can click to place tee and green markers, drag to reposition
- [ ] Can add multiple named hazard markers
- [ ] Can add multiple named layup markers
- [ ] Can draw fairway outline points
- [ ] Saving the form persists all geometry correctly to the database
- [ ] Existing holes with geometry still load and display correctly
- [ ] No npm dependencies added (Leaflet via CDN)
- [ ] Works in Chrome/Firefox on desktop

## Related

- Implementation sequence step 7 in spec/implementation.md
- Task #e6ac-9 (styling) is in progress -- coordinate on any CSS conflicts
