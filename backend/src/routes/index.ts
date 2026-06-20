import { Router } from "express";
import authRoutes from "./auth";
import bookingRoutes from "./bookings";
import destinationRoutes from "./destinations";
import experienceRoutes from "./experiences";
import providerRoutes from "./providers";
import savedRoutes from "./saved";
import userRoutes from "./users";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Tours Connect API",
    docs: "/api-docs",
  });
});

router.use("/auth", authRoutes);
router.use("/experiences", experienceRoutes);
router.use("/destinations", destinationRoutes);
router.use("/bookings", bookingRoutes);
router.use("/saved", savedRoutes);
router.use("/providers", providerRoutes);
router.use("/users", userRoutes);

export default router;
