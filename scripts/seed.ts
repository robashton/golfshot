import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "../src/db/migrate.js";

const DB_PATH = path.join(process.cwd(), "data", "golfshot.db");
const SEED_COURSE_PATH = path.join(process.cwd(), "data", "mearns_castle_geometry.json");
const SEED_BAG_PATH = path.join(process.cwd(), "data", "bag_profile.json");

const DEV_EMAIL = "dev@golfshot.local";
const DEV_PASSWORD = "password";

interface SeedHole {
  number: number;
  name?: string;
  par: number;
  yards: number;
  tee?: [number, number];
  green?: [number, number];
  layup?: [number, number];
  [key: string]: unknown;
}

interface SeedCourseData {
  course: string;
  holes: SeedHole[];
}

interface SeedBagData {
  player?: string;
  stock_carries_yards: Record<string, number>;
}

interface HoleGeometry {
  tee?: { lat: number; lng: number };
  green?: { lat: number; lng: number };
  hazards?: Array<{ name: string; lat: number; lng: number }>;
  layups?: Array<{ name: string; lat: number; lng: number }>;
}

async function seed(): Promise<void> {
  const summary: string[] = [];

  // 1. Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 2. Open DB and run migrations
  const db = new Database(DB_PATH);
  runMigrations(db);
  summary.push("Migrations: applied");

  // 3. Create dev user if not present
  const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(DEV_EMAIL) as { id: number } | undefined;
  let userId: number;

  if (existingUser) {
    userId = existingUser.id;
    summary.push(`User ${DEV_EMAIL}: already exists (id=${userId})`);
  } else {
    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
    const result = db
      .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
      .run(DEV_EMAIL, passwordHash);
    userId = Number(result.lastInsertRowid);
    summary.push(`User ${DEV_EMAIL}: created (id=${userId})`);
  }

  // 4. Import course if not present
  const courseData = JSON.parse(fs.readFileSync(SEED_COURSE_PATH, "utf-8")) as SeedCourseData;
  const existingCourse = db.prepare("SELECT id FROM courses WHERE name = ?").get(courseData.course) as { id: number } | undefined;

  if (existingCourse) {
    summary.push(`Course "${courseData.course}": already exists (id=${existingCourse.id})`);
  } else {
    const insertCourse = db.prepare(
      "INSERT INTO courses (name, location, created_by) VALUES (?, ?, ?)"
    );
    const insertHole = db.prepare(
      "INSERT INTO holes (course_id, hole_number, par, yardage, geometry) VALUES (?, ?, ?, ?, ?)"
    );

    const importCourse = db.transaction(() => {
      const result = insertCourse.run(courseData.course, "", userId);
      const courseId = Number(result.lastInsertRowid);

      for (const hole of courseData.holes) {
        const geometry: HoleGeometry = {};
        if (hole.tee) {
          geometry.tee = { lat: hole.tee[0], lng: hole.tee[1] };
        }
        if (hole.green) {
          geometry.green = { lat: hole.green[0], lng: hole.green[1] };
        }

        const hazards: Array<{ name: string; lat: number; lng: number }> = [];
        const layups: Array<{ name: string; lat: number; lng: number }> = [];

        if (hole.layup) {
          layups.push({ name: "Layup", lat: hole.layup[0], lng: hole.layup[1] });
        }

        const knownKeys = new Set(["number", "name", "par", "yards", "tee", "green", "layup", "stock_plan", "notes"]);
        for (const [key, value] of Object.entries(hole)) {
          if (!knownKeys.has(key) && Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
            hazards.push({ name: key, lat: value[0] as number, lng: value[1] as number });
          }
        }

        if (hazards.length > 0) geometry.hazards = hazards;
        if (layups.length > 0) geometry.layups = layups;

        insertHole.run(courseId, hole.number, hole.par, hole.yards, JSON.stringify(geometry));
      }

      return courseId;
    });

    const courseId = importCourse();
    summary.push(`Course "${courseData.course}": created (id=${courseId}, ${courseData.holes.length} holes)`);
  }

  // 5. Import bag if user has no bags
  const existingBag = db.prepare("SELECT id FROM bags WHERE user_id = ?").get(userId) as { id: number } | undefined;

  if (existingBag) {
    summary.push(`Bag for dev user: already exists (id=${existingBag.id})`);
  } else {
    const bagData = JSON.parse(fs.readFileSync(SEED_BAG_PATH, "utf-8")) as SeedBagData;
    const bagName = bagData.player ?? "Imported Bag";

    const insertBag = db.prepare(
      "INSERT INTO bags (user_id, name, is_active) VALUES (?, ?, 1)"
    );
    const insertClub = db.prepare(
      "INSERT INTO clubs (bag_id, name, carry_yards) VALUES (?, ?, ?)"
    );

    const importBag = db.transaction(() => {
      const result = insertBag.run(userId, bagName);
      const bagId = Number(result.lastInsertRowid);

      for (const [clubName, yards] of Object.entries(bagData.stock_carries_yards)) {
        if (typeof yards === "number") {
          insertClub.run(bagId, clubName, yards);
        }
      }

      return bagId;
    });

    const bagId = importBag();
    summary.push(`Bag "${bagName}": created (id=${bagId}, active, ${Object.keys(bagData.stock_carries_yards).length} clubs)`);
  }

  db.close();

  // 6. Print summary
  console.log("\nSeed complete:\n");
  for (const line of summary) {
    console.log(`  ${line}`);
  }
  console.log("");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
