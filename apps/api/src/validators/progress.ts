import { z } from "zod";

export const createProgressSchema = z.object({
  body: z.object({
    memberId: z.string().min(1),
    weightKg: z.number().optional(),
    bodyFatPct: z.number().optional(),
    notes: z.string().optional()
  })
});

export const createSelfProgressSchema = z.object({
  body: z.object({
    weightKg: z.number().optional(),
    bodyFatPct: z.number().optional(),
    notes: z.string().optional()
  })
});
