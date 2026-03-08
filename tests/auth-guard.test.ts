import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { TestContext } from "./helpers.js";
import { createTestContext } from "./helpers.js";

describe("auth guard middleware", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.db.close();
  });

  it("redirects unauthenticated users to /login", async () => {
    const res = await request(ctx.app).get("/dashboard");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  it("allows authenticated users through", async () => {
    const agent = request.agent(ctx.app);

    await agent
      .post("/register")
      .type("form")
      .send({ email: "user@example.com", password: "password123" });

    const res = await agent.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Welcome");
    expect(res.text).toContain("user@example.com");
  });

  it("shows user email on dashboard", async () => {
    const agent = request.agent(ctx.app);

    await agent
      .post("/register")
      .type("form")
      .send({ email: "alice@example.com", password: "password123" });

    const res = await agent.get("/dashboard");
    expect(res.text).toContain("alice@example.com");
  });
});
