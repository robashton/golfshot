import type Database from "better-sqlite3";
import { up as migration001 } from "./migrations/001-initial-schema.js";

interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  { id: 1, name: "001-initial-schema", up: migration001 },
];

export function runMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (db.prepare("SELECT id FROM schema_version").all() as { id: number }[]).map(
      (row) => row.id
    )
  );

  const pending = migrations.filter((m) => !applied.has(m.id));

  if (pending.length === 0) {
    return;
  }

  const applyMigration = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db);
      db.prepare("INSERT INTO schema_version (id, name) VALUES (?, ?)").run(
        migration.id,
        migration.name
      );
    }
  });

  applyMigration();
}
