# Seed data & course import

## Seed JSON import (`/courses/import-seed`)

### `data/bag_profile.json`
Player bag with 4 clubs:
- 8i: 145y, 7i: 155y, 7w: 190y, Driver: 230y
- Conservative position golf philosophy: mostly 7i/7w, driver only on safe holes

### `data/mearns_castle_geometry.json`
Two holes with lat/lng coordinates:
- **Hole 1** "Brook decision" (par 4, 385y) -- brook crosses fairway at ~180-190y; 8i stock tee shot clears it
- **Hole 7** (par 3, 155y) -- short par 3 with direct tee-to-green geometry

## OpenStreetMap import (`/courses/import/search`)

Search-and-import flow for discovering real courses. Searches Nominatim, previews hole data from Overpass API (par, yardage, tee/green coordinates, hazards), and imports into DB. Courses without hole-level mapping in OSM import as name+location only.