import express from "express";
import { z } from "zod";
import { listInterestGroupMembers, listInterestGroups } from "../controllers/interestController";
import authenticate from "../middleware/auth";
import validate from "../middleware/validate";
import { paginationQuerySchema } from "../utils/pagination";

const router = express.Router();

const groupQuerySchema = paginationQuerySchema.extend({
  interest: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    return typeof value === "string" ? value.trim().toLowerCase() : value;
  }, z.string().min(1).max(30).optional()),
});

const memberParamsSchema = z.object({
  interest: z.string().trim().toLowerCase().min(1).max(30),
});

const memberQuerySchema = paginationQuerySchema.extend({
  search: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    return value.trim() || undefined;
  }, z.string().max(60).optional()),
});

router.get(
  "/groups/:interest/members",
  authenticate,
  validate({ params: memberParamsSchema, query: memberQuerySchema }),
  listInterestGroupMembers,
);
router.get("/groups", authenticate, validate({ query: groupQuerySchema }), listInterestGroups);

export default router;
