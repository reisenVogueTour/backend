import { Router } from "express";
import { authenticate, validateBody, validateQuery } from "../middleware";
import { ensureDestinationExists } from "../repositories/destinationRepository";
import { getExperienceById } from "../repositories/experienceRepository";
import {
  completeCheckpoint,
  deleteItinerary,
  getCurrentItinerary,
  getItineraryById,
  listItinerariesByUser,
  saveItinerary,
} from "../repositories/itineraryRepository";
import { buildItinerary, markStarted } from "../services/itineraryBuilder";
import { sequenceExperiences } from "../services/itinerarySequencer";
import { AppError } from "../utils/errors";
import {
  generateItinerarySchema,
  paginationQuerySchema,
  saveItinerarySchema,
} from "../validators/schemas";
import type { DurationUnit, Experience } from "../types";
import type { AuthenticatedRequest } from "../middleware";
const router = Router();

async function fetchPublishedExperiences(
  experienceIds: string[],
  destinationSlug: string,
): Promise<Experience[]> {
  const fetched = await Promise.all(
    experienceIds.map((id) => getExperienceById(id)),
  );

  return fetched.filter(
    (experience): experience is Experience =>
      experience !== null &&
      experience.status === "published" &&
      experience.destinationSlug === destinationSlug,
  );
}

router.post(
  "/generate",
  authenticate,
  validateBody(generateItinerarySchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        destinationSlug,
        prompt,
        experienceIds,
        durationValue,
        durationUnit,
      } = req.body as {
        destinationSlug: string;
        prompt: string;
        experienceIds: string[];
        durationValue: number;
        durationUnit: DurationUnit;
      };

      const destination = await ensureDestinationExists(destinationSlug);
      const pool = await fetchPublishedExperiences(
        experienceIds,
        destination.destinationSlug,
      );

      if (pool.length === 0) {
        throw new AppError(400, "No valid experiences to build an itinerary");
      }

      const sequenced = await sequenceExperiences(
        pool,
        durationValue,
        durationUnit,
      );

      const itinerary = buildItinerary({
        userId: req.user!.userId,
        destination: destination.name,
        destinationSlug: destination.destinationSlug,
        prompt,
        durationValue,
        durationUnit,
        sequenced,
      });

      res.json({ success: true, data: { itinerary } });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  authenticate,
  validateBody(saveItinerarySchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        destinationSlug,
        prompt,
        experienceIds,
        durationValue,
        durationUnit,
        start,
      } = req.body as {
        destinationSlug: string;
        prompt: string;
        experienceIds: string[];
        durationValue: number;
        durationUnit: DurationUnit;
        start: boolean;
      };

      const destination = await ensureDestinationExists(destinationSlug);
      const sequenced = await fetchPublishedExperiences(
        experienceIds,
        destination.destinationSlug,
      );

      if (sequenced.length === 0) {
        throw new AppError(400, "No valid experiences to build an itinerary");
      }

      let itinerary = buildItinerary({
        userId: req.user!.userId,
        destination: destination.name,
        destinationSlug: destination.destinationSlug,
        prompt,
        durationValue,
        durationUnit,
        sequenced,
      });

      if (start) {
        itinerary = markStarted(itinerary);
      }

      await saveItinerary(itinerary);

      res.status(201).json({ success: true, data: itinerary });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/current",
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const itinerary = await getCurrentItinerary(req.user!.userId);
      res.json({ success: true, data: itinerary });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/",
  authenticate,
  validateQuery(paginationQuerySchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { limit, cursor } = req.query as {
        limit?: number;
        cursor?: string;
      };
      const result = await listItinerariesByUser(
        req.user!.userId,
        limit,
        cursor,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:itineraryId",
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const itinerary = await getItineraryById(
        req.params.itineraryId as string,
      );

      if (!itinerary) {
        throw new AppError(404, "Itinerary not found");
      }

      if (itinerary.userId !== req.user!.userId) {
        throw new AppError(403, "You can only view your own itinerary");
      }

      res.json({ success: true, data: itinerary });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:itineraryId/start",
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const existing = await getItineraryById(req.params.itineraryId as string);

      if (!existing) {
        throw new AppError(404, "Itinerary not found");
      }

      if (existing.userId !== req.user!.userId) {
        throw new AppError(403, "You can only update your own itinerary");
      }

      if (existing.status === "in_progress") {
        res.json({ success: true, data: existing });
        return;
      }

      if (existing.status === "completed") {
        throw new AppError(400, "This itinerary is already completed");
      }

      const started = markStarted(existing);
      await saveItinerary(started);

      res.json({ success: true, data: started });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:itineraryId/checkpoints/:checkpointId/complete",
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const updated = await completeCheckpoint(
        req.params.itineraryId as string,
        req.user!.userId,
        req.params.checkpointId as string,
      );

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:itineraryId",
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      await deleteItinerary(req.params.itineraryId as string, req.user!.userId);
      res.json({ success: true, message: "Itinerary deleted" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
