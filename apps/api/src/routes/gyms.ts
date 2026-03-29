import { Router } from "express";
import { createGym, getCurrentGym, updateCurrentGym } from "../controllers/gymController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createGymSchema, updateGymSchema } from "../validators/gym";

const router = Router();

router.post("/", validate(createGymSchema), createGym);
router.get(
  "/me",
  requireAuth,
  requireGymContext,
  requireRole("ADMIN", "COACH", "MEMBER"),
  getCurrentGym
);
router.patch(
  "/me",
  requireAuth,
  requireGymContext,
  requireRole("ADMIN"),
  validate(updateGymSchema),
  updateCurrentGym
);

export default router;
