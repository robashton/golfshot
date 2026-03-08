import { Router } from "express";
import { requireAuth } from "../middleware/auth-guard.js";

export function createDashboardRouter(): Router {
  const router = Router();

  router.get("/dashboard", requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Dashboard - Golfshot</title></head>
<body>
  <h1>Dashboard</h1>
  <p>Welcome, ${req.session.userEmail}!</p>
  <p><a href="/courses">Courses</a></p>
  <form method="POST" action="/logout">
    <button type="submit">Logout</button>
  </form>
</body>
</html>`);
  });

  return router;
}
