import { z } from "zod";

const exerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  restSeconds: z.number().int().positive()
});

export const createProgramSchema = z.object({
  body: z.object({
    coachId: z.string().optional(),
    memberId: z.string().optional(),
    isPublic: z.boolean().optional(),
    title: z.string().min(2),
    description: z.string().optional(),
    exercises: z.array(exerciseSchema).optional()
  })
});

export const updateProgramSchema = z.object({
  body: z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    isPublic: z.boolean().optional()
  })
});

export const addExercisesSchema = z.object({
  body: z.object({
    exercises: z.array(exerciseSchema).min(1)
  })
});

export const assignProgramSchema = z.object({
  body: z.object({
    memberId: z.string().nullable()
  })
});
