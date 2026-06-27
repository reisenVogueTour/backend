import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, tableName } from "../config/db";
import type { Itinerary, PaginatedResult } from "../types";
import { nowIso } from "../utils/auth";
import { AppError } from "../utils/errors";

const ITINERARY_PREFIX = "ITINERARY#";
const USER_PREFIX = "USER#";

function itineraryPk(itineraryId: string): string {
  return `${ITINERARY_PREFIX}${itineraryId}`;
}

function decodeCursor(cursor?: string): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
}

function encodeCursor(
  lastEvaluatedKey?: Record<string, unknown>,
): string | undefined {
  if (!lastEvaluatedKey) return undefined;
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
}

function itineraryItem(itinerary: Itinerary) {
  return {
    PK: itineraryPk(itinerary.itineraryId),
    SK: "METADATA",
    entityType: "ITINERARY",
    GSI3PK: `${USER_PREFIX}${itinerary.userId}`,
    GSI3SK: `${ITINERARY_PREFIX}${itinerary.createdAt}`,
    ...itinerary,
  };
}

export async function saveItinerary(itinerary: Itinerary): Promise<Itinerary> {
  await docClient.send(
    new PutCommand({ TableName: tableName, Item: itineraryItem(itinerary) }),
  );
  return itinerary;
}

export async function getItineraryById(
  itineraryId: string,
): Promise<Itinerary | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: itineraryPk(itineraryId), SK: "METADATA" },
    }),
  );

  return result.Item ? (result.Item as Itinerary) : null;
}

export async function listItinerariesByUser(
  userId: string,
  limit = 20,
  cursor?: string,
): Promise<PaginatedResult<Itinerary>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI3",
      KeyConditionExpression: "GSI3PK = :pk AND begins_with(GSI3SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `${USER_PREFIX}${userId}`,
        ":prefix": ITINERARY_PREFIX,
      },
      Limit: Math.min(limit, 50),
      ScanIndexForward: false,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );

  return {
    items: (result.Items ?? []) as Itinerary[],
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  };
}

/**
 * The user's "current" trip: their most recently saved itinerary that is still
 * in_progress. A user can have several in_progress at once, so we filter for
 * in_progress and take the newest. Returns null if none are on the go.
 */
export async function getCurrentItinerary(
  userId: string,
): Promise<Itinerary | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI3",
      KeyConditionExpression: "GSI3PK = :pk AND begins_with(GSI3SK, :prefix)",
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pk": `${USER_PREFIX}${userId}`,
        ":prefix": ITINERARY_PREFIX,
        ":status": "in_progress",
      },
      ScanIndexForward: false,
    }),
  );

  const items = (result.Items ?? []) as Itinerary[];
  return items[0] ?? null;
}

export async function deleteItinerary(
  itineraryId: string,
  userId: string,
): Promise<void> {
  const existing = await getItineraryById(itineraryId);

  if (!existing) {
    throw new AppError(404, "Itinerary not found");
  }

  if (existing.userId !== userId) {
    throw new AppError(403, "You can only delete your own itinerary");
  }

  await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK: itineraryPk(itineraryId), SK: "METADATA" },
    }),
  );
}

/**
 * Mark the active checkpoint complete and unlock the next one. Enforces
 * sequential progress: a locked checkpoint can't be completed before the one in
 * front of it. Idempotent if the checkpoint is already completed.
 */
export async function completeCheckpoint(
  itineraryId: string,
  userId: string,
  checkpointId: string,
): Promise<Itinerary> {
  const existing = await getItineraryById(itineraryId);

  if (!existing) {
    throw new AppError(404, "Itinerary not found");
  }

  if (existing.userId !== userId) {
    throw new AppError(403, "You can only update your own itinerary");
  }

  if (existing.status === "not_started") {
    throw new AppError(
      400,
      "Start this itinerary before completing checkpoints",
    );
  }

  const index = existing.checkpoints.findIndex(
    (checkpoint) => checkpoint.checkpointId === checkpointId,
  );

  if (index === -1) {
    throw new AppError(404, "Checkpoint not found");
  }

  const target = existing.checkpoints[index]!;

  if (target.status === "completed") {
    return existing;
  }

  if (target.status === "locked") {
    throw new AppError(400, "Complete the previous checkpoint first");
  }

  const timestamp = nowIso();
  const checkpoints = existing.checkpoints.map((checkpoint, i) => {
    if (i === index) {
      return {
        ...checkpoint,
        status: "completed" as const,
        completedAt: timestamp,
      };
    }
    if (i === index + 1 && checkpoint.status === "locked") {
      return { ...checkpoint, status: "active" as const };
    }
    return checkpoint;
  });

  const allCompleted = checkpoints.every(
    (checkpoint) => checkpoint.status === "completed",
  );

  const updated: Itinerary = {
    ...existing,
    checkpoints,
    status: allCompleted ? "completed" : "in_progress",
    updatedAt: timestamp,
  };

  await saveItinerary(updated);
  return updated;
}
