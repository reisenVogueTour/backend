import { Router } from "express";
import adminRoutes from "./admin";
import authRoutes from "./auth";
import bookingRoutes from "./bookings";
import destinationRoutes from "./destinations";
import experienceRoutes from "./experiences";
import itineraryRoutes from "./itineraries";
import providerRoutes from "./providers";
import savedRoutes from "./saved";
import userRoutes from "./users";
import uploadsRoutes from "./uploads";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Resisen API",
    docs: "/api-docs",
  });
});

router.use("/admin", adminRoutes);
router.use("/auth", authRoutes);
router.use("/experiences", experienceRoutes);
router.use("/destinations", destinationRoutes);
router.use("/itineraries", itineraryRoutes);
router.use("/bookings", bookingRoutes);
router.use("/saved", savedRoutes);
router.use("/providers", providerRoutes);
router.use("/users", userRoutes);
router.use("/uploads", uploadsRoutes);

export default router;
