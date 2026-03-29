import { z } from "zod";

export const paymentMethodEnum = z.enum([
  "WAVE",
  "ORANGE_MONEY",
  "FREE_MONEY",
  "MOBILE_MONEY",
  "CARD",
  "CASH"
]);

export const senegalMobileMoneyEnum = z.enum(["WAVE", "ORANGE_MONEY", "FREE_MONEY"]);

export const createPaymentSchema = z.object({
  body: z.object({
    memberId: z.string().min(1),
    subscriptionId: z.string().optional(),
    amountCents: z.number().int().positive(),
    method: paymentMethodEnum
  })
});

export const createPaymentIntentSchema = z.object({
  body: z.object({
    memberId: z.string().min(1).optional(),
    subscriptionId: z.string().min(1),
    amountCents: z.number().int().positive().optional(),
    method: senegalMobileMoneyEnum
  })
});

export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  })
});
