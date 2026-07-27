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

// Updated registerSchema to include provider fields
export const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().optional(),
    role: z.enum(["customer", "provider"]).default("customer"),
    // Provider-specific fields (optional, only required when role is "provider")
    businessName: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    businessAddress: z.string().optional(),
    companyEmail: z.string().email("Invalid company email").optional(),
    companyPhone: z.string().optional(),
    cacNumber: z.string().optional(),
    cacDocumentUrl: z.string().url("Invalid document URL").optional(),
  })
  .refine(
    (data) => {
      // If role is provider, require all provider fields
      if (data.role === "provider") {
        return (
          data.businessName &&
          data.businessName.trim().length >= 2 &&
          data.description &&
          data.description.trim().length >= 10 &&
          data.location &&
          data.location.trim().length >= 2 &&
          data.businessAddress &&
          data.businessAddress.trim().length >= 5 &&
          data.companyEmail &&
          data.companyEmail.trim().length > 0 &&
          data.companyPhone &&
          data.companyPhone.trim().length >= 7 &&
          data.cacNumber &&
          data.cacNumber.trim().length >= 5
        );
      }
      return true;
    },
    {
      message:
        "All provider fields (businessName, description, location, businessAddress, companyEmail, companyPhone, cacNumber) are required when registering as a provider",
      path: ["role"],
    },
  );

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createExperienceSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  destination: z.string().min(2),
  category: z.enum(experienceCategories),
  eventDate: z.string().datetime({ offset: true }),
  numberOfDays: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().default("NGN"),
  duration: z.string().min(1).optional(),
  maxGroupSize: z.number().int().positive(),
  images: z.array(z.string().url()).default([]),
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
  companyEmail: z.string().email("Invalid company email"),
  companyPhone: z.string().min(7),
  cacNumber: z.string().min(5),
  cacDocumentUrl: z.string().url().optional(),
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
  experienceId: z.string().uuid(),
  requestedDate: z.string().datetime({ offset: true }),
  groupSize: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(bookingStatuses),
});

export const createDestinationSchema = z.object({
  name: z.string().min(2),
  country: z.string().min(2),
  description: z.string().min(10),
  imageUrl: z.string().url(),
  featured: z.boolean().default(false),
  slug: z.string().optional(),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().optional(),
});

export const recommendExperiencesSchema = z.object({
  destinationSlug: z.string().min(1),
  prompt: z.string().min(3).max(1000),
});

export const durationUnits = ["hours", "days", "weeks", "months"] as const;

export const generateItinerarySchema = z.object({
  destinationSlug: z.string().min(1),
  prompt: z.string().min(3).max(1000),
  experienceIds: z.array(z.string().uuid()).min(1).max(10),
  durationValue: z.number().int().positive().max(365),
  durationUnit: z.enum(durationUnits),
});

export const saveItinerarySchema = generateItinerarySchema.extend({
  start: z.boolean().default(false),
  itineraryId: z.uuid(),
});
