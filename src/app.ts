import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import type Database from "better-sqlite3";
import { SqliteSessionStore } from "./db/session-store.js";
import { createAuthRouter } from "./routes/auth.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createCoursesRouter } from "./routes/courses.js";
import { createBagsRouter } from "./routes/bags.js";
import { createStrategiesRouter } from "./routes/strategies.js";
import { logger } from "./logger.js";
import { layout } from "./layout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db: Database.Database): express.Express {
  const app = express();

  app.use(express.static(path.join(__dirname, "..", "public")));
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

  // Error-handling middleware — must be last
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const status = (err as { status?: number }).status ?? 500;

    logger.error(`${req.method} ${req.url} → ${status}: ${message}`, stack);

    res.status(status).send(
      layout("Error", `<h1>Something went wrong</h1><p>An unexpected error occurred. Please try again.</p><p><a href="/">Go home</a></p>`)
    );
  });

  return app;
}
