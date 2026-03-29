import { z } from "zod";

export const createSubscriptionSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    priceCents: z.number().int().positive(),
    durationMonths: z.number().int().positive()
  })
});

export const updateSubscriptionSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    priceCents: z.number().int().positive().optional(),
    durationMonths: z.number().int().positive().optional()
  })
});
