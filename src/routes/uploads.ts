// src/routes/uploads.ts
import { Router } from "express";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware";
import cloudinary from "../utils/cloudinary";

const router = Router();


router.post(
  "/sign",
  authenticate,
  authorize("provider", "admin"),
  (req: AuthenticatedRequest, res, next) => {
    try {
      const timestamp = Math.round(Date.now() / 1000);
      const folder = "tours-connect/experiences";
      const paramsToSign = { timestamp, folder };

      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET as string,
      );

      res.json({
        success: true,
        data: {
          timestamp,
          signature,
          apiKey: process.env.CLOUDINARY_API_KEY,
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          folder,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;