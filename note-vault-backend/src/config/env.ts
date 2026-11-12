import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(1),
  BCRYPT_COST: z.coerce.number().int().min(4).max(12).default(10),
  FRONTEND_URL: z.string().min(1),
  ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().trim().min(2).max(60),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  process.env.PORT = String(parsed.data.PORT);
  process.env.BCRYPT_COST = String(parsed.data.BCRYPT_COST);
  process.env.ADMIN_EMAIL = parsed.data.ADMIN_EMAIL;
  process.env.ADMIN_NAME = parsed.data.ADMIN_NAME;
  process.env.JWT_EXPIRES_IN = parsed.data.JWT_EXPIRES_IN;

  return parsed.data;
}

const env = loadEnv();

export default env;
