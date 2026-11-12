import express from "express";
import { z } from "zod";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "../controllers/noteController";
import authenticate from "../middleware/auth";
import validate from "../middleware/validate";
import { paginationQuerySchema } from "../utils/pagination";

const router = express.Router();

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const idParamSchema = z.object({
  id: objectIdSchema,
});

const noteBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    content: z.string().min(1).max(10000),
  })
  .strict();

const notePatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    content: z.string().min(1).max(10000).optional(),
  })
  .strict();

const listQuerySchema = paginationQuerySchema.extend({
  owner: objectIdSchema.optional(),
});

router.use(authenticate);

router.post("/", validate({ body: noteBodySchema }), createNote);
router.get("/", validate({ query: listQuerySchema }), listNotes);
router.get("/:id", validate({ params: idParamSchema }), getNote);
router.patch("/:id", validate({ params: idParamSchema, body: notePatchSchema }), updateNote);
router.delete("/:id", validate({ params: idParamSchema }), deleteNote);

export default router;
