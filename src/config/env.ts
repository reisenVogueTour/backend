import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: requireEnv("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  dynamoTableName: requireEnv("DYNAMODB_TABLE_NAME", "tours-connect"),
  dynamoEndpoint: process.env.DYNAMODB_ENDPOINT,
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:5000",
};
