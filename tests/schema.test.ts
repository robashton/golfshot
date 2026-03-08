import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { initializeDatabase } from "../src/db/schema.js";

describe("database schema", () => {
  it("creates users table with correct columns", () => {
    const db = new Database(":memory:");
    initializeDatabase(db);

    const columns = db.pragma("table_info(users)") as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>;

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("email");
    expect(columnNames).toContain("password_hash");
    expect(columnNames).toContain("created_at");

    const idCol = columns.find((c) => c.name === "id")!;
    expect(idCol.pk).toBe(1);

    const emailCol = columns.find((c) => c.name === "email")!;
    expect(emailCol.notnull).toBe(1);

    const hashCol = columns.find((c) => c.name === "password_hash")!;
    expect(hashCol.notnull).toBe(1);

    db.close();
  });

  it("creates sessions table", () => {
    const db = new Database(":memory:");
    initializeDatabase(db);

    const columns = db.pragma("table_info(sessions)") as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("sid");
    expect(columnNames).toContain("sess");
    expect(columnNames).toContain("expired");

    db.close();
  });

  it("enforces unique email constraint", () => {
    const db = new Database(":memory:");
    initializeDatabase(db);

    db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run("test@example.com", "hash");

    expect(() => {
      db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run("test@example.com", "hash2");
    }).toThrow();

    db.close();
  });

  it("is idempotent (can be called twice)", () => {
    const db = new Database(":memory:");
    initializeDatabase(db);
    initializeDatabase(db);

    const columns = db.pragma("table_info(users)") as Array<{ name: string }>;
    expect(columns.length).toBe(4);

    db.close();
  });
});
