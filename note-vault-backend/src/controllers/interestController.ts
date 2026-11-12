import { PipelineStage } from "mongoose";
import User from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import { buildPagination, parsePagination } from "../utils/pagination";

const GROUP_PREVIEW_SIZE = 3;

const listInterestGroups = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const interest = req.query.interest;

  const pipeline: PipelineStage[] = [
    {
      $match: interest ? { interests: interest } : { interests: { $exists: true } },
    },
    { $unwind: "$interests" },
  ];

  if (interest) {
    pipeline.push({ $match: { interests: interest } });
  }

  pipeline.push(
    {
      $group: {
        _id: "$interests",
        count: { $sum: 1 },
        users: {
          $topN: {
            output: { _id: "$_id", name: "$name" },
            sortBy: { name: 1, _id: 1 },
            n: GROUP_PREVIEW_SIZE,
          },
        },
      },
    },
    { $sort: { _id: 1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              interest: "$_id",
              count: 1,
              users: 1,
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  );

  const [facetResult] = await User.aggregate(pipeline);
  const data = facetResult?.data ?? [];
  const total = facetResult?.total?.[0]?.count ?? 0;

  res.json({
    data,
    pagination: buildPagination(page, limit, total),
  });
});

const listInterestGroupMembers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { interest } = req.params;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const filter = {
    interests: interest,
    ...(search
      ? {
          name: {
            $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    User.find(filter).select({ name: 1 }).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    data: users,
    pagination: buildPagination(page, limit, total),
  });
});

export { listInterestGroupMembers, listInterestGroups };
