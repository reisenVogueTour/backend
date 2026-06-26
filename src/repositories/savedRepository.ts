import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient, tableName } from "../config/db";
import type { SavedExperience } from "../types";
import { nowIso } from "../utils/auth";
import { AppError } from "../utils/errors";
import { getExperienceById } from "./experienceRepository";

const USER_PREFIX = "USER#";
const SAVED_PREFIX = "SAVED#";

function userPk(userId: string): string {
  return `${USER_PREFIX}${userId}`;
}

export async function saveExperience(
  userId: string,
  experienceId: string,
): Promise<SavedExperience> {
  const experience = await getExperienceById(experienceId);

  if (!experience || experience.status !== "published") {
    throw new AppError(404, "Experience not found or unavailable");
  }

  const saved: SavedExperience = {
    userId,
    experienceId,
    savedAt: nowIso(),
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: userPk(userId),
        SK: `${SAVED_PREFIX}${experienceId}`,
        entityType: "SAVED_EXPERIENCE",
        ...saved,
      },
    }),
  );

  return saved;
}

export async function removeSavedExperience(
  userId: string,
  experienceId: string,
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: userPk(userId),
        SK: `${SAVED_PREFIX}${experienceId}`,
      },
    }),
  );
}

export async function listSavedExperiences(userId: string): Promise<string[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": userPk(userId),
        ":prefix": SAVED_PREFIX,
      },
    }),
  );

  return (result.Items ?? []).map((item) => item.experienceId as string);
}

export async function isExperienceSaved(
  userId: string,
  experienceId: string,
): Promise<boolean> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: userPk(userId),
        SK: `${SAVED_PREFIX}${experienceId}`,
      },
    }),
  );

  return Boolean(result.Item);
}
