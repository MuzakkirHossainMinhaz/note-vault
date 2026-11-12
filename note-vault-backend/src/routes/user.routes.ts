import express from "express";
import { z } from "zod";
import { listUserPosts } from "../controllers/postController";
import { createUser, deleteUser, getMe, getUser, listUsers, updateMe, updateUser } from "../controllers/userController";
import authenticate from "../middleware/auth";
import requireRole from "../middleware/requireRole";
import validate from "../middleware/validate";
import { paginationQuerySchema } from "../utils/pagination";

const router = express.Router();

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const idParamSchema = z.object({
  id: objectIdSchema,
});

const interestSchema = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20);

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    interests: interestSchema.optional(),
    password: z.string().min(8).optional(),
  })
  .strict();

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  role: z.enum(["user", "admin"]).optional(),
  interests: interestSchema.optional(),
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    role: z.enum(["user", "admin"]).optional(),
    interests: interestSchema.optional(),
    password: z.string().min(8).optional(),
  })
  .strict();

router.get("/me", authenticate, getMe);
router.patch("/me", authenticate, validate({ body: updateMeSchema }), updateMe);
router.get("/:id/posts", validate({ params: idParamSchema, query: paginationQuerySchema }), listUserPosts);
router.post("/", authenticate, requireRole("admin"), validate({ body: createUserSchema }), createUser);
router.get("/", authenticate, requireRole("admin"), validate({ query: paginationQuerySchema }), listUsers);
router.get("/:id", authenticate, requireRole("admin"), validate({ params: idParamSchema }), getUser);
router.patch(
  "/:id",
  authenticate,
  requireRole("admin"),
  validate({ params: idParamSchema, body: updateUserSchema }),
  updateUser,
);
router.delete("/:id", authenticate, requireRole("admin"), validate({ params: idParamSchema }), deleteUser);

export default router;
