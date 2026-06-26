import { Router } from "express";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware";
import { getExperienceById } from "../repositories/experienceRepository";
import {
  listSavedExperiences,
  removeSavedExperience,
  saveExperience,
} from "../repositories/savedRepository";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("customer", "admin"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const experienceIds = await listSavedExperiences(req.user!.userId);
      const experiences = await Promise.all(
        experienceIds.map((id) => getExperienceById(id)),
      );

      res.json({
        success: true,
        data: experiences.filter(
          (experience) => experience && experience.status === "published",
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:experienceId",
  authenticate,
  authorize("customer", "admin"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const saved = await saveExperience(
        req.user!.userId,
        req.params.experienceId as string,
      );

      res.status(201).json({ success: true, data: saved });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:experienceId",
  authenticate,
  authorize("customer", "admin"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      await removeSavedExperience(
        req.user!.userId,
        req.params.experienceId as string,
      );

      res.json({
        success: true,
        message: "Experience removed from saved list",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
