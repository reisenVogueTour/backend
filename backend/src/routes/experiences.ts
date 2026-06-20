import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateQuery,
  type AuthenticatedRequest,
} from "../middleware";
import {
  createExperience,
  getExperienceById,
  listExperiences,
  updateExperience,
} from "../repositories/experienceRepository";
import { getProviderByUserId } from "../repositories/providerRepository";
import { AppError } from "../utils/errors";
import {
  createExperienceSchema,
  experienceQuerySchema,
  updateExperienceSchema,
} from "../validators/schemas";

const router = Router();

router.get("/", validateQuery(experienceQuerySchema), async (req, res, next) => {
  try {
    const result = await listExperiences({
      ...req.query,
      status: "published",
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/featured", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const result = await listExperiences({
      featured: true,
      status: "published",
      limit,
    });

    res.json({ success: true, data: result.items });
  } catch (error) {
    next(error);
  }
});

router.get("/:experienceId", async (req, res, next) => {
  try {
    const experience = await getExperienceById(req.params.experienceId as string);

    if (!experience || experience.status !== "published") {
      throw new AppError(404, "Experience not found");
    }

    res.json({ success: true, data: experience });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  authenticate,
  authorize("provider", "admin"),
  validateBody(createExperienceSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const provider = await getProviderByUserId(req.user!.userId);

      if (!provider) {
        throw new AppError(
          403,
          "Create a provider profile before listing experiences",
        );
      }

      const experience = await createExperience({
        providerId: provider.providerId,
        ...req.body,
      });

      res.status(201).json({ success: true, data: experience });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:experienceId",
  authenticate,
  authorize("provider", "admin"),
  validateBody(updateExperienceSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await getExperienceById(req.params.experienceId as string);

      if (!existing) {
        throw new AppError(404, "Experience not found");
      }

      if (req.user!.role !== "admin") {
        const provider = await getProviderByUserId(req.user!.userId);

        if (!provider || provider.providerId !== existing.providerId) {
          throw new AppError(403, "You can only update your own listings");
        }
      }

      const experience = await updateExperience(
        req.params.experienceId as string,
        req.body,
      );

      res.json({ success: true, data: experience });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
