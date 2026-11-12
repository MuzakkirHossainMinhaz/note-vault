import express from "express";
import { z } from "zod";
import { login, register } from "../controllers/authController";
import validate from "../middleware/validate";

const router = express.Router();

const interestSchema = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  interests: interestSchema.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post("/register", validate({ body: registerSchema }), register);
router.post("/login", validate({ body: loginSchema }), login);

export default router;
