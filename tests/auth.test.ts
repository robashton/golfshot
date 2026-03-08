import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { TestContext } from "./helpers.js";
import { createTestContext } from "./helpers.js";

describe("auth endpoints", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(() => {
    ctx.db.close();
  });

  describe("GET /register", () => {
    it("returns the registration form", async () => {
      const res = await request(ctx.app).get("/register");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Register");
      expect(res.text).toContain('action="/register"');
    });
  });

  describe("POST /register", () => {
    it("creates a user and redirects to dashboard", async () => {
      const res = await request(ctx.app)
        .post("/register")
        .type("form")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/dashboard");

      const user = ctx.db.prepare("SELECT * FROM users WHERE email = ?").get("test@example.com") as {
        email: string;
        password_hash: string;
      };
      expect(user).toBeTruthy();
      expect(user.password_hash).not.toBe("password123");
    });

    it("rejects missing email", async () => {
      const res = await request(ctx.app)
        .post("/register")
        .type("form")
        .send({ password: "password123" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Email and password are required");
    });

    it("rejects missing password", async () => {
      const res = await request(ctx.app)
        .post("/register")
        .type("form")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Email and password are required");
    });

    it("rejects short password", async () => {
      const res = await request(ctx.app)
        .post("/register")
        .type("form")
        .send({ email: "test@example.com", password: "short" });

      expect(res.status).toBe(400);
      expect(res.text).toContain("Password must be at least 8 characters");
    });

    it("rejects duplicate email", async () => {
      await request(ctx.app)
        .post("/register")
        .type("form")
        .send({ email: "test@example.com", password: "password123" });

      const res = await request(ctx.app)
        .post("/register")
        .type("form")
        .send({ email: "test@example.com", password: "password456" });

      expect(res.status).toBe(409);
      expect(res.text).toContain("already exists");
    });
  });

  describe("GET /login", () => {
    it("returns the login form", async () => {
      const res = await request(ctx.app).get("/login");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Login");
      expect(res.text).toContain('action="/login"');
    });
  });

  describe("POST /login", () => {
    beforeEach(async () => {
      await request(ctx.app)
        .post("/register")
        .type("form")
        .send({ email: "user@example.com", password: "password123" });
    });

    it("logs in with valid credentials and redirects", async () => {
      const res = await request(ctx.app)
        .post("/login")
        .type("form")
        .send({ email: "user@example.com", password: "password123" });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/dashboard");
    });

    it("rejects invalid email", async () => {
      const res = await request(ctx.app)
        .post("/login")
        .type("form")
        .send({ email: "wrong@example.com", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.text).toContain("Invalid email or password");
    });

    it("rejects invalid password", async () => {
      const res = await request(ctx.app)
        .post("/login")
        .type("form")
        .send({ email: "user@example.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.text).toContain("Invalid email or password");
    });

    it("rejects missing fields", async () => {
      const res = await request(ctx.app)
        .post("/login")
        .type("form")
        .send({});

      expect(res.status).toBe(400);
      expect(res.text).toContain("Email and password are required");
    });
  });

  describe("POST /logout", () => {
    it("redirects to login after logout", async () => {
      const agent = request.agent(ctx.app);

      await agent
        .post("/register")
        .type("form")
        .send({ email: "user@example.com", password: "password123" });

      const res = await agent.post("/logout");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });

    it("cannot access dashboard after logout", async () => {
      const agent = request.agent(ctx.app);

      await agent
        .post("/register")
        .type("form")
        .send({ email: "user@example.com", password: "password123" });

      await agent.post("/logout");

      const res = await agent.get("/dashboard");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });
  });
});
