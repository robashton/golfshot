# Golfshot

A golf course strategy-card generator. Capture hole geometry on a satellite basemap, then render simplified printable strategy cards tuned to a player's bag.

## Product concept

Two distinct modes:
1. **Edit mode** -- Leaflet satellite basemap (ESRI World Imagery) with interactive toolbar for placing tee, green, hazard, layup markers and fairway outline points. Drag to reposition, right-click to rename/delete. Syncs to hidden form fields for server-side persistence. Implemented as `public/map-editor.js`.
2. **Play mode** -- clean simplified overhead rendering with projected dispersion ellipses, stock route, and strategy notes. Optimized for print. *(not yet built)*

The satellite editor is the authoring tool; the printable strategy cards are the real product.

## Target courses
- **Mearns Castle Golf Academy** -- validation course (known, easy to verify). Holes 1 and 7 are golden fixtures with seed data.
- **Mijas Golf Club - Los Lagos** -- real use case (unfamiliar course, will need public-data bootstrap).

## Design principles
- Separate geometry from strategy
- Separate authoring from consumption
- Strategy view optimizes clarity, not visual realism
- Support multiple plans from same geometry
- Printable pocket cards are the primary deliverable

## Spec sections
- [Architecture](spec/architecture.md) -- tech stack, data model, rendering
- [Database schema](spec/database.md) -- all table definitions
- [API routes](spec/api-routes.md) -- auth, courses, bags, strategies endpoints
- [Seed data & dev setup](spec/seed-data.md) -- dev seed script, migration infrastructure, seed JSON files
- [Implementation](spec/implementation.md) -- sequence, file structure
