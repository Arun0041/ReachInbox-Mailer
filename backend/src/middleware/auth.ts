import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface SessionUser {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, config.sessionSecret, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionUser | null {
  try {
    return jwt.verify(token, config.sessionSecret) as SessionUser;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "session";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.cookies?.[SESSION_COOKIE] as string) ?? "";
  const user = verifySession(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = user;
  next();
}
