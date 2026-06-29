import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, tableName } from "../config/db";
import type {
  PaginatedResult,
  Provider,
  ProviderApplicationStatus,
} from "../types";
import { nowIso } from "../utils/auth";
import { AppError } from "../utils/errors";
import { assertAdminReviewTransition } from "../utils/provider";

const PROVIDER_PREFIX = "PROVIDER#";
const USER_PREFIX = "USER#";
const PROVIDER_APP_PREFIX = "PROVIDER_APP#";

function providerPk(providerId: string): string {
  return `${PROVIDER_PREFIX}${providerId}`;
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

function providerItem(provider: Provider) {
  return {
    PK: providerPk(provider.providerId),
    SK: "PROFILE",
    entityType: "PROVIDER",
    GSI1PK: `${PROVIDER_APP_PREFIX}${provider.applicationStatus}`,
    GSI1SK: `${provider.createdAt}#${provider.providerId}`,
    GSI3PK: `${USER_PREFIX}${provider.userId}`,
    GSI3SK: `${PROVIDER_PREFIX}${provider.providerId}`,
    ...provider,
  };
}

export async function createProvider(input: {
  userId: string;
  businessName: string;
  description: string;
  location: string;
  businessAddress: string;
  companyEmail: string;
  companyPhone: string;
  cacNumber: string;
  cacDocumentUrl?: string;
}): Promise<Provider> {
  const existing = await getProviderByUserId(input.userId);

  if (existing) {
    throw new AppError(409, "Provider application already exists for this user");
  }

  const timestamp = nowIso();
  const provider: Provider = {
    providerId: randomUUID(),
    userId: input.userId,
    businessName: input.businessName,
    description: input.description,
    location: input.location,
    businessAddress: input.businessAddress,
    companyEmail: input.companyEmail,
    companyPhone: input.companyPhone,
    cacNumber: input.cacNumber,
    ...(input.cacDocumentUrl ? { cacDocumentUrl: input.cacDocumentUrl } : {}),
    applicationStatus: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: providerItem(provider),
    }),
  );

  return provider;
}

export async function getProviderById(
  providerId: string,
): Promise<Provider | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: providerPk(providerId), SK: "PROFILE" },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as Provider;
}

export async function getProviderByUserId(
  userId: string,
): Promise<Provider | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI3",
      KeyConditionExpression: "GSI3PK = :pk AND begins_with(GSI3SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `${USER_PREFIX}${userId}`,
        ":prefix": PROVIDER_PREFIX,
      },
      Limit: 1,
    }),
  );

  const item = result.Items?.[0];
  return item ? (item as Provider) : null;
}

export async function listProviderApplications(options: {
  status?: ProviderApplicationStatus;
  limit?: number;
  cursor?: string;
} = {}): Promise<PaginatedResult<Provider>> {
  const status = options.status ?? "pending";
  const limit = Math.min(options.limit ?? 20, 50);

  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `${PROVIDER_APP_PREFIX}${status}`,
      },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: decodeCursor(options.cursor),
    }),
  );

  return {
    items: (result.Items ?? []) as Provider[],
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  };
}

export async function countProviderApplications(
  status: ProviderApplicationStatus,
): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `${PROVIDER_APP_PREFIX}${status}`,
      },
      Select: "COUNT",
    }),
  );

  return result.Count ?? 0;
}

export async function reviewProviderApplication(input: {
  providerId: string;
  adminUserId: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}): Promise<Provider> {
  const existing = await getProviderById(input.providerId);

  if (!existing) {
    throw new AppError(404, "Provider application not found");
  }

  assertAdminReviewTransition(existing.applicationStatus, input.status);

  if (input.status === "rejected" && !input.rejectionReason) {
    throw new AppError(400, "Rejection reason is required when rejecting an application");
  }

  const timestamp = nowIso();
  const updated: Provider = {
    ...existing,
    applicationStatus: input.status,
    reviewedBy: input.adminUserId,
    reviewedAt: timestamp,
    updatedAt: timestamp,
    ...(input.status === "rejected" && input.rejectionReason
      ? { rejectionReason: input.rejectionReason }
      : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: providerItem(updated),
    }),
  );

  return updated;
}

export async function deleteProvider(providerId: string): Promise<void> {
  const existing = await getProviderById(providerId);
  if (!existing) {
    throw new AppError(404, "Provider not found");
  }

  await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK: providerPk(providerId), SK: "PROFILE" },
    }),
  );
}