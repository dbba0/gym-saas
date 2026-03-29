import { Router } from "express";
import {
  createProgress,
  createSelfProgress,
  listProgress
} from "../controllers/progressController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createProgressSchema, createSelfProgressSchema } from "../validators/progress";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/:memberId", requireRole("ADMIN", "COACH", "MEMBER"), listProgress);
router.post("/", requireRole("ADMIN", "COACH"), validate(createProgressSchema), createProgress);
router.post("/self", requireRole("MEMBER"), validate(createSelfProgressSchema), createSelfProgress);

export default router;
