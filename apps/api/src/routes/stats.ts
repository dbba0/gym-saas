import { Router } from "express";
import { getStats } from "../controllers/statsController";
import { requireAuth, requireGymContext, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireGymContext);
router.get("/", requireRole("ADMIN"), getStats);

export default router;
