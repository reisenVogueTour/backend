import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, tableName } from "../config/db";
import type {
  Experience,
  ExperienceCategory,
  ExperienceStatus,
  PaginatedResult,
} from "../types";
import { nowIso, slugify } from "../utils/auth";
import { AppError } from "../utils/errors";

const EXPERIENCE_PREFIX = "EXPERIENCE#";
const PROVIDER_PREFIX = "PROVIDER#";

function experiencePk(experienceId: string): string {
  return `${EXPERIENCE_PREFIX}${experienceId}`;
}

export interface ExperienceFilters {
  destination?: string;
  category?: ExperienceCategory;
  search?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  status?: ExperienceStatus;
  providerId?: string;
  limit?: number;
  cursor?: string;
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

export async function createExperience(
  input: Omit<
    Experience,
    "experienceId" | "destinationSlug" | "createdAt" | "updatedAt"
  >,
): Promise<Experience> {
  const timestamp = nowIso();
  const experience: Experience = {
    experienceId: randomUUID(),
    ...input,
    destinationSlug: slugify(input.destination),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: experiencePk(experience.experienceId),
        SK: "METADATA",
        entityType: "EXPERIENCE",
        GSI1PK: "EXPERIENCE#PUBLISHED",
        GSI1SK: experience.featured ? `featured#${experience.createdAt}` : experience.createdAt,
        GSI2PK: `DESTINATION#${experience.destinationSlug}`,
        GSI2SK: `EXPERIENCE#${experience.experienceId}`,
        GSI3PK: `${PROVIDER_PREFIX}${experience.providerId}`,
        GSI3SK: `${EXPERIENCE_PREFIX}${experience.experienceId}`,
        ...experience,
      },
    }),
  );

  return experience;
}

export async function getExperienceById(
  experienceId: string,
): Promise<Experience | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: experiencePk(experienceId), SK: "METADATA" },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as Experience;
}

function applyInMemoryFilters(
  items: Experience[],
  filters: ExperienceFilters,
): Experience[] {
  return items.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.minPrice !== undefined && item.price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && item.price > filters.maxPrice) return false;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const haystack = `${item.title} ${item.description} ${item.destination}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export async function listExperiences(
  filters: ExperienceFilters = {},
): Promise<PaginatedResult<Experience>> {
  const limit = Math.min(filters.limit ?? 20, 50);

  // Handle featured filter
  if (filters.featured) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "EXPERIENCE#PUBLISHED",
        },
        Limit: limit,
        ExclusiveStartKey: decodeCursor(filters.cursor),
      }),
    );

    const items = (result.Items ?? []) as Experience[];
    const featuredItems = items.filter(item => item.featured === true);

    return {
      items: applyInMemoryFilters(featuredItems, filters),
      nextCursor: encodeCursor(result.LastEvaluatedKey),
    };
  }

  // Handle destination filter
  if (filters.destination) {
    const destinationSlug = slugify(filters.destination);
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `DESTINATION#${destinationSlug}`,
        },
        Limit: limit,
        ExclusiveStartKey: decodeCursor(filters.cursor),
      }),
    );

    return {
      items: applyInMemoryFilters((result.Items ?? []) as Experience[], filters),
      nextCursor: encodeCursor(result.LastEvaluatedKey),
    };
  }

  // Handle provider filter
  if (filters.providerId) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `${PROVIDER_PREFIX}${filters.providerId}`,
        },
        Limit: limit,
        ExclusiveStartKey: decodeCursor(filters.cursor),
      }),
    );

    return {
      items: applyInMemoryFilters((result.Items ?? []) as Experience[], filters),
      nextCursor: encodeCursor(result.LastEvaluatedKey),
    };
  }

  // Default: get all published experiences
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": "EXPERIENCE#PUBLISHED",
      },
      Limit: limit,
      ExclusiveStartKey: decodeCursor(filters.cursor),
    }),
  );

  return {
    items: applyInMemoryFilters((result.Items ?? []) as Experience[], filters),
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  };
}

export async function updateExperience(
  experienceId: string,
  updates: Partial<
    Pick<
      Experience,
      | "title"
      | "description"
      | "destination"
      | "category"
      | "eventDate"
      | "numberOfDays"
      | "price"
      | "currency"
      | "duration"
      | "maxGroupSize"
      | "images"
      | "featured"
      | "status"
    >
  >,
): Promise<Experience> {
  const existing = await getExperienceById(experienceId);

  if (!existing) {
    throw new AppError(404, "Experience not found");
  }

  const updated: Experience = {
    ...existing,
    ...updates,
    destinationSlug: updates.destination
      ? slugify(updates.destination)
      : existing.destinationSlug,
    updatedAt: nowIso(),
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: experiencePk(updated.experienceId),
        SK: "METADATA",
        entityType: "EXPERIENCE",
        GSI1PK: "EXPERIENCE#PUBLISHED",
        GSI1SK: updated.featured ? `featured#${updated.createdAt}` : updated.createdAt,
        GSI2PK: `DESTINATION#${updated.destinationSlug}`,
        GSI2SK: `EXPERIENCE#${updated.experienceId}`,
        GSI3PK: `${PROVIDER_PREFIX}${updated.providerId}`,
        GSI3SK: `${EXPERIENCE_PREFIX}${updated.experienceId}`,
        ...updated,
      },
    }),
  );

  return updated;
}