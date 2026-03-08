import { Router } from "express";
import bcrypt from "bcrypt";
import type Database from "better-sqlite3";

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
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Register - Golfshot</title></head>
<body>
  <h1>Register</h1>
  ${error ? `<p style="color:red">${error}</p>` : ""}
  <form method="POST" action="/register">
    <label>Email: <input type="email" name="email" required></label><br>
    <label>Password: <input type="password" name="password" required minlength="8"></label><br>
    <button type="submit">Register</button>
  </form>
  <p>Already have an account? <a href="/login">Log in</a></p>
</body>
</html>`;
}

function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login - Golfshot</title></head>
<body>
  <h1>Login</h1>
  ${error ? `<p style="color:red">${error}</p>` : ""}
  <form method="POST" action="/login">
    <label>Email: <input type="email" name="email" required></label><br>
    <label>Password: <input type="password" name="password" required></label><br>
    <button type="submit">Login</button>
  </form>
  <p>Don't have an account? <a href="/register">Register</a></p>
</body>
</html>`;
}
