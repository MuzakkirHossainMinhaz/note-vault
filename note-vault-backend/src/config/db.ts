import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) {
    throw new Error("MONGO_URI is required to connect to MongoDB.");
  }

  if (!globalThis._mongooseCache) {
    globalThis._mongooseCache = { conn: null, promise: null };
  }

  const cache = globalThis._mongooseCache;
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose
      .connect(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 8000,
        bufferCommands: false,
        autoIndex: process.env.NODE_ENV !== "production",
      })
      .then((connection: typeof mongoose) => {
        cache.conn = connection;
        console.log("Connected to MongoDB");
        return connection;
      })
      .catch((error: Error) => {
        cache.promise = null;
        throw error;
      });
  }

  return cache.promise;
}

export default connectDB;
