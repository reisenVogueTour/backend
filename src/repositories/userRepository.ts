import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, tableName } from "../config/db";
import type { PaginatedResult, User } from "../types";
import { nowIso } from "../utils/auth";
import { AppError } from "../utils/errors";

const USER_PREFIX = "USER#";
const EMAIL_PREFIX = "EMAIL#";

function userPk(userId: string): string {
  return `${USER_PREFIX}${userId}`;
}

function emailPk(email: string): string {
  return `${EMAIL_PREFIX}${email.toLowerCase()}`;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: User["role"];
  phone?: string;
}): Promise<User> {
  const existing = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: emailPk(input.email), SK: "USER" },
    }),
  );

  if (existing.Item) {
    throw new AppError(409, "Email already registered");
  }

  const timestamp = nowIso();
  const user: User = {
    userId: randomUUID(),
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    ...(input.phone ? { phone: input.phone } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: userPk(user.userId),
        SK: "PROFILE",
        entityType: "USER",
        ...user,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: emailPk(user.email),
        SK: "USER",
        entityType: "EMAIL_LOOKUP",
        userId: user.userId,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return user;
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: userPk(userId), SK: "PROFILE" },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const lookup = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: emailPk(email), SK: "USER" },
    }),
  );

  if (!lookup.Item?.userId) {
    return null;
  }

  return getUserById(lookup.Item.userId as string);
}
