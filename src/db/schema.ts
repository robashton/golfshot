import type Database from "better-sqlite3";
import { runMigrations } from "./migrate.js";

export function initializeDatabase(db: Database.Database): void {
  runMigrations(db);
}
