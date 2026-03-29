import { Router } from "express";
import authRoutes from "./auth";
import memberRoutes from "./members";
import coachRoutes from "./coaches";
import subscriptionRoutes from "./subscriptions";
import programRoutes from "./programs";
import paymentRoutes from "./payments";
import attendanceRoutes from "./attendance";
import statsRoutes from "./stats";
import classRoutes from "./classes";
import progressRoutes from "./progress";
import gymRoutes from "./gyms";

const router = Router();

router.use("/auth", authRoutes);
router.use("/members", memberRoutes);
router.use("/coaches", coachRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/programs", programRoutes);
router.use("/payments", paymentRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/stats", statsRoutes);
router.use("/classes", classRoutes);
router.use("/progress", progressRoutes);
router.use("/gyms", gymRoutes);

export default router;
