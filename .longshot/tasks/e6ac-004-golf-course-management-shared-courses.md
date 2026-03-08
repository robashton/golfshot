# Golf course management (shared courses + holes)

# Golf course management

## Scope

CRUD for golf courses and their holes. Courses are shared between all users (any logged-in user can create/view courses).

## Data model

### Course
- id, name, location (text description), created_by (user FK), created_at

### Hole
- id, course_id (FK), hole_number, par, yardage
- geometry: tee (lat/lng), green (lat/lng), hazards (array of {name, lat, lng}), layups (array of {name, lat, lng}), fairway_points (array of lat/lng) -- stored as JSON column

Reference: `data/mearns_castle_geometry.json` for the geometry structure.

## Features

### Create course manually
- Form: course name, location
- Then add holes one by one: hole number, par, yardage, tee coords, green coords
- Hazards and layups can be added per hole (name + lat/lng)

### Import course (stub)
- Placeholder route/UI for importing from open data (OSM, golf APIs)
- Doesn't need to work yet -- just the entry point and a "coming soon" message
- Seed data import: ability to import the existing `mearns_castle_geometry.json` format

### View/list courses
- List all courses with name, location, hole count
- View a single course with all its holes

### Edit/delete
- Edit course details and hole geometry
- Delete a course (creator only, or any user for now)

## Acceptance criteria
- Can create a course with multiple holes including geometry
- Can list and view courses
- Can import seed data format
- All routes are auth-protected
- Data persists in SQLite
