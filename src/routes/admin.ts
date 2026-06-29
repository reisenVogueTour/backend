import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateQuery,
  type AuthenticatedRequest,
} from "../middleware";
import {
  countProviderApplications,
  getProviderById,
  listProviderApplications,
  reviewProviderApplication,
  deleteProvider,
} from "../repositories/providerRepository";
import { AppError } from "../utils/errors";
import {
  providerApplicationQuerySchema,
  reviewProviderApplicationSchema,
} from "../validators/schemas";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/dashboard", async (_req, res, next) => {
  try {
    const [pendingCount, approvedCount, rejectedCount, pendingApplications] =
      await Promise.all([
        countProviderApplications("pending"),
        countProviderApplications("approved"),
        countProviderApplications("rejected"),
        listProviderApplications({ status: "pending", limit: 5 }),
      ]);

    res.json({
      success: true,
      data: {
        stats: {
          pendingApplications: pendingCount,
          approvedProviders: approvedCount,
          rejectedApplications: rejectedCount,
        },
        recentPendingApplications: pendingApplications.items,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/providers/applications",
  validateQuery(providerApplicationQuerySchema),
  async (req, res, next) => {
    try {
      const { status, limit, cursor } = req.query as {
        status?: "pending" | "approved" | "rejected";
        limit?: number;
        cursor?: string;
      };

      const result = await listProviderApplications({
        ...(status ? { status } : {}),
        ...(limit ? { limit } : {}),
        ...(cursor ? { cursor } : {}),
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/providers/applications/:providerId", async (req, res, next) => {
  try {
    const provider = await getProviderById(req.params.providerId as string);

    if (!provider) {
      throw new AppError(404, "Provider application not found");
    }

    res.json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/providers/applications/:providerId/review",
  validateBody(reviewProviderApplicationSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const provider = await reviewProviderApplication({
        providerId: req.params.providerId as string,
        adminUserId: req.user!.userId,
        status: req.body.status,
        rejectionReason: req.body.rejectionReason,
      });

      res.json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/providers/applications/:providerId",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      await deleteProvider(req.params.providerId as string);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
