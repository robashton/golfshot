import express from "express";
import session from "express-session";
import type Database from "better-sqlite3";
import { SqliteSessionStore } from "./db/session-store.js";
import { createAuthRouter } from "./routes/auth.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createCoursesRouter } from "./routes/courses.js";
import { createBagsRouter } from "./routes/bags.js";
import { createStrategiesRouter } from "./routes/strategies.js";

export function createApp(db: Database.Database): express.Express {
  const app = express();

  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      store: new SqliteSessionStore(db),
      secret: process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  app.use(createAuthRouter(db));
  app.use(createDashboardRouter());
  app.use(createCoursesRouter(db));
  app.use(createBagsRouter(db));
  app.use(createStrategiesRouter(db));

  app.get("/", (_req, res) => {
    res.redirect("/login");
  });

  return app;
}
