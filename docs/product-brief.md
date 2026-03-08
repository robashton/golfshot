# Golf Strategy Cards — Seed Pack

## Product summary
Build a golf course strategy-card generator with two distinct modes:

1. **Edit mode**
   - satellite basemap
   - click / drag to capture tee, green, hazards, layups, and optional fairway structure
   - save the resulting hole geometry as JSON

2. **Play mode**
   - clean simplified overhead rendering
   - projected dispersion ellipses and stock route
   - concise strategy notes
   - printable pocket cards / booklet pages

## Why this exists
Satellite maps are useful for capturing geometry but too noisy for on-course decision making.
The project should turn raw map geometry into a simple, printable, player-specific strategy book.

## Core workflow
1. Search/select a course
2. Load approximate hole structure from public data if available
3. Refine tee / green / hazards / layups manually in satellite edit mode
4. Apply player bag profile and dispersion model
5. Render simplified strategy cards
6. Export printable output

## Prototype sequence
- **Mearns Castle Golf Academy** first:
  - known course
  - easy to validate from memory
  - use holes 1 and 7 as golden fixtures
- **Mijas Golf Club – Los Lagos** second:
  - unfamiliar overhead view
  - public geometry/bootstrap data will matter more
  - final trip value is much higher

## Key principles
- Separate **geometry** from **strategy**
- Separate **authoring** from **consumption**
- Strategy view should optimize clarity, not visual realism
- Support multiple plans later from the same hole geometry:
  - safe
  - normal
  - aggressive
  - windy-day