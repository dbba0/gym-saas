import { Router } from "express";
import {
  assignMembersToCoach,
  createCoach,
  deleteCoach,
  listCoachMembers,
  listCoaches,
  updateCoach
} from "../controllers/coachController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  assignMembersToCoachSchema,
  createCoachSchema,
  updateCoachSchema
} from "../validators/coach";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/", requireRole("ADMIN"), listCoaches);
router.post("/", requireRole("ADMIN"), validate(createCoachSchema), createCoach);
router.patch("/:id", requireRole("ADMIN"), validate(updateCoachSchema), updateCoach);
router.get("/:id/members", requireRole("ADMIN", "COACH"), listCoachMembers);
router.post(
  "/:id/assign-members",
  requireRole("ADMIN"),
  validate(assignMembersToCoachSchema),
  assignMembersToCoach
);
router.delete("/:id", requireRole("ADMIN"), deleteCoach);

export default router;
