import { randomUUID } from "crypto";
import type {
  DurationUnit,
  Experience,
  Itinerary,
  ItineraryCheckpoint,
} from "../types";
import { nowIso } from "../utils/auth";

/**
 * Build a not-started itinerary from the AI-sequenced experiences. They arrive
 * already selected and ordered for the trip duration (see itinerarySequencer),
 * so the builder just lays them out as ordered checkpoints, all locked.
 *
 * Checkpoint lifecycle: locked -> active ("you are here") -> completed.
 *   - buildItinerary: every checkpoint locked (nothing started yet)
 *   - markStarted:    first checkpoint active
 *   - completeCheckpoint (repository): completed -> next becomes active
 *
 * Each checkpoint keeps only a snapshot (experienceId + title + price), mirroring
 * how Booking references an experience — full details are fetched via experienceId.
 * Completion is manual and order-based, so checkpoints carry no clock times.
 */
export function buildItinerary(params: {
  userId: string;
  destination: string;
  destinationSlug: string;
  prompt: string;
  durationValue: number;
  durationUnit: DurationUnit;
  sequenced: Experience[];
}): Itinerary {
  const {
    userId,
    destination,
    destinationSlug,
    prompt,
    durationValue,
    durationUnit,
    sequenced,
  } = params;

  const timestamp = nowIso();
  const currency = sequenced[0]?.currency ?? "NGN";

  const checkpoints: ItineraryCheckpoint[] = sequenced.map(
    (experience, index) => ({
      checkpointId: randomUUID(),
      order: index + 1,
      experienceId: experience.experienceId,
      title: experience.title,
      price: experience.price,
      status: "locked",
    }),
  );

  const totalPrice = checkpoints.reduce(
    (sum, checkpoint) => sum + checkpoint.price,
    0,
  );

  return {
    itineraryId: randomUUID(),
    userId,
    destination,
    destinationSlug,
    prompt,
    durationValue,
    durationUnit,
    checkpoints,
    totalPrice,
    currency,
    status: "not_started",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Transition a not-started itinerary to in_progress by activating its first
 * checkpoint. Used by the "Start" action.
 */
export function markStarted(itinerary: Itinerary): Itinerary {
  const first = itinerary.checkpoints[0];
  if (first) {
    first.status = "active";
  }

  return {
    ...itinerary,
    status: "in_progress",
    updatedAt: nowIso(),
  };
}
