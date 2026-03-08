import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import type { TestContext } from "./helpers.js";
import { createTestContext } from "./helpers.js";
import { parseOverpassResponse } from "../src/osm/overpass.js";

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

describe("Overpass response parsing", () => {
  it("extracts holes from golf=hole ways", () => {
    const data = {
      elements: [
        {
          type: "way",
          id: 1,
          tags: { leisure: "golf_course", name: "Test Golf Club" },
          geometry: [],
        },
        {
          type: "way",
          id: 100,
          tags: { golf: "hole", ref: "1", par: "4", dist: "350" },
          geometry: [
            { lat: 55.8, lon: -4.3 },
            { lat: 55.81, lon: -4.31 },
          ],
        },
        {
          type: "way",
          id: 101,
          tags: { golf: "hole", ref: "2", par: "3", dist: "150" },
          geometry: [
            { lat: 55.82, lon: -4.32 },
            { lat: 55.83, lon: -4.33 },
          ],
        },
      ],
    };

    const result = parseOverpassResponse(data, "Fallback Name", "Glasgow, UK");

    expect(result.name).toBe("Test Golf Club");
    expect(result.location).toBe("Glasgow, UK");
    expect(result.holes).toHaveLength(2);

    expect(result.holes[0].number).toBe(1);
    expect(result.holes[0].par).toBe(4);
    expect(result.holes[0].yardage).toBe(383); // 350m * 1.09361 rounded
    expect(result.holes[0].tee).toEqual({ lat: 55.8, lng: -4.3 });
    expect(result.holes[0].green).toEqual({ lat: 55.81, lng: -4.31 });

    expect(result.holes[1].number).toBe(2);
    expect(result.holes[1].par).toBe(3);
  });

  it("uses fallback name when no course element has a name", () => {
    const data = {
      elements: [
        {
          type: "way",
          id: 100,
          tags: { golf: "hole", ref: "1", par: "4", dist: "300" },
          geometry: [
            { lat: 55.8, lon: -4.3 },
            { lat: 55.81, lon: -4.31 },
          ],
        },
      ],
    };

    const result = parseOverpassResponse(data, "Fallback Course", "London, UK");
    expect(result.name).toBe("Fallback Course");
  });

  it("returns empty holes array when no golf=hole elements exist", () => {
    const data = {
      elements: [
        {
          type: "way",
          id: 1,
          tags: { leisure: "golf_course", name: "Empty Course" },
          geometry: [],
        },
      ],
    };

    const result = parseOverpassResponse(data, "Fallback", "Nowhere");
    expect(result.name).toBe("Empty Course");
    expect(result.holes).toHaveLength(0);
  });

  it("matches standalone tee/green elements to holes by ref", () => {
    const data = {
      elements: [
        {
          type: "way",
          id: 100,
          tags: { golf: "hole", ref: "1", par: "4", dist: "400" },
          geometry: [
            { lat: 55.8, lon: -4.3 },
            { lat: 55.81, lon: -4.31 },
          ],
        },
        {
          type: "node",
          id: 200,
          tags: { golf: "tee", ref: "1" },
          lat: 55.799,
          lon: -4.299,
        },
        {
          type: "node",
          id: 201,
          tags: { golf: "green", ref: "1" },
          lat: 55.811,
          lon: -4.311,
        },
      ],
    };

    const result = parseOverpassResponse(data, "Test", "Test");
    // Hole already has tee/green from way geometry, standalone tees don't override
    expect(result.holes[0].tee).toEqual({ lat: 55.8, lng: -4.3 });
    expect(result.holes[0].green).toEqual({ lat: 55.81, lng: -4.31 });
  });

  it("matches hazards to nearest hole", () => {
    const data = {
      elements: [
        {
          type: "way",
          id: 100,
          tags: { golf: "hole", ref: "1", par: "4", dist: "350" },
          geometry: [
            { lat: 55.8, lon: -4.3 },
            { lat: 55.81, lon: -4.31 },
          ],
        },
        {
          type: "way",
          id: 101,
          tags: { golf: "hole", ref: "2", par: "5", dist: "500" },
          geometry: [
            { lat: 55.9, lon: -4.4 },
            { lat: 55.91, lon: -4.41 },
          ],
        },
        {
          type: "node",
          id: 300,
          tags: { golf: "bunker", name: "Greenside bunker" },
          lat: 55.811,
          lon: -4.311,
        },
      ],
    };

    const result = parseOverpassResponse(data, "Test", "Test");
    // Bunker is closer to hole 1's green
    expect(result.holes[0].hazards).toHaveLength(1);
    expect(result.holes[0].hazards![0].name).toBe("Greenside bunker");
    expect(result.holes[1].hazards).toBeUndefined();
  });

  it("sorts holes by number", () => {
    const data = {
      elements: [
        {
          type: "way",
          id: 102,
          tags: { golf: "hole", ref: "3", par: "3", dist: "150" },
          geometry: [
            { lat: 55.8, lon: -4.3 },
            { lat: 55.81, lon: -4.31 },
          ],
        },
        {
          type: "way",
          id: 100,
          tags: { golf: "hole", ref: "1", par: "4", dist: "350" },
          geometry: [
            { lat: 55.82, lon: -4.32 },
            { lat: 55.83, lon: -4.33 },
          ],
        },
        {
          type: "way",
          id: 101,
          tags: { golf: "hole", ref: "2", par: "5", dist: "500" },
          geometry: [
            { lat: 55.84, lon: -4.34 },
            { lat: 55.85, lon: -4.35 },
          ],
        },
      ],
    };

    const result = parseOverpassResponse(data, "Test", "Test");
    expect(result.holes.map((h) => h.number)).toEqual([1, 2, 3]);
  });
});

