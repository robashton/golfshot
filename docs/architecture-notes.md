# Architecture Notes

## Data model split
### 1. Course geometry
Structural facts about the hole:
- tee
- green
- fairway geometry or centerline
- hazards
- key structural points

### 2. Bag profile
Player-specific shot model:
- stock carries
- later: dispersion width/depth
- later: miss bias

### 3. Strategy plan
Per-hole recommended decisions:
- stock route
- aggressive option
- no-go zones
- preferred miss
- short notes

## Rendering split
### Edit mode
Purpose: create or refine geometry
- satellite imagery visible
- capture points and polygons
- live coordinates
- save/load JSON

### Play mode
Purpose: support decisions
- simplified rendering
- fairway ribbon / hazard bands
- projected dispersion ellipses
- stock route line
- traffic-light notes
- printable layout

## Immediate technical shape
- Web app with client-side map editing
- JSON-backed course/bag/plan files
- Static HTML export for strategy cards
- Later: PDF export

## Long-term upgrades
- Public OSM / golf-data bootstrap for approximate hole geometry
- Hole orientation normalization (tee at bottom, green at top)
- Hazard-overlap calculation against dispersion ellipses
- Multiple strategy presets from same geometry