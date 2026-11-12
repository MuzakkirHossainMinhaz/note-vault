import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import connectDB from "./config/db";
import env from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import interestRoutes from "./routes/interest.routes";
import noteRoutes from "./routes/note.routes";
import postRoutes from "./routes/post.routes";
import userRoutes from "./routes/user.routes";
import httpError from "./utils/httpError";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

const allowedOrigins = env.FRONTEND_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(httpError(403, "Origin not allowed"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);

app.use(express.json({ limit: "10kb" }));

// 100 requests per 15 minutes for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests, please try again later" } },
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await connectDB(env.MONGO_URI);
    next();
  } catch (error) {
    console.error("Database connection unavailable:", error instanceof Error ? error.message : error);
    res.status(503).json({ error: { message: "Database unavailable" } });
  }
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/interests", interestRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
