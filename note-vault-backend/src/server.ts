import app from "./app";
import connectDB from "./config/db";
import env from "./config/env";
import ensureAdmin from "./utils/ensureAdmin";

async function start() {
  await connectDB(env.MONGO_URI);
  await ensureAdmin();

  app.listen(env.PORT, () => {
    console.log(`NoteVault API listening on port ${env.PORT}`);
  });
}

start().catch((error: unknown) => {
  console.error("Failed to start server");
  console.error(error);
  process.exit(1);
});
