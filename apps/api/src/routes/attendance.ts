import { Router } from "express";
import {
  createMemberAttendance,
  listAttendance,
  scanAttendance
} from "../controllers/attendanceController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { memberAttendanceSchema, scanAttendanceSchema } from "../validators/attendance";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/", requireRole("ADMIN", "COACH", "MEMBER"), listAttendance);
router.post("/scan", requireRole("ADMIN", "COACH"), validate(scanAttendanceSchema), scanAttendance);
router.post("/self", requireRole("MEMBER"), validate(memberAttendanceSchema), createMemberAttendance);

export default router;
