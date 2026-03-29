import crypto from "crypto";
import type { Request } from "express";
import { env } from "../config/env";

const REFRESH_TOKEN_BYTES = 48;

export function generateRefreshTokenValue() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

export function hashRefreshToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getRefreshTokenExpiryDate(now = Date.now()) {
  return new Date(now + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function readClientMetadata(req: Request) {
  const forwarded = req.header("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.ip || null;
  const userAgent = req.header("user-agent") || null;
  return {
    ip: ip?.slice(0, 120) || null,
    userAgent: userAgent?.slice(0, 255) || null
  };
}
