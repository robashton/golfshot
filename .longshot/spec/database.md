# Database schema

## users
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| email | TEXT | NOT NULL UNIQUE |
| password_hash | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

## sessions
| Column | Type | Constraints |
|--------|------|-------------|
| sid | TEXT | PRIMARY KEY |
| sess | TEXT | NOT NULL |
| expired | TEXT | NOT NULL (indexed) |

## courses
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | NOT NULL |
| location | TEXT | NOT NULL DEFAULT '' |
| created_by | INTEGER | NOT NULL, FK → users(id) |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

## holes
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| course_id | INTEGER | NOT NULL, FK → courses(id) ON DELETE CASCADE |
| hole_number | INTEGER | NOT NULL |
| par | INTEGER | NOT NULL |
| yardage | INTEGER | NOT NULL |
| geometry | TEXT | NOT NULL DEFAULT '{}' (JSON: tee, green, hazards, layups, fairway_points) |
| | | UNIQUE(course_id, hole_number) |

Geometry JSON keys: `tee` ({lat, lng}), `green` ({lat, lng}), `hazards` (array of {name, lat, lng}), `layups` (array of {name, lat, lng}), `fairway_points` (array of {lat, lng}).

## bags
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FK → users(id) |
| name | TEXT | NOT NULL |
| is_active | INTEGER | NOT NULL DEFAULT 0 |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

Indexed on `user_id`. One bag per user can be active at a time.

## clubs
| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| bag_id | INTEGER | NOT NULL, FK → bags(id) ON DELETE CASCADE |
| name | TEXT | NOT NULL |
| carry_yards | INTEGER | NOT NULL |

Indexed on `bag_id`. Cascade-deletes when parent bag is deleted.
