import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  type AuthenticatedRequest,
} from "../middleware";
import { listBookingsByProvider } from "../repositories/bookingRepository";
import { listExperiences } from "../repositories/experienceRepository";
import {
  createProvider,
  getProviderById,
  getProviderByUserId,
} from "../repositories/providerRepository";
import { AppError } from "../utils/errors";
import { toPublicProvider } from "../utils/provider";
import { createProviderSchema } from "../validators/schemas";

const router = Router();

router.post(
  "/application",
  authenticate,
  authorize("provider"),
  validateBody(createProviderSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const provider = await createProvider({
        userId: req.user!.userId,
        ...req.body,
      });

      res.status(201).json({
        success: true,
        message: "Provider application submitted and pending admin review",
        data: provider,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/me/dashboard",
  authenticate,
  authorize("provider", "admin"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const provider = await getProviderByUserId(req.user!.userId);

      if (!provider) {
        throw new AppError(
          404,
          "No provider application found. Submit one at POST /api/providers/application",
        );
      }

      const [experiences, bookings] = await Promise.all([
        listExperiences({ providerId: provider.providerId, limit: 50 }),
        provider.applicationStatus === "approved"
          ? listBookingsByProvider(provider.providerId, 10)
          : Promise.resolve({ items: [], nextCursor: undefined }),
      ]);

      const publishedCount = experiences.items.filter(
        (item) => item.status === "published",
      ).length;
      const draftCount = experiences.items.filter(
        (item) => item.status === "draft",
      ).length;

      res.json({
        success: true,
        data: {
          profile: provider,
          applicationStatus: provider.applicationStatus,
          canManageExperiences: provider.applicationStatus === "approved",
          experiences: experiences.items,
          recentBookings: bookings.items,
          stats: {
            totalExperiences: experiences.items.length,
            publishedExperiences: publishedCount,
            draftExperiences: draftCount,
            pendingBookings: bookings.items.filter(
              (booking) => booking.status === "pending",
            ).length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/me/experiences",
  authenticate,
  authorize("provider", "admin"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const provider = await getProviderByUserId(req.user!.userId);

      if (!provider) {
        throw new AppError(404, "Provider profile not found");
      }

      const result = await listExperiences({
        providerId: provider.providerId,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/me",
  authenticate,
  authorize("provider", "admin"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const provider = await getProviderByUserId(req.user!.userId);

      if (!provider) {
        throw new AppError(404, "Provider profile not found");
      }

      res.json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:providerId/experiences", async (req, res, next) => {
  try {
    const provider = await getProviderById(req.params.providerId as string);

    if (!provider || provider.applicationStatus !== "approved") {
      throw new AppError(404, "Provider not found");
    }

    const result = await listExperiences({
      providerId: provider.providerId,
      status: "published",
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/:providerId", async (req, res, next) => {
  try {
    const provider = await getProviderById(req.params.providerId as string);

    if (!provider || provider.applicationStatus !== "approved") {
      throw new AppError(404, "Provider not found");
    }

    res.json({ success: true, data: toPublicProvider(provider) });
  } catch (error) {
    next(error);
  }
});

export default router;
