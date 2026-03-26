import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const PASSWORD = "123456";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const hashed = await bcrypt.hash(PASSWORD, 10);

  // 15 staff accounts
  const staffAccounts = [];
  for (let i = 1; i <= 15; i++) {
    staffAccounts.push({
      name: `Test Staff ${i}`,
      email: `staff${i}@test.com`,
      password: hashed,
      role: "staff",
      status: "active",
    });
  }

  // 5 citizen accounts
  const citizenAccounts = [];
  for (let i = 1; i <= 5; i++) {
    citizenAccounts.push({
      name: `Test Citizen ${i}`,
      email: `citizen${i}@test.com`,
      password: hashed,
      role: "citizen",
      status: "active",
    });
  }

  const allAccounts = [...staffAccounts, ...citizenAccounts];

  for (const account of allAccounts) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      console.log(`⚠️  Skipped (already exists): ${account.email}`);
    } else {
      await User.create(account);
      console.log(`✅ Created: ${account.email} (${account.role})`);
    }
  }

  console.log("\nDone! All test accounts seeded.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Error seeding accounts:", err);
  process.exit(1);
});
