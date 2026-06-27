import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "../types/contract";
import type { AuthService } from "./AuthService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Express middleware that verifies the Bearer token and attaches req.user. */
export function requireAuth(auth: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    try {
      req.user = await auth.verify(token);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}
