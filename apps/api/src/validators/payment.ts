import { z } from "zod";

export const createPaymentSchema = z.object({
  body: z.object({
    memberId: z.string().min(1),
    subscriptionId: z.string().optional(),
    amountCents: z.number().int().positive(),
    method: z.enum(["MOBILE_MONEY", "CARD", "CASH"])
  })
});
