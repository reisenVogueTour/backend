import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateQuery,
} from "../middleware";
import {
  createDestination,
  getDestinationBySlug,
  listDestinations,
} from "../repositories/destinationRepository";
import { AppError } from "../utils/errors";
import {
  createDestinationSchema,
  paginationQuerySchema,
} from "../validators/schemas";

const router = Router();

router.get("/", validateQuery(paginationQuerySchema), async (req, res, next) => {
  try {
    const featured =
      req.query.featured === "true"
        ? true
        : req.query.featured === "false"
          ? false
          : undefined;

    const result = await listDestinations({
      ...(featured !== undefined ? { featured } : {}),
      ...(req.query.limit ? { limit: Number(req.query.limit) } : {}),
      ...(req.query.cursor ? { cursor: req.query.cursor as string } : {}),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/featured", async (_req, res, next) => {
  try {
    const result = await listDestinations({ featured: true, limit: 10 });
    res.json({ success: true, data: result.items });
  } catch (error) {
    next(error);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const destination = await getDestinationBySlug(req.params.slug);

    if (!destination) {
      throw new AppError(404, "Destination not found");
    }

    res.json({ success: true, data: destination });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  authenticate,
  authorize("admin"),
  validateBody(createDestinationSchema),
  async (req, res, next) => {
    try {
      const destination = await createDestination(req.body);
      res.status(201).json({ success: true, data: destination });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
