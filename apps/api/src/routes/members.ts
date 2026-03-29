import { Router } from "express";
import {
  createMember,
  deleteMember,
  getMember,
  getMemberQr,
  getMyMember,
  listMembers,
  updateMember
} from "../controllers/memberController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createMemberSchema, updateMemberSchema } from "../validators/member";

const router = Router();

router.use(requireAuth, requireGymContext);

router.get("/me", requireRole("MEMBER"), getMyMember);
router.get("/me/qr", requireRole("MEMBER"), getMemberQr);

router.get("/", requireRole("ADMIN", "COACH"), listMembers);
router.get("/:id", requireRole("ADMIN", "COACH"), getMember);
router.post("/", requireRole("ADMIN"), validate(createMemberSchema), createMember);
router.patch("/:id", requireRole("ADMIN", "COACH"), validate(updateMemberSchema), updateMember);
router.delete("/:id", requireRole("ADMIN"), deleteMember);

export default router;
