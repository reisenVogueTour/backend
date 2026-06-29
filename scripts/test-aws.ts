import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";

dotenv.config();

async function testAWS() {
  console.log("Testing AWS connection...");
  console.log("AWS_REGION:", process.env.AWS_REGION);
  console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID?.substring(0, 10) + "...");
  console.log("DYNAMODB_ENDPOINT:", process.env.DYNAMODB_ENDPOINT || "Not set (using real AWS)");
  console.log("DYNAMODB_TABLE_NAME:", process.env.DYNAMODB_TABLE_NAME);

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  try {
    const result = await client.send(new ListTablesCommand({}));
    console.log("✅ Success! Tables:", result.TableNames);
  } catch (error) {
    console.error("❌ Failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

testAWS();