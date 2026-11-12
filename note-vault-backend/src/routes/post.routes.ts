import express from "express";
import { z } from "zod";
import { createPost, deletePost, getPost, listPosts, updatePost } from "../controllers/postController";
import authenticate from "../middleware/auth";
import validate from "../middleware/validate";

const router = express.Router();

const idParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id"),
});

const postBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    content: z.string().min(1).max(10000),
  })
  .strict();

const postPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    content: z.string().min(1).max(10000).optional(),
  })
  .strict();

const feedQuerySchema = z.object({
  cursor: z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, "Invalid cursor")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get("/", authenticate, validate({ query: feedQuerySchema }), listPosts);
router.post("/", authenticate, validate({ body: postBodySchema }), createPost);
router.get("/:id", validate({ params: idParamSchema }), getPost);
router.patch("/:id", authenticate, validate({ params: idParamSchema, body: postPatchSchema }), updatePost);
router.delete("/:id", authenticate, validate({ params: idParamSchema }), deletePost);

export default router;
