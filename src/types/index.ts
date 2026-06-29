export type UserRole = "customer" | "provider" | "admin";

export type ExperienceCategory =
  | "adventure"
  | "relaxation"
  | "nightlife"
  | "cultural"
  | "wildlife"
  | "water_sports"
  | "romantic"
  | "family_friendly";

export type ExperienceStatus = "draft" | "published" | "archived";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
}

export interface Experience {
  experienceId: string;
  providerId: string;
  title: string;
  description: string;
  destination: string;
  destinationSlug: string;
  category: ExperienceCategory;
  eventDate: string;
  numberOfDays: number;
  price: number;
  currency: string;
  duration: string;
  maxGroupSize: number;
  images: string[];
  featured: boolean;
  status: ExperienceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Destination {
  destinationSlug: string;
  name: string;
  state: string;
  description: string;
  imageUrl: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  bookingId: string;
  userId: string;
  experienceId: string;
  experienceTitle: string;
  providerId: string;
  requestedDate: string;
  groupSize: number;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedExperience {
  userId: string;
  experienceId: string;
  savedAt: string;
}

export type ProviderApplicationStatus = "pending" | "approved" | "rejected";

export interface Provider {
  providerId: string;
  userId: string;
  businessName: string;
  description: string;
  location: string;
  businessAddress: string;
  companyEmail: string;
  companyPhone: string;
  cacNumber: string;
  cacDocumentUrl?: string;
  applicationStatus: ProviderApplicationStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProvider {
  providerId: string;
  businessName: string;
  description: string;
  location: string;
  createdAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface PaginationQuery {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string | undefined;
}

export type CheckpointStatus = "locked" | "active" | "completed";

export type ItineraryStatus = "not_started" | "in_progress" | "completed";

export type DurationUnit = "hours" | "days" | "weeks" | "months";

export interface ItineraryCheckpoint {
  checkpointId: string;
  order: number;
  experienceId: string;
  title: string;
  price: number;
  status: CheckpointStatus;
  completedAt?: string;
}

export interface Itinerary {
  itineraryId: string;
  userId: string;
  destination: string;
  destinationSlug: string;
  prompt: string;
  durationValue: number;
  durationUnit: DurationUnit;
  checkpoints: ItineraryCheckpoint[];
  totalPrice: number;
  currency: string;
  status: ItineraryStatus;
  createdAt: string;
  updatedAt: string;
}
