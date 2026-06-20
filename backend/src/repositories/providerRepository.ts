import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, tableName } from "../config/db";
import type { Provider } from "../types";
import { nowIso } from "../utils/auth";
import { AppError } from "../utils/errors";

const PROVIDER_PREFIX = "PROVIDER#";
const USER_PREFIX = "USER#";

function providerPk(providerId: string): string {
  return `${PROVIDER_PREFIX}${providerId}`;
}

export async function createProvider(input: {
  userId: string;
  businessName: string;
  description: string;
  location: string;
}): Promise<Provider> {
  const existing = await getProviderByUserId(input.userId);

  if (existing) {
    throw new AppError(409, "Provider profile already exists for this user");
  }

  const timestamp = nowIso();
  const provider: Provider = {
    providerId: randomUUID(),
    userId: input.userId,
    businessName: input.businessName,
    description: input.description,
    location: input.location,
    verified: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: providerPk(provider.providerId),
        SK: "PROFILE",
        entityType: "PROVIDER",
        GSI3PK: `${USER_PREFIX}${provider.userId}`,
        GSI3SK: `${PROVIDER_PREFIX}${provider.providerId}`,
        ...provider,
      },
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
