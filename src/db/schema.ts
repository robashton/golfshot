import Database from "better-sqlite3";

export function initializeDatabase(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS holes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      hole_number INTEGER NOT NULL,
      par INTEGER NOT NULL,
      yardage INTEGER NOT NULL,
      geometry TEXT NOT NULL DEFAULT '{}',
      UNIQUE(course_id, hole_number)
    );

    CREATE INDEX IF NOT EXISTS idx_holes_course_id ON holes(course_id);

    CREATE TABLE IF NOT EXISTS bags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bags_user_id ON bags(user_id);

    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bag_id INTEGER NOT NULL REFERENCES bags(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      carry_yards INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clubs_bag_id ON clubs(bag_id);

    CREATE TABLE IF NOT EXISTS strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      hole_id INTEGER NOT NULL REFERENCES holes(id) ON DELETE CASCADE,
      bag_id INTEGER NOT NULL REFERENCES bags(id),
      name TEXT NOT NULL,
      preferred_miss TEXT NOT NULL DEFAULT '',
      no_go_zones TEXT NOT NULL DEFAULT '[]',
      overall_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_strategies_hole_id ON strategies(hole_id);
    CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id);

    CREATE TABLE IF NOT EXISTS strategy_shots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
      shot_number INTEGER NOT NULL,
      club TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_strategy_shots_strategy_id ON strategy_shots(strategy_id);
  `);
}
