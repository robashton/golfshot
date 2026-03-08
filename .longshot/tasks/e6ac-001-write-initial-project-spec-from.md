# Write initial project spec from codebase analysis

## Scope
Read all seed materials in the repository and produce a comprehensive `.longshot/spec.md` that serves as the single reference document for future agents working on this codebase.

## Current state
The repository is **pre-code** -- it contains only seed documentation and data:
- `README.md` -- seed pack manifest
- `docs/product-brief.md` -- product vision and workflow
- `docs/architecture-notes.md` -- data model and rendering split
- `docs/initial-longshot-backlog.md` -- 6-task implementation plan
- `docs/chat-handoff-2026-03-08.md` -- prior conversation context
- `data/bag_profile.json` -- player bag profile (4 clubs)
- `data/mearns_castle_geometry.json` -- hole geometry for Mearns Castle holes 1 and 7

No `src/`, `package.json`, or application code exists yet.

## Approach
1. Synthesize all seed docs into a structured project spec covering:
   - What the project is (product summary)
   - Architecture (data model split, rendering modes, tech shape)
   - Key files and their roles
   - Seed data overview
   - Design principles and constraints
   - Planned implementation sequence
2. Write the spec as `.longshot/spec.md` using the `writeProjectSpec` MCP tool
3. Structure spec with clear sections that future tasks can reference

## Acceptance criteria
- `.longshot/spec.md` is populated with a comprehensive, well-structured spec
- Spec covers: product summary, architecture, data model, key files, tech stack, design principles, and planned sequence
- Spec accurately reflects what exists in the repo (no fabricated details)
- Spec is concise enough to serve as a quick reference, detailed enough to orient a new agent
- No overlap with existing tasks (this is the only task)
