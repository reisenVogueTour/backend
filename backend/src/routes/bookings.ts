import { Router } from "express";
import {
  authenticate,
  authorize,
  validateBody,
  validateQuery,
  type AuthenticatedRequest,
} from "../middleware";
import {
  createBooking,
  getBookingById,
  listBookingsByProvider,
  listBookingsByUser,
  updateBookingStatus,
} from "../repositories/bookingRepository";
import { getProviderByUserId } from "../repositories/providerRepository";
import { AppError } from "../utils/errors";
import {
  createBookingSchema,
  paginationQuerySchema,
  updateBookingStatusSchema,
} from "../validators/schemas";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("customer", "admin"),
  validateBody(createBookingSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const booking = await createBooking({
        userId: req.user!.userId,
        ...req.body,
      });

      res.status(201).json({ success: true, data: booking });
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

      if (req.user!.role === "provider") {
        const provider = await getProviderByUserId(req.user!.userId);

        if (!provider) {
          throw new AppError(403, "Provider profile not found");
        }

        const result = await listBookingsByProvider(
          provider.providerId,
          limit,
          cursor,
        );

        res.json({ success: true, data: result });
        return;
      }

      const result = await listBookingsByUser(
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
  "/:bookingId",
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const booking = await getBookingById(req.params.bookingId as string);

      if (!booking) {
        throw new AppError(404, "Booking not found");
      }

      if (req.user!.role === "admin") {
        res.json({ success: true, data: booking });
        return;
      }

      if (booking.userId === req.user!.userId) {
        res.json({ success: true, data: booking });
        return;
      }

      if (req.user!.role === "provider") {
        const provider = await getProviderByUserId(req.user!.userId);

        if (provider && provider.providerId === booking.providerId) {
          res.json({ success: true, data: booking });
          return;
        }
      }

      throw new AppError(403, "You do not have access to this booking");
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:bookingId/status",
  authenticate,
  authorize("provider", "admin"),
  validateBody(updateBookingStatusSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const booking = await getBookingById(req.params.bookingId as string);

      if (!booking) {
        throw new AppError(404, "Booking not found");
      }

      if (req.user!.role !== "admin") {
        const provider = await getProviderByUserId(req.user!.userId);

        if (!provider || provider.providerId !== booking.providerId) {
          throw new AppError(403, "You can only update bookings for your listings");
        }
      }

      const updated = await updateBookingStatus(
        req.params.bookingId as string,
        req.body.status,
      );

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
