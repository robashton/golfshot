# Golfshot

A golf course strategy-card generator. Capture hole geometry on a satellite basemap, then render simplified printable strategy cards tuned to a player's bag.

## Product concept

Two distinct modes:

1. **Edit mode** -- satellite basemap with click/drag capture for tee, green, hazards, layups, and fairway structure. Outputs JSON geometry.
2. **Play mode** -- clean simplified overhead rendering with projected dispersion ellipses, stock route, and strategy notes. Optimized for print.

The satellite editor is the authoring tool; the printable strategy cards are the real product.

## Target courses
- **Mearns Castle Golf Academy** -- validation course (known, easy to verify). Holes 1 and 7 are golden fixtures with seed data.
- **Mijas Golf Club - Los Lagos** -- real use case (unfamiliar course, will need public-data bootstrap).

## Architecture

### Data model (three independent concerns)

| Layer | Purpose | File |
|-------|---------|------|
| **Course geometry** | Structural facts: tee, green, fairway, hazards, key points | `data/mearns_castle_geometry.json` |
| **Bag profile** | Player-specific stock carries per club | `data/bag_profile.json` |
| **Strategy plan** | Per-hole decisions: stock route, aggressive option, no-go zones, preferred miss, notes | Not yet created |

Key principle: **geometry, player model, and strategy are separated**. Multiple strategy plans can derive from the same geometry + bag profile (safe, normal, aggressive, windy-day).

### Rendering split

| Mode | Basemap | Purpose | Interaction |
|------|---------|---------|-------------|
| Edit | Satellite imagery | Create/refine geometry | Click/drag markers, save/load JSON |
| Play | None (simplified render) | Support on-course decisions | View only, print-optimized |

Play mode normalizes orientation: tee at bottom, green toward top.

### Technical shape
- Web app with client-side map editing
- JSON-backed course/bag/plan files
- Static HTML export for strategy cards
- Later: PDF export
- No backend required for core workflow (file-based)

## Current seed data

### `data/bag_profile.json`
Player bag with 4 clubs:
- 8i: 145y, 7i: 155y, 7w: 190y, Driver: 230y
- Conservative position golf philosophy: mostly 7i/7w, driver only on safe holes

### `data/mearns_castle_geometry.json`
Two holes with lat/lng coordinates:
- **Hole 1** "Brook decision" (par 4, 385y) -- brook crosses fairway at ~180-190y; 8i stock tee shot
- **Hole 7** "False aggression" (par 4, 394y) -- driver adds dispersion without strategic value; 7w+7w is the smart play

Each hole has: tee, layup, green coordinates, hazard points (brookA/B), stock plan, and strategy notes.

## Design principles
- Separate geometry from strategy
- Separate authoring from consumption
- Strategy view optimizes clarity, not visual realism
- Support multiple plans from same geometry
- Printable pocket cards are the primary deliverable

## Planned implementation sequence
1. Project skeleton and schemas (TypeScript types for geometry, bag, strategy)
2. Edit mode (satellite basemap, marker capture, JSON save/load)
3. Strategy mode (simplified hole renderer, stock route, carry overlays)
4. Dispersion ellipses (projected shot ellipses aligned to hole direction)
5. Printable export (pocket cards, booklet pages, print CSS)
6. Public-data bootstrap (search/select course, approximate geometry from OSM/golf data)

## Repository structure
```
README.md                           -- seed pack manifest
docs/
  product-brief.md                  -- product vision and workflow
  architecture-notes.md             -- data model and rendering design
  initial-longshot-backlog.md       -- 6-task implementation plan
  chat-handoff-2026-03-08.md        -- prior conversation context and decisions
data/
  bag_profile.json                  -- player bag profile
  mearns_castle_geometry.json       -- seed hole geometry (Mearns holes 1 & 7)
```

No application code exists yet. The `src/` directory and `package.json` will be created in the first implementation task.
