import { Router } from "express";
import { createPayment, listPayments } from "../controllers/paymentController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createPaymentSchema } from "../validators/payment";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/", requireRole("ADMIN", "MEMBER"), listPayments);
router.post("/", requireRole("ADMIN"), validate(createPaymentSchema), createPayment);

export default router;
