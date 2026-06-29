import dotenv from "dotenv";
dotenv.config();

import { createUser, getUserByEmail } from "../repositories/userRepository";
import { hashPassword, signToken } from "../utils/auth";

async function main() {
  const email = process.argv[2] ?? "admin@toursconnect.test";
  const password = process.argv[3] ?? "admin12345";
  const firstName = process.argv[4] ?? "Admin";
  const lastName = process.argv[5] ?? "User";

  const existing = await getUserByEmail(email);
  if (existing) {
    console.log(`User ${email} already exists with role "${existing.role}".`);
    if (existing.role !== "admin") {
      console.log(
        "This script only creates new users — it won't promote an existing one. " +
          "Use a different email, or delete the existing user from DynamoDB first.",
      );
    } else {
      const token = signToken({ userId: existing.userId, email: existing.email, role: existing.role });
      console.log("\nAdmin token (existing user):\n", token);
    }
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await createUser({
    email,
    passwordHash,
    firstName,
    lastName,
    role: "admin",
  });

  const token = signToken({ userId: user.userId, email: user.email, role: user.role });

  console.log("Admin user created:");
  console.log({ userId: user.userId, email: user.email, role: user.role });
  console.log("\nLogin credentials:");
  console.log(`  email: ${email}`);
  console.log(`  password: ${password}`);
  console.log("\nReady-to-use bearer token (paste into localStorage.setItem('tc_token', '...')):");
  console.log(token);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });