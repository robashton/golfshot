import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userEmail?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
}
