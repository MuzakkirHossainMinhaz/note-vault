import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to seed the admin user.");
  }

  const { default: env } = await import("../src/config/env");
  const { default: connectDB } = await import("../src/config/db");
  const { default: ensureAdmin } = await import("../src/utils/ensureAdmin");

  await connectDB(env.MONGO_URI);
  await ensureAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
