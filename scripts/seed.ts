import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { config } from "dotenv";
import path from "path";
// dotenv.config();


// Explicitly load .env from the root
config({ path: path.resolve(__dirname, "../.env") });

// Configure DynamoDB for REAL AWS
const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    // Do NOT include endpoint for real AWS
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "resisen";

async function seed() {
    console.log("🌱 Seeding database...");
    console.log(`📦 Using table: ${TABLE_NAME}`);
    console.log(`🌍 Region: ${process.env.AWS_REGION || "us-east-1"}`);
    console.log(`🔗 Using REAL AWS DynamoDB`);

    try {
        // 1. Create Admin User
        const adminPassword = await bcrypt.hash("admin123", 10);
        const adminId = "admin-1";

        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `USER#${adminId}`,
                    SK: "PROFILE",
                    userId: adminId,
                    email: "admin@reisen.com",
                    password: adminPassword,
                    firstName: "Admin",
                    lastName: "User",
                    role: "admin",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    GSI1PK: `EMAIL#admin@reisen.com`,
                    GSI1SK: "USER",
                },
            })
        );
        console.log("✅ Admin user created: admin@reisen.com / admin123");

        // 2. Create Customer User
        const customerPassword = await bcrypt.hash("customer123", 10);
        const customerId = "customer-1";

        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `USER#${customerId}`,
                    SK: "PROFILE",
                    userId: customerId,
                    email: "customer@reisen.com",
                    password: customerPassword,
                    firstName: "John",
                    lastName: "Doe",
                    role: "customer",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    GSI1PK: `EMAIL#customer@reisen.com`,
                    GSI1SK: "USER",
                },
            })
        );
        console.log("✅ Customer user created: customer@reisen.com / customer123");

        // 3. Create Provider User
        const providerPassword = await bcrypt.hash("provider123", 10);
        const providerId = "provider-1";

        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `USER#${providerId}`,
                    SK: "PROFILE",
                    userId: providerId,
                    email: "provider@reisen.com",
                    password: providerPassword,
                    firstName: "Jane",
                    lastName: "Smith",
                    role: "provider",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    GSI1PK: `EMAIL#provider@reisen.com`,
                    GSI1SK: "USER",
                },
            })
        );
        console.log("✅ Provider user created: provider@reisen.com / provider123");

        // 4. Create Provider Application (Approved)
        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `PROVIDER#${providerId}`,
                    SK: "PROFILE",
                    providerId: providerId,
                    userId: providerId,
                    businessName: "Reisen Adventures Ltd",
                    description: "Premium travel experiences across Nigeria",
                    location: "Lagos",
                    businessAddress: "123 Victoria Island, Lagos",
                    companyEmail: "hello@reisenadventures.com",
                    companyPhone: "+2348012345678",
                    cacNumber: "RC1234567",
                    cacDocumentUrl: "https://example.com/cac.pdf",
                    applicationStatus: "approved",
                    approvedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    GSI1PK: "PROVIDER#APPROVED",
                    GSI1SK: providerId,
                },
            })
        );
        console.log("✅ Provider application approved");

        // 5. Create Sample Destination
        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: "DESTINATION#lagos",
                    SK: "METADATA",
                    slug: "lagos",
                    name: "Lagos",
                    description:
                        "Africa's most vibrant city - a melting pot of culture, music, and adventure",
                    country: "Nigeria",
                    imageUrl: "/lagos.jpg",
                    featured: true,
                    experiencesCount: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    GSI1PK: "DESTINATION#FEATURED",
                    GSI1SK: "lagos",
                },
            })
        );
        console.log("✅ Sample destination created: Lagos");

        // 6. Create Sample Experience
        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: "EXPERIENCE#exp-1",
                    SK: "METADATA",
                    experienceId: "exp-1",
                    providerId: providerId,
                    title: "Lekki Conservation Canopy Walk",
                    description:
                        "Guided nature walk through the mangrove canopy with stunning views of Lagos",
                    destination: "Lagos",
                    destinationSlug: "lagos",
                    category: "adventure",
                    eventDate: "2026-08-10T09:00:00.000Z",
                    numberOfDays: 1,
                    price: 25000,
                    currency: "NGN",
                    duration: "3 hours",
                    maxGroupSize: 15,
                    images: ["/experience_placeholder.jpg"],
                    featured: true,
                    status: "published",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    GSI1PK: "EXPERIENCE#PUBLISHED",
                    GSI1SK: "featured#2026-08-10",
                    GSI2PK: "DESTINATION#lagos",
                    GSI2SK: "EXPERIENCE#exp-1",
                    GSI3PK: `PROVIDER#${providerId}`,
                    GSI3SK: "EXPERIENCE#exp-1",
                },
            })
        );
        console.log("✅ Sample experience created");

        console.log("\n🎉 Database seeding completed successfully!");
        console.log("\n📝 Test Credentials:");
        console.log("Admin:    admin@reisen.com / admin123");
        console.log("Customer: customer@reisen.com / customer123");
        console.log("Provider: provider@reisen.com / provider123");
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        if (error instanceof Error) {
            console.error("Error details:", error.message);
        }
        process.exit(1);
    }
}

seed();