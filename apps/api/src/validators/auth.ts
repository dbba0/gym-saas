import { z } from "zod";

export const registerAdminSchema = z.object({
  body: z.object({
    gymName: z.string().min(2),
    gymAddress: z.string().optional(),
    gymPhone: z.string().optional(),
    adminName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6)
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
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
