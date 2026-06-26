import { z } from "zod";

export const experienceCategories = [
  "adventure",
  "relaxation",
  "nightlife",
  "cultural",
  "wildlife",
  "water_sports",
  "romantic",
  "family_friendly",
] as const;

export const bookingStatuses = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
] as const;

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["customer", "provider"]).default("customer"),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const createExperienceSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  destination: z.string().min(2),
  category: z.enum(experienceCategories),
  eventDate: z.iso.datetime(),
  numberOfDays: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().default("NGN"),
  duration: z.string().min(1).optional(),
  maxGroupSize: z.number().int().positive(),
  images: z.array(z.url()).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const updateExperienceSchema = createExperienceSchema.partial();

export const providerApplicationStatuses = [
  "pending",
  "approved",
  "rejected",
] as const;

export const createProviderSchema = z.object({
  businessName: z.string().min(2),
  description: z.string().min(10),
  location: z.string().min(2),
  businessAddress: z.string().min(5),
  companyEmail: z.email(),
  companyPhone: z.string().min(7),
  cacNumber: z.string().min(5),
  cacDocumentUrl: z.url().optional(),
});

export const reviewProviderApplicationSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().min(5).max(500).optional(),
  })
  .refine(
    (data) => data.status !== "rejected" || Boolean(data.rejectionReason),
    {
      message: "Rejection reason is required when rejecting an application",
      path: ["rejectionReason"],
    },
  );

export const providerApplicationQuerySchema = z.object({
  status: z.enum(providerApplicationStatuses).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
});

export const experienceQuerySchema = z.object({
  destination: z.string().optional(),
  category: z.enum(experienceCategories).optional(),
  search: z.string().optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
});

export const createBookingSchema = z.object({
  experienceId: z.uuid(),
  requestedDate: z.iso.datetime(),
  groupSize: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(bookingStatuses),
});

export const createDestinationSchema = z.object({
  name: z.string().min(2),
  state: z.string().min(2),
  description: z.string().min(10),
  imageUrl: z.url(),
  featured: z.boolean().default(false),
  destinationSlug: z.string().optional(),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
});
