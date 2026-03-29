import { z } from "zod";

const onboardingSetupSchema = z.object({
  estimatedMembers: z.number().int().min(1).max(50000).optional(),
  estimatedCoaches: z.number().int().min(1).max(5000).optional(),
  subscriptionTypes: z
    .array(z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]))
    .min(1)
    .max(3)
    .optional(),
  currency: z.enum(["XOF", "USD", "EUR", "CAD"]).optional(),
  openingHours: z.string().min(3).max(120).optional()
});

export const registerAdminSchema = z.object({
  body: z.object({
    gymName: z.string().min(2).max(120),
    gymAddress: z.string().max(200).optional(),
    gymPhone: z
      .string()
      .regex(/^\+?[0-9][0-9\s-]{7,18}$/)
      .or(z.literal(""))
      .optional(),
    adminName: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    setup: onboardingSetupSchema.optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  })
});

export const refreshSessionSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(32).max(256)
  })
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(32).max(256)
  })
});

export const registerUserSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["COACH", "MEMBER"]),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
    speciality: z.string().optional()
  })
});
