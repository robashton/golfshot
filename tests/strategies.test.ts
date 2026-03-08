import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { TestContext } from "./helpers.js";
import { createTestContext } from "./helpers.js";

function authedAgent(ctx: TestContext) {
  const agent = request.agent(ctx.app);
  return {
    agent,
    async login() {
      await agent
        .post("/register")
        .type("form")
        .send({ email: "user@example.com", password: "password123" });
      return agent;
    },
  };
}

/** Create a course with one hole and return IDs */
function seedCourseAndHole(ctx: TestContext, userId: number) {
  const courseResult = ctx.db
    .prepare("INSERT INTO courses (name, location, created_by) VALUES (?, ?, ?)")
    .run("Test Course", "Glasgow", userId);
  const courseId = Number(courseResult.lastInsertRowid);

  const holeResult = ctx.db
    .prepare("INSERT INTO holes (course_id, hole_number, par, yardage) VALUES (?, ?, ?, ?)")
    .run(courseId, 1, 4, 380);
  const holeId = Number(holeResult.lastInsertRowid);

  return { courseId, holeId };
}

/** Create a bag with clubs and set it active, return bag ID */
function seedActiveBag(ctx: TestContext, userId: number) {
  const bagResult = ctx.db
    .prepare("INSERT INTO bags (user_id, name, is_active) VALUES (?, ?, 1)")
    .run(userId, "Main Bag");
  const bagId = Number(bagResult.lastInsertRowid);

  const insertClub = ctx.db.prepare(
    "INSERT INTO clubs (bag_id, name, carry_yards) VALUES (?, ?, ?)"
  );
  insertClub.run(bagId, "Driver", 230);
  insertClub.run(bagId, "7i", 155);
  insertClub.run(bagId, "PW", 120);

  return bagId;
}

function getUserId(ctx: TestContext): number {
  const user = ctx.db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("user@example.com") as { id: number };
  return user.id;
}

