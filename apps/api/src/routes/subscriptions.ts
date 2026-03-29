import { Router } from "express";
import {
  createSubscription,
  deleteSubscription,
  getMemberSubscriptionStatus,
  getMySubscriptionStatus,
  listSubscriptions,
  updateSubscription
} from "../controllers/subscriptionController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createSubscriptionSchema, updateSubscriptionSchema } from "../validators/subscription";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/", requireRole("ADMIN", "COACH", "MEMBER"), listSubscriptions);
router.get("/status/my", requireRole("MEMBER"), getMySubscriptionStatus);
router.get("/status/member/:memberId", requireRole("ADMIN", "COACH"), getMemberSubscriptionStatus);
router.post("/", requireRole("ADMIN"), validate(createSubscriptionSchema), createSubscription);
router.patch("/:id", requireRole("ADMIN"), validate(updateSubscriptionSchema), updateSubscription);
router.delete("/:id", requireRole("ADMIN"), deleteSubscription);

export default router;