describe("OSM import route", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.db.close();
    vi.restoreAllMocks();
  });

  it("imports course with holes from OSM data", async () => {
    const overpassResponse = {
      elements: [
        {
          type: "relation",
          id: 12345,
          tags: { leisure: "golf_course", name: "St Andrews Old Course" },
          geometry: [],
        },
        {
          type: "way",
          id: 100,
          tags: { golf: "hole", ref: "1", par: "4", dist: "370" },
          geometry: [
            { lat: 56.34, lon: -2.8 },
            { lat: 56.35, lon: -2.81 },
          ],
        },
        {
          type: "way",
          id: 101,
          tags: { golf: "hole", ref: "2", par: "4", dist: "411" },
          geometry: [
            { lat: 56.35, lon: -2.81 },
            { lat: 56.36, lon: -2.82 },
          ],
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(overpassResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { login } = authedAgent(ctx);
    const agent = await login();

    const res = await agent
      .post("/courses/import/osm")
      .type("form")
      .send({
        osm_type: "relation",
        osm_id: "12345",
        name: "St Andrews Old Course",
        location: "St Andrews, UK",
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/courses\/\d+/);

    // Verify DB records
    const course = ctx.db
      .prepare("SELECT * FROM courses WHERE name = ?")
      .get("St Andrews Old Course") as { id: number; name: string; location: string } | undefined;

    expect(course).toBeDefined();
    expect(course!.location).toBe("St Andrews, UK");

    const holes = ctx.db
      .prepare("SELECT * FROM holes WHERE course_id = ? ORDER BY hole_number")
      .all(course!.id) as Array<{
      hole_number: number;
      par: number;
      yardage: number;
      geometry: string;
    }>;

    expect(holes).toHaveLength(2);
    expect(holes[0].hole_number).toBe(1);
    expect(holes[0].par).toBe(4);
    expect(holes[0].yardage).toBe(405); // 370m in yards

    const geo = JSON.parse(holes[0].geometry);
    expect(geo.tee).toEqual({ lat: 56.34, lng: -2.8 });
    expect(geo.green).toEqual({ lat: 56.35, lng: -2.81 });
  });

  it("imports course with no holes when Overpass returns none", async () => {
    const overpassResponse = {
      elements: [
        {
          type: "way",
          id: 999,
          tags: { leisure: "golf_course", name: "Minimal Course" },
          geometry: [],
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(overpassResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { login } = authedAgent(ctx);
    const agent = await login();

    const res = await agent
      .post("/courses/import/osm")
      .type("form")
      .send({
        osm_type: "way",
        osm_id: "999",
        name: "Minimal Course",
        location: "Somewhere",
      });

    expect(res.status).toBe(302);

    const course = ctx.db
      .prepare("SELECT * FROM courses WHERE name = ?")
      .get("Minimal Course") as { id: number } | undefined;

    expect(course).toBeDefined();

    const holes = ctx.db
      .prepare("SELECT * FROM holes WHERE course_id = ?")
      .all(course!.id);

    expect(holes).toHaveLength(0);
  });

  it("rejects import with missing OSM type", async () => {
    const { login } = authedAgent(ctx);
    const agent = await login();

    const res = await agent
      .post("/courses/import/osm")
      .type("form")
      .send({ osm_id: "123" });

    expect(res.status).toBe(400);
  });
});
