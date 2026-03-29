import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("7d"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
  CORS_ORIGIN: z.string().default("*"),
  API_PUBLIC_BASE_URL: z.string().url(),
  PAYMENT_PROVIDER: z.enum(["PAYDUNYA"]).default("PAYDUNYA"),
  PAYMENT_CURRENCY: z.string().default("XOF"),
  PAYDUNYA_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYDUNYA_MASTER_KEY: z.string().optional(),
  PAYDUNYA_PRIVATE_KEY: z.string().optional(),
  PAYDUNYA_TOKEN: z.string().optional(),
  PAYDUNYA_CREATE_URL: z.string().optional(),
  PAYDUNYA_CONFIRM_BASE_URL: z.string().optional(),
  PAYDUNYA_CALLBACK_URL: z.string().optional(),
  PAYDUNYA_RETURN_URL: z.string().optional(),
  PAYDUNYA_CANCEL_URL: z.string().optional(),
  PAYDUNYA_WEBHOOK_SECRET: z.string().optional(),
  PAYDUNYA_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300)
});

export const env = envSchema.parse({
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  REFRESH_TOKEN_TTL_DAYS: process.env.REFRESH_TOKEN_TTL_DAYS,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  API_PUBLIC_BASE_URL: process.env.API_PUBLIC_BASE_URL,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  PAYMENT_CURRENCY: process.env.PAYMENT_CURRENCY,
  PAYDUNYA_MODE: process.env.PAYDUNYA_MODE,
  PAYDUNYA_MASTER_KEY: process.env.PAYDUNYA_MASTER_KEY,
  PAYDUNYA_PRIVATE_KEY: process.env.PAYDUNYA_PRIVATE_KEY,
  PAYDUNYA_TOKEN: process.env.PAYDUNYA_TOKEN,
  PAYDUNYA_CREATE_URL: process.env.PAYDUNYA_CREATE_URL,
  PAYDUNYA_CONFIRM_BASE_URL: process.env.PAYDUNYA_CONFIRM_BASE_URL,
  PAYDUNYA_CALLBACK_URL: process.env.PAYDUNYA_CALLBACK_URL,
  PAYDUNYA_RETURN_URL: process.env.PAYDUNYA_RETURN_URL,
  PAYDUNYA_CANCEL_URL: process.env.PAYDUNYA_CANCEL_URL,
  PAYDUNYA_WEBHOOK_SECRET: process.env.PAYDUNYA_WEBHOOK_SECRET,
  PAYDUNYA_WEBHOOK_TOLERANCE_SECONDS: process.env.PAYDUNYA_WEBHOOK_TOLERANCE_SECONDS
});
