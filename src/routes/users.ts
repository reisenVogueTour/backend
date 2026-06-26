import { Router } from "express";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware";
import { listBookingsByUser } from "../repositories/bookingRepository";
import { getExperienceById } from "../repositories/experienceRepository";
import { listSavedExperiences } from "../repositories/savedRepository";

const router = Router();

router.get(
  "/me/dashboard",
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const [bookings, savedIds] = await Promise.all([
        listBookingsByUser(req.user!.userId, 10),
        listSavedExperiences(req.user!.userId),
      ]);

      const savedExperiences = await Promise.all(
        savedIds.map((id) => getExperienceById(id)),
      );

      res.json({
        success: true,
        data: {
          recentBookings: bookings.items,
          savedExperiences: savedExperiences.filter(Boolean),
          stats: {
            totalBookings: bookings.items.length,
            totalSaved: savedExperiences.filter(Boolean).length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
