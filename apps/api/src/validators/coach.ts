import { z } from "zod";

export const createCoachSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    speciality: z.string().optional(),
    bio: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    phone: z.string().optional()
  })
});

export const updateCoachSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    speciality: z.string().optional(),
    bio: z.string().optional()
  })
});

export const assignMembersToCoachSchema = z.object({
  body: z.object({
    memberIds: z.array(z.string().min(1)).min(1)
  })
});
