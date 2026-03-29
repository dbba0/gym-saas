import { z } from "zod";

export const createMemberSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    phone: z.string().optional(),
    subscriptionId: z.string().optional(),
    coachId: z.string().optional()
  })
});

export const updateMemberSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    subscriptionId: z.string().optional(),
    coachId: z.string().optional(),
    notes: z.string().optional()
  })
});
