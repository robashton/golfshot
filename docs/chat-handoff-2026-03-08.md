# Chat Handoff — 2026-03-08

## Current project idea
A golf course strategy-card generator:
- capture geometry on satellite in edit mode
- render simplified strategy cards in play mode
- print pocket cards / booklet pages

## What already worked
A browser prototype was built that:
- used a satellite basemap
- showed editable markers for Mearns Castle
- embedded config directly in HTML to avoid file:// JSON loading issues
- accepted updated coordinates for Mearns hole 1 and hole 7

## Current known player bag profile
- 8i: 145 planning carry
- 7i: 155 planning carry
- 7w: 190 planning carry
- Driver: 230 planning carry

## Current strategy logic
### Mearns hole 1
- Stock: 8i -> 7w -> wedge
- Brook crosses fairway around 180–190
- 7w off the tee is the awkward in-between shot
- Driver is the committed aggressive line only

### Mearns hole 7
- Stock: 7w -> 7w -> wedge / short iron
- Little real trouble at 190
- Driver adds little strategic value
- Right-side driver miss can finish awkwardly toward the 8th green

## Important design decisions
- Need two modes:
  - Edit mode with satellite imagery
  - Play mode with simplified rendering
- Click capture only truly helps in edit mode where tee/fairway/green are visible
- Printable cards are the real product, not the satellite editor itself
- Public golf/GPS/open map data should be used to bootstrap unfamiliar courses where possible
- Mearns is the validation course; Los Lagos is the real use case

## Suggested next implementation order
1. Create repo and seed docs
2. Build course/bag/plan schemas
3. Build edit mode
4. Build strategy mode
5. Add dispersion ellipses
6. Add printable export
7. Add public-data bootstrap for unfamiliar courses