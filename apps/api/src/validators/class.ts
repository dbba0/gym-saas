import { z } from "zod";

export const createClassSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    coachId: z.string().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    capacity: z.number().int().positive()
  })
});

export const reserveClassSchema = z.object({
  body: z.object({
    classId: z.string().min(1)
  })
});
