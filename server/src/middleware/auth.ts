import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AuthUser } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signUser(user: AuthUser) {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "missing_token", message: "Login is required." });
  }

  try {
    req.user = jwt.verify(token, config.JWT_SECRET) as AuthUser;
    return next();
  } catch {
    return res.status(401).json({ error: "invalid_token", message: "Session expired or invalid." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "admin_required", message: "Admin access is required." });
  }
  return next();
}
