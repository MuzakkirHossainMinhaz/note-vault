import Note from "../models/Note";
import Post from "../models/Post";
import User, { UserDocument } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import httpError from "../utils/httpError";
import { paginate, parsePagination } from "../utils/pagination";

function presentUser(user: UserDocument | Record<string, any>): Record<string, any> {
  const obj = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  delete obj.password;
  delete obj.__v;
  return obj;
}

const getMe = asyncHandler(async (req, res) => {
  res.json(presentUser(req.user!));
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!._id);
  if (!user) {
    throw httpError(401, "Invalid or expired token");
  }

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.interests !== undefined) user.interests = req.body.interests;
  if (req.body.password !== undefined) user.password = req.body.password;

  await user.save();
  res.json(presentUser(user));
});

const createUser = asyncHandler(async (req, res) => {
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role || "user",
    interests: req.body.interests || [],
  });

  res.status(201).json(presentUser(user));
});

const listUsers = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const filter = search
    ? {
        $or: ["name", "email"].map((field) => ({
          [field]: {
            $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        })),
      }
    : {};
  const result = await paginate(User, filter, pagination);
  res.json({
    data: result.data.map(presentUser),
    pagination: result.pagination,
  });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw httpError(404, "User not found");
  }
  res.json(presentUser(user));
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw httpError(404, "User not found");
  }

  if (req.body.role && req.body.role !== "admin" && user.role === "admin") {
    const admins = await User.countDocuments({ role: "admin" });
    if (admins <= 1) {
      throw httpError(409, "Cannot demote the last admin");
    }
  }

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.email !== undefined) user.email = req.body.email;
  if (req.body.role !== undefined) user.role = req.body.role;
  if (req.body.interests !== undefined) user.interests = req.body.interests;
  if (req.body.password !== undefined) user.password = req.body.password;

  await user.save();
  res.json(presentUser(user));
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw httpError(404, "User not found");
  }

  if (user._id.equals(req.user!._id)) {
    throw httpError(400, "You cannot delete your own account");
  }

  if (user.role === "admin") {
    const admins = await User.countDocuments({ role: "admin" });
    if (admins <= 1) {
      throw httpError(409, "Cannot delete the last admin");
    }
  }

  await Note.deleteMany({ owner: user._id });
  await Post.deleteMany({ author: user._id });
  await user.deleteOne();
  res.status(204).send();
});

export { createUser, deleteUser, getMe, getUser, listUsers, updateMe, updateUser };
