# Golf bag management (My Bag)

# Golf bag management (My Bag)

## Scope

Per-user golf bag with club inventory and stock carry yardages.

## Data model

### Bag
- id, user_id (FK), name, is_active (boolean), created_at

### Club
- id, bag_id (FK), name (e.g. "7i", "Driver"), carry_yards (integer)

Reference: `data/bag_profile.json` for the structure. Notes field on the bag is optional.

## Features

### Create/edit bag
- Form: bag name
- Add clubs: club name + carry yardage
- Edit/remove clubs
- Set one bag as active

### View bags
- List user's bags
- View a single bag with all clubs and yardages

### Import from seed
- Ability to import `data/bag_profile.json` format as a bag

## Acceptance criteria
- Can create a bag with multiple clubs and yardages
- Can set an active bag
- Can list and view bags
- Bags are per-user (can't see other users' bags)
- All routes are auth-protected
- Data persists in SQLite
