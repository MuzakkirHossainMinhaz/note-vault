import dotenv from "dotenv";
import mongoose from "mongoose";
import env from "../src/config/env";
import connectDB from "../src/config/db";
import ensureAdmin from "../src/utils/ensureAdmin";

dotenv.config();

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to seed the admin user.");
  }

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
