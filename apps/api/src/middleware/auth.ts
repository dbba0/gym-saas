import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";
import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";

export type AuthContext = {
  userId: string;
  role: Role;
  gymId: string | null;
};

export type AuthRequest = Request & { auth?: AuthContext };

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "Missing authorization header", code: "AUTH_MISSING" });
  }
  const token = header.replace("Bearer ", "");
  try {
    const payload = verifyToken(token);
    req.auth = { userId: payload.sub, role: payload.role, gymId: payload.gymId };
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Session expired", code: "AUTH_TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Invalid token", code: "AUTH_INVALID_TOKEN" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}

export function requireGymContext(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!req.auth.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  return next();
}
