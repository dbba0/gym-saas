import { z } from "zod";

export const createGymSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    address: z.string().optional(),
    phone: z.string().optional()
  })
});

export const updateGymSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    address: z.string().optional(),
    phone: z.string().optional()
  })
});