describe("strategy endpoints", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.db.close();
  });

  describe("auth protection", () => {
    it("redirects to login when not authenticated", async () => {
      const res = await request(ctx.app).get("/courses/1/holes/1/strategies");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });
  });

  describe("GET /courses/:courseId/holes/:holeId/strategies", () => {
    it("shows empty list when no strategies exist", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);

      const res = await agent.get(`/courses/${courseId}/holes/${holeId}/strategies`);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Strategies for Hole 1");
      expect(res.text).toContain("No strategies yet");
    });

    it("returns 404 for non-existent course", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent.get("/courses/999/holes/1/strategies");
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent hole", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId } = seedCourseAndHole(ctx, userId);

      const res = await agent.get(`/courses/${courseId}/holes/999/strategies`);
      expect(res.status).toBe(404);
    });

    it("lists strategies for a hole", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      ctx.db
        .prepare(
          "INSERT INTO strategies (user_id, hole_id, bag_id, name) VALUES (?, ?, ?, ?)"
        )
        .run(userId, holeId, bagId, "Safe Route");

      const res = await agent.get(`/courses/${courseId}/holes/${holeId}/strategies`);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Safe Route");
    });

    it("does not show other users strategies", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      ctx.db
        .prepare(
          "INSERT INTO strategies (user_id, hole_id, bag_id, name) VALUES (?, ?, ?, ?)"
        )
        .run(userId, holeId, bagId, "My Strategy");

      // Register second user
      const agent2 = request.agent(ctx.app);
      await agent2
        .post("/register")
        .type("form")
        .send({ email: "other@example.com", password: "password123" });

      const res = await agent2.get(`/courses/${courseId}/holes/${holeId}/strategies`);
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("My Strategy");
      expect(res.text).toContain("No strategies yet");
    });
  });

  describe("GET /courses/:courseId/holes/:holeId/strategies/new", () => {
    it("shows form with clubs from active bag", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      seedActiveBag(ctx, userId);

      const res = await agent.get(`/courses/${courseId}/holes/${holeId}/strategies/new`);
      expect(res.status).toBe(200);
      expect(res.text).toContain("New Strategy");
      expect(res.text).toContain("Driver (230y)");
      expect(res.text).toContain("7i (155y)");
      expect(res.text).toContain("PW (120y)");
    });

    it("shows message when no active bag", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);

      const res = await agent.get(`/courses/${courseId}/holes/${holeId}/strategies/new`);
      expect(res.status).toBe(200);
      expect(res.text).toContain("No Active Bag");
    });
  });

  describe("POST /courses/:courseId/holes/:holeId/strategies", () => {
    it("creates a strategy with shots", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const res = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({
          name: "Aggressive",
          bag_id: String(bagId),
          shot_club_0: "Driver",
          shot_notes_0: "Aim left center",
          shot_club_1: "PW",
          shot_target_lat_1: "55.123",
          shot_target_lng_1: "-4.456",
          shot_notes_1: "Pin high",
          preferred_miss: "left",
          no_go_zone_0: "bunker right",
          no_go_zone_1: "OOB left",
          overall_notes: "Play safe if windy",
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(
        /\/courses\/\d+\/holes\/\d+\/strategies\/\d+$/
      );

      const strategy = ctx.db
        .prepare("SELECT * FROM strategies WHERE name = ?")
        .get("Aggressive") as { id: number; preferred_miss: string; no_go_zones: string; overall_notes: string };
      expect(strategy).toBeTruthy();
      expect(strategy.preferred_miss).toBe("left");
      expect(JSON.parse(strategy.no_go_zones)).toEqual(["bunker right", "OOB left"]);
      expect(strategy.overall_notes).toBe("Play safe if windy");

      const shots = ctx.db
        .prepare("SELECT * FROM strategy_shots WHERE strategy_id = ? ORDER BY shot_number")
        .all(strategy.id) as Array<{ club: string; shot_number: number; target: string; notes: string }>;
      expect(shots).toHaveLength(2);
      expect(shots[0].club).toBe("Driver");
      expect(shots[0].notes).toBe("Aim left center");
      expect(shots[1].club).toBe("PW");
      expect(JSON.parse(shots[1].target)).toEqual({ lat: 55.123, lng: -4.456 });
    });

    it("rejects missing name", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const res = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ bag_id: String(bagId) });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Strategy name is required");
    });

    it("rejects missing bag_id", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);

      const res = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ name: "Test" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Bag is required");
    });

    it("rejects bag belonging to another user", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);

      // Create bag for a different user
      const otherUser = ctx.db
        .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
        .run("other@test.com", "hash");
      const otherBag = ctx.db
        .prepare("INSERT INTO bags (user_id, name) VALUES (?, ?)")
        .run(Number(otherUser.lastInsertRowid), "Other Bag");

      const res = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ name: "Test", bag_id: String(otherBag.lastInsertRowid) });

      expect(res.status).toBe(404);
    });

    it("allows multiple strategies per hole", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ name: "Safe", bag_id: String(bagId) });

      await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ name: "Aggressive", bag_id: String(bagId) });

      const count = ctx.db
        .prepare("SELECT COUNT(*) as c FROM strategies WHERE hole_id = ?")
        .get(holeId) as { c: number };
      expect(count.c).toBe(2);
    });
  });

  describe("GET /courses/:courseId/holes/:holeId/strategies/:strategyId", () => {
    it("shows strategy detail with shots and carry distances", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      // Create strategy via form
      const createRes = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({
          name: "View Test",
          bag_id: String(bagId),
          shot_club_0: "Driver",
          shot_notes_0: "Middle of fairway",
          shot_club_1: "7i",
          preferred_miss: "right",
        });

      const strategyUrl = createRes.headers.location as string;

      const res = await agent.get(strategyUrl);
      expect(res.status).toBe(200);
      expect(res.text).toContain("View Test");
      expect(res.text).toContain("Driver");
      expect(res.text).toContain("230y");
      expect(res.text).toContain("7i");
      expect(res.text).toContain("155y");
      expect(res.text).toContain("Middle of fairway");
      expect(res.text).toContain("right");
    });

    it("returns 404 for non-existent strategy", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);

      const res = await agent.get(`/courses/${courseId}/holes/${holeId}/strategies/999`);
      expect(res.status).toBe(404);
    });

    it("returns 404 for another users strategy", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const createRes = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ name: "Private", bag_id: String(bagId) });

      const strategyUrl = createRes.headers.location as string;

      // Login as another user
      const agent2 = request.agent(ctx.app);
      await agent2
        .post("/register")
        .type("form")
        .send({ email: "other@example.com", password: "password123" });

      const res = await agent2.get(strategyUrl);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /courses/:courseId/holes/:holeId/strategies/:strategyId (update)", () => {
    it("updates strategy name, notes, and shots", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const createRes = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({
          name: "Old Name",
          bag_id: String(bagId),
          shot_club_0: "Driver",
        });

      const strategyUrl = createRes.headers.location as string;

      const res = await agent
        .post(strategyUrl)
        .type("form")
        .send({
          name: "New Name",
          shot_club_0: "7i",
          shot_notes_0: "Layup",
          shot_club_1: "PW",
          preferred_miss: "left",
          no_go_zone_0: "water",
          overall_notes: "Updated notes",
        });

      expect(res.status).toBe(302);

      const strategy = ctx.db
        .prepare("SELECT * FROM strategies WHERE name = ?")
        .get("New Name") as { id: number; preferred_miss: string; no_go_zones: string; overall_notes: string } | undefined;
      expect(strategy).toBeTruthy();
      expect(strategy!.preferred_miss).toBe("left");
      expect(strategy!.overall_notes).toBe("Updated notes");

      const shots = ctx.db
        .prepare("SELECT * FROM strategy_shots WHERE strategy_id = ? ORDER BY shot_number")
        .all(strategy!.id) as Array<{ club: string }>;
      expect(shots).toHaveLength(2);
      expect(shots[0].club).toBe("7i");
      expect(shots[1].club).toBe("PW");
    });

    it("rejects missing name on update", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const createRes = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ name: "Test", bag_id: String(bagId) });

      const strategyUrl = createRes.headers.location as string;

      const res = await agent
        .post(strategyUrl)
        .type("form")
        .send({});

      expect(res.status).toBe(400);
      expect(res.text).toContain("Strategy name is required");
    });
  });

  describe("POST /courses/:courseId/holes/:holeId/strategies/:strategyId/delete", () => {
    it("deletes a strategy and its shots", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const createRes = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({
          name: "Doomed",
          bag_id: String(bagId),
          shot_club_0: "Driver",
        });

      const strategyUrl = createRes.headers.location as string;

      const res = await agent.post(`${strategyUrl}/delete`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `/courses/${courseId}/holes/${holeId}/strategies`
      );

      const strategyCount = ctx.db
        .prepare("SELECT COUNT(*) as c FROM strategies")
        .get() as { c: number };
      expect(strategyCount.c).toBe(0);

      const shotCount = ctx.db
        .prepare("SELECT COUNT(*) as c FROM strategy_shots")
        .get() as { c: number };
      expect(shotCount.c).toBe(0);
    });

    it("returns 404 for another users strategy", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const createRes = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({ name: "Private", bag_id: String(bagId) });

      const strategyUrl = createRes.headers.location as string;

      const agent2 = request.agent(ctx.app);
      await agent2
        .post("/register")
        .type("form")
        .send({ email: "other@example.com", password: "password123" });

      const res = await agent2.post(`${strategyUrl}/delete`);
      expect(res.status).toBe(404);

      // Strategy should still exist
      const count = ctx.db
        .prepare("SELECT COUNT(*) as c FROM strategies")
        .get() as { c: number };
      expect(count.c).toBe(1);
    });
  });

  describe("GET /courses/:courseId/holes/:holeId/strategies/:strategyId/edit", () => {
    it("shows edit form with existing data", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();
      const userId = getUserId(ctx);
      const { courseId, holeId } = seedCourseAndHole(ctx, userId);
      const bagId = seedActiveBag(ctx, userId);

      const createRes = await agent
        .post(`/courses/${courseId}/holes/${holeId}/strategies`)
        .type("form")
        .send({
          name: "Edit Me",
          bag_id: String(bagId),
          shot_club_0: "Driver",
          preferred_miss: "left",
          no_go_zone_0: "water right",
        });

      const strategyUrl = createRes.headers.location as string;

      const res = await agent.get(`${strategyUrl}/edit`);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Edit Strategy");
      expect(res.text).toContain("Edit Me");
      expect(res.text).toContain("left");
      expect(res.text).toContain("water right");
    });
  });
});
