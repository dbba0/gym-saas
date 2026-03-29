import { Router } from "express";
import {
  addExercisesToProgram,
  assignProgramToMember,
  createProgram,
  deleteProgram,
  listPrograms,
  updateProgram
} from "../controllers/programController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  addExercisesSchema,
  assignProgramSchema,
  createProgramSchema,
  updateProgramSchema
} from "../validators/program";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/", requireRole("ADMIN", "COACH", "MEMBER"), listPrograms);
router.post("/", requireRole("ADMIN", "COACH"), validate(createProgramSchema), createProgram);
router.patch("/:id", requireRole("ADMIN", "COACH"), validate(updateProgramSchema), updateProgram);
router.post(
  "/:id/exercises",
  requireRole("ADMIN", "COACH"),
  validate(addExercisesSchema),
  addExercisesToProgram
);
router.patch(
  "/:id/assign",
  requireRole("ADMIN", "COACH"),
  validate(assignProgramSchema),
  assignProgramToMember
);
router.delete("/:id", requireRole("ADMIN", "COACH"), deleteProgram);

export default router;
