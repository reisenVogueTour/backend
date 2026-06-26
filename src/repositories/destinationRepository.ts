import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, tableName } from "../config/db";
import type { Destination, PaginatedResult } from "../types";
import { nowIso, slugify } from "../utils/auth";
import { AppError } from "../utils/errors";

const DESTINATION_PREFIX = "DESTINATION#";

function destinationPk(slug: string): string {
  return `${DESTINATION_PREFIX}${slug}`;
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

export async function createDestination(
  input: Omit<Destination, "destinationSlug" | "createdAt" | "updatedAt"> & {
    destinationSlug?: string;
  },
): Promise<Destination> {
  const timestamp = nowIso();
  const destination: Destination = {
    destinationSlug: input.destinationSlug ?? slugify(input.name),
    name: input.name,
    state: input.state,
    description: input.description,
    imageUrl: input.imageUrl,
    featured: input.featured,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: destinationPk(destination.destinationSlug),
        SK: "METADATA",
        entityType: "DESTINATION",
        GSI1PK: destination.featured ? "FEATURED_DEST" : "DESTINATION",
        GSI1SK: destination.destinationSlug,
        ...destination,
      },
    }),
  );

  return destination;
}

export async function getDestinationBySlug(
  slug: string,
): Promise<Destination | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: destinationPk(slug), SK: "METADATA" },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as Destination;
}

export async function listDestinations(options: {
  featured?: boolean;
  limit?: number;
  cursor?: string;
} = {}): Promise<PaginatedResult<Destination>> {
  const limit = Math.min(options.limit ?? 20, 50);

  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": options.featured ? "FEATURED_DEST" : "DESTINATION",
      },
      Limit: limit,
      ExclusiveStartKey: decodeCursor(options.cursor),
    }),
  );

  return {
    items: (result.Items ?? []) as Destination[],
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  };
}

export async function ensureDestinationExists(slug: string): Promise<Destination> {
  const destination = await getDestinationBySlug(slug);

  if (!destination) {
    throw new AppError(404, "Destination not found");
  }

  return destination;
}
