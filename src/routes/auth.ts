import { Router } from "express";
import {
  authenticate,
  validateBody,
  type AuthenticatedRequest,
} from "../middleware";
import { createUser, getUserByEmail, getUserById } from "../repositories/userRepository";
import {
  comparePassword,
  hashPassword,
  signToken,
  toPublicUser,
} from "../utils/auth";
import { AppError } from "../utils/errors";
import { loginSchema, registerSchema } from "../validators/schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      phone,
    });

    const token = signToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        user: toPublicUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user) {
      throw new AppError(401, "Invalid email or password");
    }

    const valid = await comparePassword(password, user.passwordHash);

    if (!valid) {
      throw new AppError(401, "Invalid email or password");
    }

    const token = signToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        user: toPublicUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await getUserById(req.user!.userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    res.json({
      success: true,
      data: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
