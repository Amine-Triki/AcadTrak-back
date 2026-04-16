import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import userModel from "../modules/users/user.model.js";

const askAdminPassword = async () => {
  const rl = createInterface({ input, output });
  try {
    const value = (await rl.question("Enter ADMIN_PASSWORD for seed: ")).trim();
    return value;
  } finally {
    rl.close();
  }
};

const seedAdmin = async () => {
  const mongoUri = process.env.MONGO_URI;
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "admin@acadtrak.com";
  let adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!mongoUri) {
    console.error("❌ MONGO_URI is required to run admin seed");
    process.exit(1);
  }

  if (!adminPassword) {
    adminPassword = await askAdminPassword();
  }

  if (!adminPassword) {
    console.error("❌ ADMIN_PASSWORD is required (set it in .env or enter it when prompted)");
    process.exit(1);
  }

  if (adminPassword.length < 12) {
    console.error("❌ ADMIN_PASSWORD must be at least 12 characters");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);

    const adminExists = await userModel.findOne({
      $or: [{ role: "admin" }, { email: adminEmail }],
      deletedAt: null,
    });

    if (adminExists) {
      console.log("⚠️ Admin already exists. Seed skipped.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await userModel.create({
      firstName: "Super",
      lastName: "Admin",
      userName: "superadmin",
      country: "N/A",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Admin created successfully!");
    console.log(`📧 Admin email: ${adminEmail}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin();