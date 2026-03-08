# Hole strategy planner

# Hole strategy planner

## Scope

Given a hole (from a course) and the user's active bag, plan a shot-by-shot strategy.

## Data model

### Strategy
- id, user_id (FK), hole_id (FK), bag_id (FK), name (e.g. "safe", "aggressive", "windy day"), created_at

### StrategyShot
- id, strategy_id (FK), shot_number, club (text -- references club name from bag), target (lat/lng as JSON), notes

### Strategy metadata
- preferred_miss (text), no_go_zones (JSON array of descriptions), overall_notes (text)

Reference: `docs/architecture-notes.md` strategy plan concept -- stock route, aggressive option, no-go zones, preferred miss, notes.

## Features

### Create strategy for a hole
- Select a course and hole
- Uses the user's active bag to show available clubs and their carry distances
- Add shots sequentially: pick club, see carry distance, optionally set target coordinates, add notes
- Set preferred miss, no-go zones, overall notes
- Multiple strategies per hole allowed (safe, aggressive, etc.)

### View strategies
- List strategies for a hole
- View a single strategy with all shots, clubs, distances

### Edit/delete
- Edit strategy shots and metadata
- Delete a strategy

## Acceptance criteria
- Can create a strategy for a hole using clubs from active bag
- Strategy shows club names and carry distances from the bag
- Can have multiple strategies per hole
- Can view/edit/delete strategies
- All routes are auth-protected
- Data persists in SQLite
