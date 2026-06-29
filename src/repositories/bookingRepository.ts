import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient, tableName } from "../config/db";
import type { Booking, BookingStatus, PaginatedResult, User } from "../types";
import { nowIso } from "../utils/auth";
import { AppError } from "../utils/errors";
import { getExperienceById } from "./experienceRepository";
import { getUserById } from "./userRepository";

const BOOKING_PREFIX = "BOOKING#";
const USER_PREFIX = "USER#";

function bookingPk(bookingId: string): string {
  return `${BOOKING_PREFIX}${bookingId}`;
}

function userPk(userId: string): string {
  return `${USER_PREFIX}${userId}`;
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

export async function createBooking(input: {
  userId: string;
  experienceId: string;
  requestedDate: string;
  groupSize: number;
  notes?: string;
}): Promise<Booking> {
  const experience = await getExperienceById(input.experienceId);

  if (!experience || experience.status !== "published") {
    throw new AppError(404, "Experience not found or unavailable");
  }

  if (input.groupSize > experience.maxGroupSize) {
    throw new AppError(400, `Group size cannot exceed ${experience.maxGroupSize}`);
  }

  const timestamp = nowIso();
  const booking: Booking = {
    bookingId: randomUUID(),
    userId: input.userId,
    experienceId: experience.experienceId,
    experienceTitle: experience.title,
    providerId: experience.providerId,
    requestedDate: input.requestedDate,
    groupSize: input.groupSize,
    totalPrice: experience.price * input.groupSize,
    currency: experience.currency,
    status: "pending",
    ...(input.notes ? { notes: input.notes } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookingPk(booking.bookingId),
        SK: "METADATA",
        entityType: "BOOKING",
        GSI3PK: userPk(booking.userId),
        GSI3SK: `${BOOKING_PREFIX}${booking.createdAt}`,
        GSI4PK: `PROVIDER#${booking.providerId}`,
        GSI4SK: `${BOOKING_PREFIX}${booking.createdAt}`,
        ...booking,
      },
    }),
  );

  return booking;
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookingPk(bookingId), SK: "METADATA" },
    }),
  );

  if (!result.Item) {
    return null;
  }

  return result.Item as Booking;
}

export async function listBookingsByUser(
  userId: string,
  limit = 20,
  cursor?: string,
): Promise<PaginatedResult<Booking>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI3",
      KeyConditionExpression: "GSI3PK = :pk AND begins_with(GSI3SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": userPk(userId),
        ":prefix": BOOKING_PREFIX,
      },
      Limit: Math.min(limit, 50),
      ScanIndexForward: false,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );

  return {
    items: (result.Items ?? []) as Booking[],
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  };
}

export async function listBookingsByProvider(
  providerId: string,
  limit = 20,
  cursor?: string,
): Promise<PaginatedResult<Booking & { customer?: User }>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI4",
      KeyConditionExpression: "GSI4PK = :pk AND begins_with(GSI4SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `PROVIDER#${providerId}`,
        ":prefix": BOOKING_PREFIX,
      },
      Limit: Math.min(limit, 50),
      ScanIndexForward: false,
      ExclusiveStartKey: decodeCursor(cursor),
    }),
  );

  const bookings = (result.Items ?? []) as Booking[];
  
  // Fetch customer details for each booking
  const bookingsWithCustomers = await Promise.all(
    bookings.map(async (booking) => {
      const customer = await getUserById(booking.userId);
      if (customer) {
        return {
          ...booking,
          customer,
        } as Booking & { customer: User };
      }
      return booking as Booking & { customer?: User };
    }),
  );

  return {
    items: bookingsWithCustomers,
    nextCursor: encodeCursor(result.LastEvaluatedKey),
  };
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<Booking> {
  const existing = await getBookingById(bookingId);

  if (!existing) {
    throw new AppError(404, "Booking not found");
  }

  const updated: Booking = {
    ...existing,
    status,
    updatedAt: nowIso(),
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookingPk(updated.bookingId),
        SK: "METADATA",
        entityType: "BOOKING",
        GSI3PK: userPk(updated.userId),
        GSI3SK: `${BOOKING_PREFIX}${updated.createdAt}`,
        GSI4PK: `PROVIDER#${updated.providerId}`,
        GSI4SK: `${BOOKING_PREFIX}${updated.createdAt}`,
        ...updated,
      },
    }),
  );

  return updated;
}
