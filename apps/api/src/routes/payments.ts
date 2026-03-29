import { Router } from "express";
import {
  confirmPayment,
  createPayment,
  createPaymentIntent,
  listPayments,
  receivePaydunyaWebhook
} from "../controllers/paymentController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createPaymentIntentSchema, createPaymentSchema, paymentIdParamSchema } from "../validators/payment";

const router = Router();

router.post("/webhooks/paydunya", receivePaydunyaWebhook);

router.use(requireAuth, requireGymContext);

router.get("/", requireRole("ADMIN", "MEMBER"), listPayments);
router.post("/", requireRole("ADMIN"), validate(createPaymentSchema), createPayment);
router.post("/intents", requireRole("ADMIN", "MEMBER"), validate(createPaymentIntentSchema), createPaymentIntent);
router.post("/:id/confirm", requireRole("ADMIN", "MEMBER"), validate(paymentIdParamSchema), confirmPayment);

export default router;
