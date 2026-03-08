import Database from "better-sqlite3";
import path from "node:path";
import { initializeDatabase } from "./schema.js";

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (!db) {
    const resolvedPath = dbPath ?? path.join(process.cwd(), "data", "golfshot.db");
    db = new Database(resolvedPath);
    initializeDatabase(db);
  }
  return db;
}

export function createDatabase(dbPath: string): Database.Database {
  const instance = new Database(dbPath);
  initializeDatabase(instance);
  return instance;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
