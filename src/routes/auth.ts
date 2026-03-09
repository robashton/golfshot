import { Router } from "express";
import bcrypt from "bcrypt";
import type Database from "better-sqlite3";
import { layout, escapeHtml } from "../layout.js";

const SALT_ROUNDS = 10;

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export function createAuthRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/register", (_req, res) => {
    res.send(registerPage());
  });

  router.post("/register", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).send(registerPage("Email and password are required."));
      return;
    }

    if (password.length < 8) {
      res.status(400).send(registerPage("Password must be at least 8 characters."));
      return;
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as UserRow | undefined;
    if (existing) {
      res.status(409).send(registerPage("An account with that email already exists."));
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db
      .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
      .run(email, passwordHash);

    req.session.userId = Number(result.lastInsertRowid);
    req.session.userEmail = email;
    req.session.save(() => {
      res.redirect("/dashboard");
    });
  });

  router.get("/login", (_req, res) => {
    res.send(loginPage());
  });

  router.post("/login", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).send(loginPage("Email and password are required."));
      return;
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    if (!user) {
      res.status(401).send(loginPage("Invalid email or password."));
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).send(loginPage("Invalid email or password."));
      return;
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.save(() => {
      res.redirect("/dashboard");
    });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });

  return router;
}

function registerPage(error?: string): string {
  const body = `<div class="auth-page">
  <h1>Register</h1>
  <div class="card">
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <form method="POST" action="/register">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required minlength="8">
      </div>
      <div class="form-actions">
        <button type="submit">Register</button>
      </div>
    </form>
  </div>
  <p class="auth-footer">Already have an account? <a href="/login">Log in</a></p>
</div>`;
  return layout("Register", body, false);
}

function loginPage(error?: string): string {
  const body = `<div class="auth-page">
  <h1>Login</h1>
  <div class="card">
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <form method="POST" action="/login">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required>
      </div>
      <div class="form-actions">
        <button type="submit">Login</button>
      </div>
    </form>
  </div>
  <p class="auth-footer">Don't have an account? <a href="/register">Register</a></p>
</div>`;
  return layout("Login", body, false);
}
