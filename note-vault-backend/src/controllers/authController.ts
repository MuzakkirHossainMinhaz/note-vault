import type { SignOptions } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import env from "../config/env";
import User, { UserDocument } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import httpError from "../utils/httpError";

function signToken(user: UserDocument): string {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

const register = asyncHandler(async (req, res) => {
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    interests: req.body.interests || [],
    role: "user",
  });

  res.status(201).json({
    user: user.toJSON(),
    token: signToken(user),
  });
});

const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select("+password");
  if (!user) {
    throw httpError(401, "Invalid credentials");
  }

  const matches = await user.comparePassword(req.body.password);
  if (!matches) {
    throw httpError(401, "Invalid credentials");
  }

  res.json({
    user: user.toJSON(),
    token: signToken(user),
  });
});

export { login, register };
