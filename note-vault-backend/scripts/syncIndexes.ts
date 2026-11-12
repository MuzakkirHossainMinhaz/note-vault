import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User";
import Note from "../src/models/Note";
import Post from "../src/models/Post";

dotenv.config();

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required to synchronize indexes.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
    autoIndex: false,
  });

  for (const Model of [User, Note, Post]) {
    await Model.syncIndexes();
    console.log(`${Model.collection.name} indexes:`);
    console.log(await Model.collection.indexes());
  }
}

main()
  .catch((error: unknown) => {
    console.error(`Index synchronization failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
