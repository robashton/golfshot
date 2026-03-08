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

describe("bag endpoints", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.db.close();
  });

  describe("auth protection", () => {
    it("redirects to login when not authenticated", async () => {
      const res = await request(ctx.app).get("/bags");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });
  });

  describe("GET /bags", () => {
    it("shows empty list when no bags exist", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent.get("/bags");
      expect(res.status).toBe(200);
      expect(res.text).toContain("My Bags");
      expect(res.text).toContain("No bags yet");
    });

    it("lists bags with club counts", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      await agent.post("/bags").type("form").send({ name: "Main Bag" });

      const res = await agent.get("/bags");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Main Bag");
    });

    it("does not show other users bags", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      // Create a bag for user 1
      await agent.post("/bags").type("form").send({ name: "User1 Bag" });

      // Register a second user
      const agent2 = request.agent(ctx.app);
      await agent2
        .post("/register")
        .type("form")
        .send({ email: "other@example.com", password: "password123" });

      const res = await agent2.get("/bags");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("User1 Bag");
      expect(res.text).toContain("No bags yet");
    });
  });

  describe("POST /bags", () => {
    it("creates a bag and redirects", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Tournament Bag" });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/bags\/\d+$/);

      const bag = ctx.db
        .prepare("SELECT * FROM bags WHERE name = ?")
        .get("Tournament Bag") as { name: string };
      expect(bag).toBeTruthy();
    });

    it("rejects missing name", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent.post("/bags").type("form").send({});
      expect(res.status).toBe(400);
      expect(res.text).toContain("Bag name is required");
    });
  });

  describe("GET /bags/:id", () => {
    it("shows bag detail with clubs", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Detail Bag" });

      const bagUrl = createRes.headers.location as string;

      // Add a club
      await agent
        .post(`${bagUrl}/clubs`)
        .type("form")
        .send({ club_name: "7i", carry_yards: "155" });

      const res = await agent.get(bagUrl);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Detail Bag");
      expect(res.text).toContain("7i");
      expect(res.text).toContain("155");
    });

    it("returns 404 for non-existent bag", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent.get("/bags/999");
      expect(res.status).toBe(404);
    });

    it("returns 404 for another users bag", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Private Bag" });

      const bagUrl = createRes.headers.location as string;

      // Login as another user
      const agent2 = request.agent(ctx.app);
      await agent2
        .post("/register")
        .type("form")
        .send({ email: "other@example.com", password: "password123" });

      const res = await agent2.get(bagUrl);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /bags/:id (update)", () => {
    it("updates bag name and clubs", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Old Name" });

      const bagUrl = createRes.headers.location as string;

      // Add a club first
      await agent
        .post(`${bagUrl}/clubs`)
        .type("form")
        .send({ club_name: "Driver", carry_yards: "230" });

      // Update with new name and replace clubs
      const res = await agent
        .post(bagUrl)
        .type("form")
        .send({
          name: "New Name",
          club_name_0: "7i",
          club_yards_0: "155",
          club_name_1: "Driver",
          club_yards_1: "240",
        });

      expect(res.status).toBe(302);

      const bag = ctx.db
        .prepare("SELECT * FROM bags WHERE name = ?")
        .get("New Name") as { id: number; name: string } | undefined;
      expect(bag).toBeTruthy();

      const clubs = ctx.db
        .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
        .all(bag!.id) as Array<{ name: string; carry_yards: number }>;
      expect(clubs).toHaveLength(2);
      expect(clubs[0].name).toBe("Driver");
      expect(clubs[0].carry_yards).toBe(240);
    });
  });

  describe("POST /bags/:id/delete", () => {
    it("deletes a bag and its clubs", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Doomed Bag" });

      const bagUrl = createRes.headers.location as string;

      // Add a club
      await agent
        .post(`${bagUrl}/clubs`)
        .type("form")
        .send({ club_name: "PW", carry_yards: "120" });

      const res = await agent.post(`${bagUrl}/delete`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/bags");

      const bagCount = ctx.db
        .prepare("SELECT COUNT(*) as c FROM bags")
        .get() as { c: number };
      expect(bagCount.c).toBe(0);

      const clubCount = ctx.db
        .prepare("SELECT COUNT(*) as c FROM clubs")
        .get() as { c: number };
      expect(clubCount.c).toBe(0);
    });
  });

  describe("POST /bags/:id/set-active", () => {
    it("sets a bag as active and deactivates others", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res1 = await agent.post("/bags").type("form").send({ name: "Bag 1" });
      const bag1Url = res1.headers.location as string;

      const res2 = await agent.post("/bags").type("form").send({ name: "Bag 2" });
      const bag2Url = res2.headers.location as string;

      // Set bag 1 as active
      await agent.post(`${bag1Url}/set-active`);

      let bag1 = ctx.db
        .prepare("SELECT is_active FROM bags WHERE name = ?")
        .get("Bag 1") as { is_active: number };
      expect(bag1.is_active).toBe(1);

      // Set bag 2 as active — should deactivate bag 1
      await agent.post(`${bag2Url}/set-active`);

      bag1 = ctx.db
        .prepare("SELECT is_active FROM bags WHERE name = ?")
        .get("Bag 1") as { is_active: number };
      expect(bag1.is_active).toBe(0);

      const bag2 = ctx.db
        .prepare("SELECT is_active FROM bags WHERE name = ?")
        .get("Bag 2") as { is_active: number };
      expect(bag2.is_active).toBe(1);
    });
  });

  describe("clubs CRUD", () => {
    it("adds a club to a bag", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Club Test" });

      const bagUrl = createRes.headers.location as string;

      const res = await agent
        .post(`${bagUrl}/clubs`)
        .type("form")
        .send({ club_name: "8i", carry_yards: "145" });

      expect(res.status).toBe(302);

      const club = ctx.db
        .prepare("SELECT * FROM clubs WHERE name = ?")
        .get("8i") as { name: string; carry_yards: number };
      expect(club).toBeTruthy();
      expect(club.carry_yards).toBe(145);
    });

    it("rejects missing club data", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Club Test" });

      const bagUrl = createRes.headers.location as string;

      const res = await agent
        .post(`${bagUrl}/clubs`)
        .type("form")
        .send({ club_name: "8i" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Club name and carry yardage are required");
    });

    it("deletes a club", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const createRes = await agent
        .post("/bags")
        .type("form")
        .send({ name: "Delete Club" });

      const bagUrl = createRes.headers.location as string;

      await agent
        .post(`${bagUrl}/clubs`)
        .type("form")
        .send({ club_name: "SW", carry_yards: "90" });

      const club = ctx.db
        .prepare("SELECT id FROM clubs WHERE name = ?")
        .get("SW") as { id: number };

      const res = await agent.post(`${bagUrl}/clubs/${club.id}/delete`);
      expect(res.status).toBe(302);

      const count = ctx.db
        .prepare("SELECT COUNT(*) as c FROM clubs")
        .get() as { c: number };
      expect(count.c).toBe(0);
    });
  });

  describe("seed data import", () => {
    it("imports bag_profile.json format", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const seedData = JSON.stringify({
        player: "user",
        stock_carries_yards: {
          "8i": 145,
          "7i": 155,
          "7w": 190,
          Driver: 230,
        },
        notes: ["Some note"],
      });

      const res = await agent
        .post("/bags/import-seed")
        .type("form")
        .send({ json: seedData });

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/bags\/\d+$/);

      const bag = ctx.db
        .prepare("SELECT * FROM bags WHERE name = ?")
        .get("user") as { id: number; name: string };
      expect(bag).toBeTruthy();

      const clubs = ctx.db
        .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards")
        .all(bag.id) as Array<{ name: string; carry_yards: number }>;
      expect(clubs).toHaveLength(4);
      expect(clubs[0].name).toBe("8i");
      expect(clubs[0].carry_yards).toBe(145);
    });

    it("rejects invalid JSON", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent
        .post("/bags/import-seed")
        .type("form")
        .send({ json: "not json" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Invalid JSON");
    });

    it("rejects missing stock_carries_yards", async () => {
      const { login } = authedAgent(ctx);
      const agent = await login();

      const res = await agent
        .post("/bags/import-seed")
        .type("form")
        .send({ json: '{"foo": "bar"}' });

      expect(res.status).toBe(400);
      expect(res.text).toContain("stock_carries_yards");
    });
  });
});
