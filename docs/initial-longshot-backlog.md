# Initial Longshot Task Backlog

## Task 1 — Create project skeleton and schemas
**Goal**
Set up the repository layout and JSON schemas for course geometry, bag profile, and strategy plans.

**Acceptance criteria**
- repo has `docs/`, `data/`, and `src/` or `app/`
- JSON schema or TypeScript types exist for:
  - course geometry
  - bag profile
  - strategy plan
- seed data committed for Mearns holes 1 and 7
- README explains the architecture at a high level

## Task 2 — Build edit mode
**Goal**
Create a map editor page with a satellite basemap and point capture for tee, green, hazards, and layups.

**Acceptance criteria**
- can load a course JSON file
- can display satellite imagery
- can add / move markers
- can save updated JSON
- works for Mearns holes 1 and 7
- file-based workflow works locally without backend dependency where possible

## Task 3 — Build strategy mode
**Goal**
Create a clean simplified hole renderer from the same JSON.

**Acceptance criteria**
- tee rendered at bottom, green toward top
- hazards shown simply
- stock route shown clearly
- stock carry overlays supported
- hole 1 and 7 produce legible strategy cards
- no satellite imagery in strategy mode

## Task 4 — Add projected dispersion ellipses
**Goal**
Replace radial carry rings in strategy mode with projected shot ellipses aligned to hole direction.

**Acceptance criteria**
- per-club ellipse model supported
- ellipses orient along the intended shot line
- overlap with hazards can be visualized
- cards are clearer than simple circles

## Task 5 — Printable export
**Goal**
Generate printable pocket cards and booklet pages.

**Acceptance criteria**
- one-hole card export
- multi-hole page export
- print CSS works cleanly
- Mearns holes 1 and 7 can be printed from browser or exported to PDF

## Task 6 — Public-data bootstrap
**Goal**
Seed approximate hole geometry from public map/golf datasets where available.

**Acceptance criteria**
- search/select course flow exists
- if public hole geometry is available, approximate shapes load automatically
- user can refine geometry manually afterward
- workflow suitable for unfamiliar courses like Los Lagos