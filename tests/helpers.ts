import Database from "better-sqlite3";
import { initializeDatabase } from "../src/db/schema.js";
import { createApp } from "../src/app.js";
import type express from "express";

export interface TestContext {
  db: Database.Database;
  app: express.Express;
}

export function createTestContext(): TestContext {
  const db = new Database(":memory:");
  initializeDatabase(db);
  const app = createApp(db);
  return { db, app };
}
