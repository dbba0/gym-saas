import { z } from "zod";

export const scanAttendanceSchema = z.object({
  body: z.object({
    qrToken: z.string().min(6)
  })
});

export const memberAttendanceSchema = z.object({
  body: z.object({
    programId: z.string().uuid().optional()
  })
});
