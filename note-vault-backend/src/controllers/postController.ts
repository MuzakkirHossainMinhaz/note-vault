import mongoose from "mongoose";
import Post, { PostDocument } from "../models/Post";
import User from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import httpError from "../utils/httpError";
import { parsePagination } from "../utils/pagination";

const createPost = asyncHandler(async (req, res) => {
  const post = await Post.create({
    author: req.user!._id,
    title: req.body.title,
    content: req.body.content,
  });
  await post.populate({ path: "author", select: "name" });
  res.status(201).json(post.toJSON());
});

const listPosts = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 10);
  const cursor = typeof req.query.cursor === "string" ? new mongoose.Types.ObjectId(req.query.cursor) : undefined;
  const filter = cursor ? { _id: { $lt: cursor } } : {};
  const results = await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate({ path: "author", select: "name" });

  const hasMore = results.length > limit;
  const posts = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1]._id.toString() : null;

  res.json({
    data: posts.map((post) => post.toJSON()),
    pagination: { nextCursor, hasMore },
  });
});

const getPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    throw httpError(404, "Post not found");
  }
  res.json(post.toJSON());
});

async function findOwnPost(req: import("express").Request): Promise<PostDocument> {
  const post = await Post.findOne({
    _id: req.params.id,
    author: req.user!._id,
  });
  if (!post) {
    throw httpError(404, "Post not found");
  }
  return post;
}

const updatePost = asyncHandler(async (req, res) => {
  const post = await findOwnPost(req);
  if (req.body.title !== undefined) post.title = req.body.title;
  if (req.body.content !== undefined) post.content = req.body.content;
  await post.save();
  res.json(post.toJSON());
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await findOwnPost(req);
  await post.deleteOne();
  res.status(204).send();
});

const listUserPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const [doc] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
    { $project: { name: 1 } },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "author",
        pipeline: [
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit + 1 },
          { $project: { title: 1, content: 1, createdAt: 1 } },
        ],
        as: "posts",
      },
    },
  ]);

  if (!doc) {
    throw httpError(404, "User not found");
  }

  const hasNextPage = doc.posts.length > limit;
  const posts = hasNextPage ? doc.posts.slice(0, limit) : doc.posts;

  res.json({
    user: { _id: doc._id, name: doc.name },
    posts,
    pagination: {
      page,
      limit,
      hasNextPage,
      hasPrevPage: page > 1,
    },
  });
});

export { createPost, deletePost, getPost, listPosts, listUserPosts, updatePost };
