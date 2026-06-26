import type { Provider, ProviderApplicationStatus } from "../types";
import { AppError } from "./errors";

export function toPublicProvider(provider: Provider) {
  return {
    providerId: provider.providerId,
    businessName: provider.businessName,
    description: provider.description,
    location: provider.location,
    createdAt: provider.createdAt,
  };
}

export function requireApprovedProvider(provider: Provider | null): Provider {
  if (!provider) {
    throw new AppError(404, "Provider profile not found");
  }

  if (provider.applicationStatus === "pending") {
    throw new AppError(
      403,
      "Your provider application is pending admin review",
    );
  }

  if (provider.applicationStatus === "rejected") {
    throw new AppError(
      403,
      provider.rejectionReason
        ? `Your provider application was rejected: ${provider.rejectionReason}`
        : "Your provider application was rejected",
    );
  }

  return provider;
}

export function assertAdminReviewTransition(
  currentStatus: ProviderApplicationStatus,
  nextStatus: "approved" | "rejected",
): void {
  if (currentStatus !== "pending") {
    throw new AppError(
      409,
      `Cannot review an application that is already ${currentStatus}`,
    );
  }

  if (nextStatus !== "approved" && nextStatus !== "rejected") {
    throw new AppError(400, "Review status must be approved or rejected");
  }
}
