import { Router } from "express";
import { requireAuth } from "../middleware/auth-guard.js";
import { layout, escapeHtml } from "../layout.js";

export function createDashboardRouter(): Router {
  const router = Router();

  router.get("/dashboard", requireAuth, (req, res) => {
    const body = `<h1>Dashboard</h1>
  <p>Welcome, ${escapeHtml(req.session.userEmail ?? "")}!</p>
  <div class="actions">
    <a href="/courses" class="btn">Courses</a>
    <a href="/bags" class="btn">My Bags</a>
  </div>`;
    res.send(layout("Dashboard", body));
  });

  return router;
}
