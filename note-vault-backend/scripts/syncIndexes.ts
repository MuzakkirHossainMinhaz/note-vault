import dotenv from "dotenv";
import mongoose from "mongoose";

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

  const [{ default: User }, { default: Note }, { default: Post }] = await Promise.all([
    import("../src/models/User"),
    import("../src/models/Note"),
    import("../src/models/Post"),
  ]);

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
