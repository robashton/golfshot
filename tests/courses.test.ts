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

describe("course endpoints", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.db.close();
  });

  describe("auth protection", () => {
    it("redirects to login when not authenticated", async () => {
      const res = await request(ctx.app).get("/courses");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });
  });

  describe("GET /courses", () => {
    it("shows empty list when no courses exist", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent.get("/courses");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Courses");
      expect(res.text).toContain("No courses yet");
    });

    it("lists courses with hole counts", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      await agent.post("/courses").type("form").send({ name: "Test Course", location: "Glasgow" });

      const res = await agent.get("/courses");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Test Course");
      expect(res.text).toContain("Glasgow");
    });
  });

  describe("POST /courses", () => {
    it("creates a course and redirects", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Links Course", location: "Edinburgh" });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/courses\/\d+$/);

      const course = ctx.db
        .prepare("SELECT * FROM courses WHERE name = ?")
        .get("Links Course") as { name: string; location: string };
      expect(course).toBeTruthy();
      expect(course.location).toBe("Edinburgh");
    });

    it("rejects missing name", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent
        .post("/courses")
        .type("form")
        .send({ location: "Edinburgh" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Course name is required");
    });
  });

  describe("GET /courses/:id", () => {
    it("shows course detail with holes", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Detail Course", location: "Aberdeen" });

      const courseUrl = createRes.headers.location as string;

      // Add a hole
      await agent
        .post(`${courseUrl}/holes`)
        .type("form")
        .send({
          hole_number: "1",
          par: "4",
          yardage: "385",
          tee_lat: "55.770",
          tee_lng: "-4.289",
          green_lat: "55.771",
          green_lng: "-4.284",
        });

      const res = await agent.get(courseUrl);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Detail Course");
      expect(res.text).toContain("385");
    });

    it("returns 404 for non-existent course", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent.get("/courses/999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /courses/:id (update)", () => {
    it("updates a course", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Old Name", location: "Old Loc" });

      const courseUrl = createRes.headers.location as string;

      const res = await agent
        .post(courseUrl)
        .type("form")
        .send({ name: "New Name", location: "New Loc" });

      expect(res.status).toBe(302);

      const course = ctx.db
        .prepare("SELECT * FROM courses WHERE name = ?")
        .get("New Name") as { name: string; location: string } | undefined;
      expect(course).toBeTruthy();
      expect(course!.location).toBe("New Loc");
    });
  });

  describe("POST /courses/:id/delete", () => {
    it("deletes a course and its holes", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Doomed Course", location: "" });

      const courseUrl = createRes.headers.location as string;

      // Add a hole
      await agent
        .post(`${courseUrl}/holes`)
        .type("form")
        .send({ hole_number: "1", par: "3", yardage: "150" });

      const res = await agent.post(`${courseUrl}/delete`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/courses");

      const count = ctx.db
        .prepare("SELECT COUNT(*) as c FROM courses")
        .get() as { c: number };
      expect(count.c).toBe(0);

      const holeCount = ctx.db
        .prepare("SELECT COUNT(*) as c FROM holes")
        .get() as { c: number };
      expect(holeCount.c).toBe(0);
    });
  });

  describe("holes CRUD", () => {
    it("creates a hole with geometry", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Hole Test", location: "" });

      const courseUrl = createRes.headers.location as string;

      const res = await agent
        .post(`${courseUrl}/holes`)
        .type("form")
        .send({
          hole_number: "1",
          par: "4",
          yardage: "350",
          tee_lat: "55.77",
          tee_lng: "-4.29",
          green_lat: "55.78",
          green_lng: "-4.28",
          hazard_name_0: "bunker",
          hazard_lat_0: "55.775",
          hazard_lng_0: "-4.285",
        });

      expect(res.status).toBe(302);

      const hole = ctx.db
        .prepare("SELECT * FROM holes WHERE hole_number = 1")
        .get() as { geometry: string; par: number; yardage: number };
      expect(hole).toBeTruthy();
      expect(hole.par).toBe(4);

      const geo = JSON.parse(hole.geometry);
      expect(geo.tee.lat).toBe(55.77);
      expect(geo.hazards).toHaveLength(1);
      expect(geo.hazards[0].name).toBe("bunker");
    });

    it("rejects duplicate hole numbers", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Dupe Test", location: "" });

      const courseUrl = createRes.headers.location as string;

      await agent
        .post(`${courseUrl}/holes`)
        .type("form")
        .send({ hole_number: "1", par: "4", yardage: "350" });

      const res = await agent
        .post(`${courseUrl}/holes`)
        .type("form")
        .send({ hole_number: "1", par: "3", yardage: "200" });

      expect(res.status).toBe(409);
      expect(res.text).toContain("already exists");
    });

    it("updates a hole", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Update Hole", location: "" });

      const courseUrl = createRes.headers.location as string;

      await agent
        .post(`${courseUrl}/holes`)
        .type("form")
        .send({ hole_number: "1", par: "4", yardage: "350" });

      const hole = ctx.db
        .prepare("SELECT id FROM holes WHERE hole_number = 1")
        .get() as { id: number };

      const res = await agent
        .post(`${courseUrl}/holes/${hole.id}`)
        .type("form")
        .send({ hole_number: "1", par: "5", yardage: "500" });

      expect(res.status).toBe(302);

      const updated = ctx.db
        .prepare("SELECT * FROM holes WHERE id = ?")
        .get(hole.id) as { par: number; yardage: number };
      expect(updated.par).toBe(5);
      expect(updated.yardage).toBe(500);
    });

    it("deletes a hole", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/courses")
        .type("form")
        .send({ name: "Delete Hole", location: "" });

      const courseUrl = createRes.headers.location as string;

      await agent
        .post(`${courseUrl}/holes`)
        .type("form")
        .send({ hole_number: "1", par: "4", yardage: "350" });

      const hole = ctx.db
        .prepare("SELECT id FROM holes WHERE hole_number = 1")
        .get() as { id: number };

      const res = await agent.post(`${courseUrl}/holes/${hole.id}/delete`);
      expect(res.status).toBe(302);

      const count = ctx.db
        .prepare("SELECT COUNT(*) as c FROM holes")
        .get() as { c: number };
      expect(count.c).toBe(0);
    });
  });

  describe("seed data import", () => {
    it("imports mearns castle format", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const seedData = JSON.stringify({
        course: "Mearns Castle",
        holes: [
          {
            number: 1,
            name: "Brook decision",
            par: 4,
            yards: 385,
            tee: [55.770297, -4.2894959],
            green: [55.7717575, -4.2844963],
            layup: [55.770768, -4.2879295],
            brookA: [55.7706712, -4.2860842],
            brookB: [55.771395, -4.2879403],
            stock_plan: ["8i", "7w", "wedge"],
            notes: ["A note"],
          },
        ],
      });

      const res = await agent
        .post("/courses/import-seed")
        .type("form")
        .send({ json: seedData });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/courses\/\d+$/);

      const course = ctx.db
        .prepare("SELECT * FROM courses WHERE name = ?")
        .get("Mearns Castle") as { id: number; name: string };
      expect(course).toBeTruthy();

      const holes = ctx.db
        .prepare("SELECT * FROM holes WHERE course_id = ?")
        .all(course.id) as Array<{ geometry: string; par: number; yardage: number }>;
      expect(holes).toHaveLength(1);
      expect(holes[0].par).toBe(4);
      expect(holes[0].yardage).toBe(385);

      const geo = JSON.parse(holes[0].geometry);
      expect(geo.tee.lat).toBeCloseTo(55.770297);
      expect(geo.green.lng).toBeCloseTo(-4.2844963);
      expect(geo.hazards).toHaveLength(2); // brookA, brookB
      expect(geo.layups).toHaveLength(1);
    });

    it("rejects invalid JSON", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent
        .post("/courses/import-seed")
        .type("form")
        .send({ json: "not json" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Invalid JSON");
    });

    it("rejects missing required fields", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent
        .post("/courses/import-seed")
        .type("form")
        .send({ json: '{"foo": "bar"}' });

      expect(res.status).toBe(400);
      expect(res.text).toContain("course");
    });
  });

  describe("GET /courses/import", () => {
    it("shows import page with OSM search form", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent.get("/courses/import");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Search OpenStreetMap");
    });
  });
});
