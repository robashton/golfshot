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
- [Seed data](spec/seed-data.md) -- bag_profile.json, mearns_castle_geometry.json
- [Implementation](spec/implementation.md) -- sequence, file structure
