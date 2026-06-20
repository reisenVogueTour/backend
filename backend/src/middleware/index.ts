import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { verifyToken } from "../utils/auth";
import { AppError } from "../utils/errors";
import type { AuthTokenPayload } from "../types";

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}

export function authorize(...roles: AuthTokenPayload["role"][]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "Insufficient permissions"));
      return;
    }

    next();
  };
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(400, "Validation failed", result.error.flatten().fieldErrors),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(
        new AppError(400, "Validation failed", result.error.flatten().fieldErrors),
      );
      return;
    }

    req.query = result.data as Request["query"];
    next();
  };
}
