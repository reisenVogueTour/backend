import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  type AuthenticatedRequest,
} from "../middleware";
import { listExperiences } from "../repositories/experienceRepository";
import {
  createProvider,
  getProviderById,
  getProviderByUserId,
} from "../repositories/providerRepository";
import { AppError } from "../utils/errors";
import { createProviderSchema } from "../validators/schemas";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("provider", "admin"),
  validateBody(createProviderSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const provider = await createProvider({
        userId: req.user!.userId,
        ...req.body,
      });

      res.status(201).json({ success: true, data: provider });
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
    const provider = await getProviderById(req.params.providerId);

    if (!provider) {
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
    const provider = await getProviderById(req.params.providerId);

    if (!provider) {
      throw new AppError(404, "Provider not found");
    }

    res.json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
});

export default router;
