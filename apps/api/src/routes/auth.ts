import { Router } from "express";
import { registerAdmin, login, me, registerUser } from "../controllers/authController";
import { validate } from "../middleware/validate";
import { loginSchema, registerAdminSchema, registerUserSchema } from "../validators/auth";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";

const router = Router();

router.post("/register-admin", validate(registerAdminSchema), registerAdmin);
router.post(
  "/register-user",
  requireAuth,
  requireGymContext,
  requireRole("ADMIN"),
  validate(registerUserSchema),
  registerUser
);
router.post("/login", validate(loginSchema), login);
router.get("/me", requireAuth, me);

export default router;
