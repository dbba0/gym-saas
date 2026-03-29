import { Router } from "express";
import { cancelReservation, createClass, listClasses, reserveClass } from "../controllers/classController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createClassSchema, reserveClassSchema } from "../validators/class";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/", requireRole("ADMIN", "COACH", "MEMBER"), listClasses);
router.post("/", requireRole("ADMIN"), validate(createClassSchema), createClass);
router.post("/reserve", requireRole("MEMBER"), validate(reserveClassSchema), reserveClass);
router.patch("/reservation/:id/cancel", requireRole("MEMBER"), cancelReservation);

export default router;
